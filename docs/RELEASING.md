# Releasing

SpanNote packages are published to npm under the `@spannote` scope. Versions and changelogs are
managed with [Changesets](https://github.com/changesets/changesets). The demo app is private and is
never published.

## Publishing from GitHub Actions (recommended)

Two workflows do the work:

- `.github/workflows/ci.yml` runs on every push and pull request: typecheck, lint, format, tests with
  coverage, the package build, the demo build, and a check that each package packs only `dist`,
  `README.md` and `LICENSE`.
- `.github/workflows/release.yml` runs on every push to `main`. When changesets are pending, it opens a
  pull request named "Release: version packages". Merging that pull request publishes the new versions.
  The publish job waits for approval in the `npm-release` environment, and it publishes with provenance.

### GitHub setup (once)

1. **Create an npm token for CI.** On npmjs.com, create a granular access token with read and write
   permission for the `@spannote` packages. Add it to the repository as a secret named `NPM_TOKEN`
   (Settings, then Secrets and variables, then Actions).
2. **Create the approval gate.** Settings, then Environments, then New environment, named `npm-release`.
   Add yourself under _Required reviewers_. Every publish then waits for your approval.
3. **Let the workflow open pull requests.** Settings, then Actions, then General, then turn on _Allow
   GitHub Actions to create and approve pull requests_.

### Day-to-day flow

1. Each change includes a changeset: `npx changeset`.
2. Merge the change into `main`. CI runs.
3. The release workflow opens or updates the "Release: version packages" pull request, with the version
   bumps and changelogs.
4. Review that pull request and merge it.
5. Approve the `npm-release` deployment. The workflow publishes to npm.

### Before the first run

The first release needs `.changeset/initial-release.md` removed (see _First release_ below). Otherwise
the workflow opens a pull request that bumps the packages to 0.2.0.

Trusted publishing (no token at all) is an alternative. npm supports it for GitHub Actions, but you can
only configure it for a package that already exists. Use `NPM_TOKEN` for the first release, then switch.

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

## First release (0.1.0)

The packages are at `0.1.0` and have never been published. The pending changeset in
`.changeset/initial-release.md` would bump them to `0.2.0`. For the first release, remove it so the
packages publish at `0.1.0`:

```bash
git rm .changeset/initial-release.md
npm run check                  # must pass
npm run build                  # builds every package
npx changeset status           # should report nothing to release, or only the packages you expect
npx changeset publish          # publishes each package whose version is not on npm yet
git tag -a v0.1.0 -m "SpanNote 0.1.0"
git push --follow-tags
```

`changeset publish` skips any version that already exists on npm, so running it twice is safe.

## Each later release

```bash
npx changeset                  # describe each change: patch, minor or major
npx changeset version          # bumps versions, updates CHANGELOG.md, bumps dependents
npm run check
npm run build
npx changeset publish
git add -A && git commit -m "Release <versions>" && git tag -a <version> -m "<version>"
git push --follow-tags
```

`@spannote/anchor`, `core`, `protocol`, `render` and `react` depend on `@spannote/model`. Changesets
bumps dependents together, so a new model version reaches every package in the same release.

## Provenance (optional, from CI)

npm can attach a signed provenance statement to each release, but only when the publish runs in GitHub
Actions with `id-token: write`. Local publishing does not support it, so `publishConfig` no longer sets
`provenance`. To add it, publish from a release workflow and set `"provenance": true` in each
package's `publishConfig`.

## Testing the published packages

The demo imports the workspace packages. To check what users receive, install the published versions
in a folder outside the repository:

```bash
mkdir /tmp/spannote-consumer && cd /tmp/spannote-consumer
npm init -y
npm install @spannote/core@0.1.0 @spannote/react@0.1.0 @spannote/render@0.1.0 react react-dom
```

Then copy `apps/demo/src` into that folder and run the demo against the registry packages. Repeat the
smoke test there before you announce a release.

## Checklist before every publish

- [ ] `npm run check` passes on a clean checkout.
- [ ] Every user-visible change has a changeset.
- [ ] The docs and the demo match the new version.
- [ ] `npm pack --dry-run` lists only `dist`, `README.md` and `LICENSE` for each package.
- [ ] The repository URL, the licence and the namespace domain are correct.
