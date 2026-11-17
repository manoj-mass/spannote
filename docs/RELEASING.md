# Releasing

SpanNote packages are published to npm under the `@spannote` scope. All packages share one version
number, set in one place. The demo apps are private and are never published.

## Versioning

The `version` field in the root `package.json` is the single source of truth. Every package under
`packages/` uses that version, and so does every `@spannote/*` dependency range in the repository.

Change the version with the script, never by hand:

```bash
npm run version:bump                        # asks for patch, minor, major or a custom version
npm run version:bump -- minor               # bumps without asking: patch | minor | major | X.Y.Z
npm run version:bump -- 0.3.0 --yes         # sets an exact version and skips the confirmation
npm run version:bump -- minor --dry-run     # shows the previous and new versions, writes nothing
```

The prompt shows the current version and what each choice produces:

```text
Current version: 0.1.0  (root package.json)

  1) patch   0.1.0 -> 0.1.1   bug fixes
  2) minor   0.1.0 -> 0.2.0   new features; before 1.0, breaking changes go here too
  3) major   0.1.0 -> 1.0.0   breaking changes after 1.0
  4) custom  type any X.Y.Z version
```

The script lists each published package with its previous and new version, then asks for confirmation.
It then writes the root `package.json`, every package, and every `@spannote/*` dependency range, and
refreshes `package-lock.json`. Review the result with `git diff`, run `npm run check`, and commit.

Versions follow [semver](https://semver.org). Before 1.0, a breaking change goes in a minor bump.

## Releasing to npm

1. Run `npm run version:bump` and commit the change.
2. Merge to `main`. CI runs.
3. The release workflow (`.github/workflows/release.yml`) publishes each package whose version is not
   on npm yet. Publishing waits for approval in the `npm-release` environment, and it uses provenance.

A version that is already on npm is skipped. A push that doesn't bump the version publishes nothing.
npm does not allow a version to be published twice, so always bump before you publish.

Changesets is still installed, but it no longer decides version numbers. `.changeset/config.json` keeps
all eight packages in one `fixed` group, so if a changeset is ever added, the packages still move together.

## GitHub setup (once)

1. **Create an npm token for CI.** On npmjs.com, create a granular access token with read and write
   permission for the `@spannote` packages. Add it to the repository as a secret named `NPM_TOKEN`
   (Settings, then Secrets and variables, then Actions).
2. **Create the approval gate.** Settings, then Environments, then New environment, named `npm-release`.
   Add yourself under _Required reviewers_. Every publish then waits for your approval.
3. **Let the workflow open pull requests.** Settings, then Actions, then General, then turn on _Allow
   GitHub Actions to create and approve pull requests_.

Trusted publishing (no token at all) is an alternative. npm supports it for GitHub Actions, but you can
only configure it for a package that already exists.

`.github/workflows/ci.yml` runs on every push and pull request: typecheck, lint, format, tests with
coverage, the package build, the demo build, and a check that each package packs only `dist`,
`README.md` and `LICENSE`.

## One-time setup (local publishing)

Use these steps only if you publish from your own machine. Publishing from GitHub Actions is
described above.

1. Create an npm account and turn on two-factor authentication for publishing.
2. Create the `spannote` organisation on npmjs.com. The scope `@spannote` belongs to that organisation,
   so the first publish fails without it.
3. Log in from the terminal:

   ```bash
   npm login
   npm whoami        # should print your npm username
   ```

4. Confirm the licence, the repository URL and the namespace domain (see
   [docs/NAMING.md](NAMING.md#open-decisions)). The repository URL in each `packages/*/package.json` is
   `https://github.com/manoj-mass/spannote`.

## Provenance (from CI)

npm attaches a signed provenance statement to a release only when it is published from GitHub Actions
with `id-token: write`. Local publishing does not support it, so `publishConfig` does not set
`provenance`.

## Testing the published packages

The demo imports the workspace packages. To check what users receive, install the published versions
in a folder outside the repository:

```bash
mkdir /tmp/spannote-consumer && cd /tmp/spannote-consumer
npm init -y
npm install @spannote/core@0.1.0 @spannote/react@0.1.0 @spannote/render@0.1.0 react react-dom
```

Then copy `apps/demo-react/src` into that folder and run the demo against the registry packages. Repeat the
smoke test there before you announce a release.

## Dependency updates

Dependabot opens update pull requests weekly (`.github/dependabot.yml`). The workflow
`.github/workflows/dependabot-auto-merge.yml` approves and auto-merges only patch and minor updates of
development dependencies, and only when the required checks pass. Everything else waits for review:

- major updates, production dependencies and GitHub Actions updates;
- React, Vue, Angular and Vite. The browser smoke test is not in CI, so a framework change can pass CI
  and still break the demo.

Merging to `main` does not publish a package. A release still needs `npm run version:bump` and approval in
the `npm-release` environment. Merging does deploy the demo, if Vercel is connected to `main`.

Set this up once on GitHub:

1. **Settings, then Branches**: protect `main`, and mark the CI checks as required (`Check` on Node 20, 22
   and 24, and `Pack check`).
2. **Settings, then General**: turn on **Allow auto-merge**.
3. **Settings, then Actions, then General**: turn on **Allow GitHub Actions to create and approve pull
   requests**.

Without step 1, auto-merge merges a pull request before CI has run.

## Checklist before every publish

- [ ] `npm run version:bump` set the new version, and `git diff` shows only the expected files.
- [ ] `npm run check` passes on a clean checkout.
- [ ] The docs and the demo match the new version.
- [ ] `npm pack --dry-run` lists only `dist`, `README.md` and `LICENSE` for each package.
- [ ] The repository URL, the licence and the namespace domain are correct.
