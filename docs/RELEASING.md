# Releasing

Packages are published to npm under the `@spannote` scope with [Changesets](https://github.com/changesets/changesets).

## One-time setup

1. Create the npm organisation `spannote` (or the scope you choose), and make sure you are an owner.
2. Set `repository.url` in each `packages/*/package.json` to the real repository.
3. Enable two-factor authentication for publishing on npm.
4. For provenance, publish from GitHub Actions with `id-token: write` (the `publishConfig` in each
   package already requests provenance).

## Each release

```bash
npm run check                 # must pass
npx changeset                 # describe the change: patch, minor or major
npm run version-packages      # bumps versions and changelogs
npm run build
npm publish --workspaces --access public   # or `npm run release` from CI
```

`@spannote/anchor`, `core`, `protocol`, `render` and `react` depend on `@spannote/model`. Changesets
bumps dependents together, so a new model version reaches every package in the same release.

Copy `LICENSE` into each package before publishing (the packages list it in `files`):

```bash
for p in packages/*; do cp LICENSE "$p/LICENSE"; done
```
