# Naming standards

These rules apply to everything SpanNote publishes or exposes: packages, files, public names,
strings that leave the library (events, statuses, DOM attributes, JSON-LD terms), and branches.
They are written for this project. Follow them unless a maintainer records an exception here.

## Principles

1. **Name the purpose, not the mechanism.** `anchor` says what the package does. `dom-helper` does not.
2. **Be consistent with neighbours.** Packages, files and strings in the same area follow the same pattern.
3. **Prefer plain words.** Avoid abbreviations except widely known ones (`id`, `url`, `css`, `json`).
4. **Public names are promises.** Once published, a name changes only in a major release.

## Packages

- Format: `@spannote/<name>`. The scope already says "SpanNote", so the package name never repeats it.
- `<name>` is lowercase. One word, or words joined by hyphens.
- The folder is `packages/<name>`, and it matches the package name exactly.
- Current packages: `model`, `anchor`, `render`, `protocol`, `core`, `react`.
- Planned binding packages follow the framework name: `vue`, `angular`.

A generic one-word name is acceptable inside the scope, because the scope prevents collisions with
other packages. Prefer a more specific name when the generic one is ambiguous inside the repo.

## Files and folders

- All file and folder names are kebab-case: `text-index.ts`, `mark-highlight.ts`, `bindings.test.tsx`.
- Each package exposes its public surface only through `src/index.ts`.
- Tests live in `test/` and are named after the unit they test: `resolvers.test.ts` for
  `src/resolvers.ts`. Use `.tsx` only when the test renders JSX.
- Helper modules shared by tests are named `helpers.ts`.

## Code identifiers (TypeScript)

| Kind                         | Form                                   | Examples                                                      |
| ---------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| Type, interface, class, enum | PascalCase                             | `AnnotationService`, `TextIndex`                              |
| Function, method, variable   | camelCase; functions start with a verb | `describeQuote`, `resolve`, `draftBody`                       |
| Fixed module configuration   | UPPER_SNAKE_CASE                       | `POSITION_MODEL`, `ANNO_MEDIA_TYPE`, `DEFAULT_CONTEXT_LENGTH` |
| Boolean                      | `is`, `has` or `can` prefix            | `isVersionConflict`, `hasRange`                               |
| Options object               | `<Thing>Options`                       | `AnchorEngineOptions`, `ProtocolClientOptions`                |
| Error                        | `<Condition>Error`                     | `EmptySelectionError`, `VersionConflictError`                 |
| Resolver                     | `<Strategy>Resolver`                   | `PositionResolver`, `FuzzyResolver`                           |
| Highlight renderer           | `<Mechanism>HighlightRenderer`         | `CssHighlightRenderer`, `MarkHighlightRenderer`               |
| Storage adapter              | `<Backend>AnnotationStore`             | `ProtocolAnnotationStore`, `MemoryAnnotationStore`            |
| React provider and hooks     | `<Name>Provider`, `use<Thing>`         | `SpanNoteProvider`, `useAnnotations`                          |

- Do not prefix interfaces with `I`.
- Do not use single-letter names outside short callbacks and loop indexes.

## Strings that leave the library

- **Strategy and status values:** lowercase kebab-case. Examples: `unique-quote`, `attached-fuzzy`.
- **Event names:** lowercase single nouns. Examples: `change`, `anchors`.
- **Motivations:** the exact lowercase values from the W3C vocabulary, for example `commenting`.
- **JSON-LD extension terms:** prefix `sn:` with a camelCase local name. Examples: `sn:status`,
  `sn:inReplyTo`. The namespace IRI is `https://spannote.dev/ns#`.
- **DOM classes and data attributes:** prefix `spannote-` in kebab-case. Examples:
  `spannote-highlight`, `data-spannote-highlight`.
- **CSS highlight names:** `spannote-<group>`. Example: `::highlight(spannote-comments)`.

## Public API

- Every exported name appears in `docs/api/`. Adding an export without documenting it fails review.
- Do not rename or remove an export without a changeset that marks the break, and an update to the
  affected docs.
- Keep option names consistent across packages. A `source` option means the same thing everywhere.

## Repository, branches and changesets

- Repository: `spannote`.
- Branch names: `<type>/<short-kebab-description>`, where `<type>` is `feat`, `fix`, `docs`,
  `refactor`, `test` or `chore`. Example: `fix/position-verification`.
- Changeset summaries: one sentence, written for users of the package.
- Commit subjects: imperative mood, 72 characters or fewer.

## Reviewing a name

Before you add a package, file, export or external string, check it against this list:

1. Does the name say what the thing does?
2. Is it lowercase kebab-case (or the form listed above for its kind)?
3. Does it match its neighbours?
4. Is it unambiguous inside this repository?
5. Is it free of the project's old names (`anchorline`, `al:`)?

## Open decisions

- The namespace domain `spannote.dev` is not yet owned. Register it, or change `SPANNOTE_NS`, before
  any annotation with `sn:` terms is stored.
- The npm scope `@spannote` is not yet claimed.
