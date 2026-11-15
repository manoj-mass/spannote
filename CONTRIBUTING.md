# Contributing

Thanks for helping. SpanNote is small on purpose: changes should keep the packages focused.

## Workflow

1. Open an issue first for anything larger than a bug fix.
2. Branch from `main`. Keep one change per pull request.
3. Run `npm run check`. It must pass: typecheck, lint, format, tests and build.
4. Add a changeset for any user-visible change: `npx changeset`.

## Principles

- **Respect package boundaries.** `model` has no DOM. `core` has no HTTP and no React. Adapters
  implement ports; they do not reach into the core.
- **Prefer a new strategy over a flag.** Add a `Resolver` or `HighlightRenderer` rather than
  branching inside an existing one.
- **Test behaviour, with real ranges.** The anchor and render tests use jsdom's `Range`. A change
  to text handling needs a test that fails before the change.
- **Keep public types small.** Export a type only when a consumer needs it.

## Code style

TypeScript in strict mode. Prettier and ESLint (type-checked rules) are enforced. Avoid non-null
assertions; narrow the type instead.
