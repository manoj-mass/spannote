#!/usr/bin/env node
/**
 * Sets one version for every SpanNote package.
 *
 * The single source of truth is the `version` field in the root package.json. The script writes that
 * version to each package under packages/, updates every @spannote/* dependency range that points at a
 * package in this repository, and refreshes package-lock.json. It never publishes: publishing happens in
 * the release workflow after the change is merged.
 *
 * Usage:
 *   npm run version:bump                 asks for patch, minor, major or a custom version
 *   npm run version:bump -- minor        bumps without asking (patch | minor | major | X.Y.Z)
 *   npm run version:bump -- 0.2.0 --yes  sets an exact version and skips the confirmation
 *   npm run version:bump -- minor --dry-run  shows the changes and writes nothing
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_MANIFEST = join(ROOT, 'package.json');
const SCOPE = '@spannote/';
const KINDS = ['patch', 'minor', 'major'];
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];
const KNOWN_FLAGS = new Set(['--dry-run', '--yes']);

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match)
    fail(`"${version}" is not a plain X.Y.Z version. Pre-release tags are not supported.`);
  return match.slice(1).map(Number);
}

function nextVersion(current, kind) {
  const [major, minor, patch] = parseVersion(current);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function isNewer(candidate, current) {
  const next = parseVersion(candidate);
  const prev = parseVersion(current);
  for (let i = 0; i < 3; i++) {
    if (next[i] !== prev[i]) return next[i] > prev[i];
  }
  return false;
}

function manifestsIn(folder) {
  const dir = join(ROOT, folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(dir, entry.name, 'package.json'))
    .filter((file) => existsSync(file));
}

function isGitDirty() {
  try {
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return status.trim() !== '';
  } catch {
    return false;
  }
}

/**
 * Asks questions one line at a time. Reads go through readline's line iterator, which keeps lines that
 * arrive before a question is asked. `rl.question()` drops them, which breaks piped answers.
 */
function createPrompter() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const lines = rl[Symbol.asyncIterator]();
  return {
    async ask(prompt) {
      process.stdout.write(prompt);
      const { value, done } = await lines.next();
      if (done) fail('no answer was given.');
      return String(value).trim();
    },
    close() {
      rl.close();
    },
  };
}

async function resolveTarget(arg, current, prompts) {
  if (arg !== undefined) return KINDS.includes(arg) ? nextVersion(current, arg) : arg;

  console.log(`\nCurrent version: ${current}  (root package.json)\n`);
  console.log(`  1) patch   ${current} -> ${nextVersion(current, 'patch')}   bug fixes`);
  console.log(
    `  2) minor   ${current} -> ${nextVersion(current, 'minor')}   new features; before 1.0, breaking changes go here too`,
  );
  console.log(
    `  3) major   ${current} -> ${nextVersion(current, 'major')}   breaking changes after 1.0`,
  );
  console.log('  4) custom  type any X.Y.Z version\n');

  const choice = await prompts.ask('Choose 1-4: ');
  if (choice === '1') return nextVersion(current, 'patch');
  if (choice === '2') return nextVersion(current, 'minor');
  if (choice === '3') return nextVersion(current, 'major');
  if (choice !== '4') fail(`"${choice}" is not one of 1-4.`);
  return prompts.ask('New version (X.Y.Z): ');
}

/** Returns the manifest with the new version and dependency ranges, and the counts of what changed. */
function planManifest(file, manifest, target, setOwnVersion) {
  const next = structuredClone(manifest);
  let dependencyUpdates = 0;

  if (setOwnVersion) next.version = target;

  for (const field of DEPENDENCY_FIELDS) {
    const deps = next[field];
    if (!deps) continue;
    for (const [name, range] of Object.entries(deps)) {
      if (!name.startsWith(SCOPE) || typeof range !== 'string') continue;
      const match = /^([\^~]?)\d+\.\d+\.\d+$/.exec(range);
      if (!match) continue;
      const updated = `${match[1] ?? ''}${target}`;
      if (updated !== range) {
        deps[name] = updated;
        dependencyUpdates++;
      }
    }
  }

  const changed = JSON.stringify(next) !== JSON.stringify(manifest);
  return { file, manifest: next, changed, dependencyUpdates };
}

async function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg.startsWith('--') && !KNOWN_FLAGS.has(arg));
  if (unknown.length > 0) fail(`unknown option ${unknown.join(', ')}.`);
  const positional = args.filter((arg) => !arg.startsWith('--'));
  if (positional.length > 1) fail('pass at most one version argument.');
  const dryRun = args.includes('--dry-run');
  const assumeYes = args.includes('--yes');

  const current = readJson(ROOT_MANIFEST).version;
  parseVersion(current);

  const prompts = createPrompter();
  let target;
  try {
    target = await resolveTarget(positional[0], current, prompts);
    parseVersion(target);
    if (!isNewer(target, current)) fail(`${target} is not newer than the current ${current}.`);

    const published = manifestsIn('packages').map((file) =>
      planManifest(file, readJson(file), target, true),
    );
    const apps = manifestsIn('apps').map((file) =>
      planManifest(file, readJson(file), target, false),
    );
    const root = planManifest(ROOT_MANIFEST, readJson(ROOT_MANIFEST), target, true);
    const plans = [root, ...published, ...apps];

    console.log(`\nVersion ${current} -> ${target}\n`);
    console.log('Published packages (previous -> new):');
    for (const plan of published) {
      const name = plan.manifest.name.padEnd(22);
      const previous = readJson(plan.file).version.padEnd(8);
      console.log(`  ${name} ${previous} -> ${plan.manifest.version}`);
    }
    const depCount = plans.reduce((sum, plan) => sum + plan.dependencyUpdates, 0);
    const changedFiles = plans.filter((plan) => plan.changed);
    console.log(`\nDependency ranges updated: ${depCount}`);
    console.log(
      `Files to write: ${changedFiles.map((plan) => relative(ROOT, plan.file)).join(', ') || 'none'}`,
    );

    if (changedFiles.length === 0) {
      console.log('\nNothing to change.');
      return;
    }
    if (dryRun) {
      console.log('\nDry run: nothing written.');
      return;
    }
    if (!assumeYes) {
      const answer = (await prompts.ask('\nWrite these changes? (y/N) ')).toLowerCase();
      if (answer !== 'y' && answer !== 'yes') {
        console.log('Cancelled. Nothing written.');
        return;
      }
    }

    if (isGitDirty()) {
      console.log(
        '\nNote: the working tree already has uncommitted changes. Review them with git diff.',
      );
    }

    for (const plan of changedFiles) {
      writeFileSync(plan.file, `${JSON.stringify(plan.manifest, null, 2)}\n`);
    }

    execFileSync(
      'npm',
      ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'],
      { cwd: ROOT, stdio: 'inherit' },
    );

    const prettier = join(ROOT, 'node_modules', '.bin', 'prettier');
    if (existsSync(prettier)) {
      const files = [...changedFiles.map((plan) => plan.file), join(ROOT, 'package-lock.json')];
      execFileSync(prettier, ['--write', ...files], { cwd: ROOT, stdio: 'ignore' });
    }

    console.log(`\nDone. Every package is now at ${target}.`);
    console.log('Next: review with git diff, run npm run check, then commit.');
  } finally {
    prompts.close();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
