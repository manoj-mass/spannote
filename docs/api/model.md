# @spannote/model

Types, parsing, serialization, and the storage port. No DOM and no runtime dependencies.

```ts
import {
  parseAnnotation,
  toJsonLd,
  ANNO_MEDIA_TYPE,
  MOTIVATIONS,
  VersionConflictError,
  isVersionConflict,
  type Annotation,
  type AnnotationStore,
} from '@spannote/model';
```

## Constants

| Name               | Value                                                             |
| ------------------ | ----------------------------------------------------------------- |
| `ANNO_CONTEXT_IRI` | `http://www.w3.org/ns/anno.jsonld`                                |
| `ANNO_MEDIA_TYPE`  | `application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"` |
| `SPANNOTE_NS`      | `https://spannote.dev/ns#` (the `sn:` prefix)                     |
| `MOTIVATIONS`      | The 13 standard motivations, as a readonly tuple                  |

## Types

```ts
type Motivation = 'assessing' | 'bookmarking' | /* … */ 'tagging';

interface TextQuoteSelector {
  type: 'TextQuoteSelector';
  exact: string;
  prefix?: string;
  suffix?: string;
}
interface TextPositionSelector {
  type: 'TextPositionSelector';
  start: number;
  end: number;
}
type Selector = TextQuoteSelector | TextPositionSelector;

interface SpecificResource {
  type: 'SpecificResource';
  source: string;
  selector: readonly Selector[];
}
interface TextualBody {
  type: 'TextualBody';
  value: string;
  format?: 'text/plain' | 'text/markdown' | 'text/html';
  language?: string;
}
interface Agent {
  id?: string;
  type?: 'Person' | 'Organization' | 'Software';
  name?: string;
}

type AnnotationStatus = 'open' | 'resolved' | 'proposed';

interface Annotation {
  id: string;
  type: 'Annotation';
  motivation: Motivation;
  target: SpecificResource;
  body: readonly TextualBody[];
  creator?: Agent;
  generator?: Agent;
  created?: string; // ISO 8601
  modified?: string; // ISO 8601
  status?: AnnotationStatus; // sn:status
  inReplyTo?: string; // sn:inReplyTo
}

interface ParseIssue {
  path: string;
  message: string;
}
```

`Annotation.body` is always an array in memory. `toJsonLd` writes a single body as an object, as
the spec allows.

## parseAnnotation

```ts
function parseAnnotation(input: unknown): Result<ParsedAnnotation, readonly ParseIssue[]>;

interface ParsedAnnotation {
  annotation: Annotation;
  warnings: readonly ParseIssue[];
}
```

Parses decoded JSON from an untrusted source. It never throws.

- Returns `{ ok: true, value }` when the annotation is usable. `value.warnings` lists non-fatal
  problems, such as unknown selector types, dropped non-text bodies, or malformed selectors.
- Returns `{ ok: false, error }` when the annotation cannot be used. `error` lists each problem
  with the JSON path where it occurred.

What makes an annotation unusable: a missing or wrong `type`, a missing `id`, no recognised
motivation, a missing `target` or `target.source`, or a target with no usable selector.

Rules worth knowing:

- A `motivation` array keeps the first recognised value.
- A malformed selector is dropped with a warning, the same as an unknown one. The target survives if
  another selector is valid.
- `TextPositionSelector` needs integer `start` and `end`, with `0 <= start <= end`.

```ts
const result = parseAnnotation(JSON.parse(payload));
if (result.ok) {
  for (const w of result.value.warnings) console.warn(w.path, w.message);
  use(result.value.annotation);
} else {
  for (const issue of result.error) console.error(issue.path, issue.message);
}
```

## toJsonLd

```ts
function toJsonLd(annotation: Annotation): AnnotationJsonLd;
```

Converts an `Annotation` to its JSON-LD shape, with the W3C context and the `sn:` namespace. The
output round-trips through `parseAnnotation`.

## Result helpers

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
function ok<T>(value: T): Result<T, never>;
function fail<E>(error: E): Result<never, E>;
```

## AnnotationStore (the storage port)

```ts
interface Versioned<T> {
  readonly value: T;
  readonly version: string | undefined;
}

interface AnnotationStore {
  list(): Promise<readonly Versioned<Annotation>[]>;
  create(annotation: Annotation): Promise<Versioned<Annotation>>;
  update(annotation: Annotation, version: string | undefined): Promise<Versioned<Annotation>>;
  remove(id: string, version: string | undefined): Promise<void>;
}
```

Implement this interface to connect any backend. See [Storage](../guides/storage.md#writing-your-own-adapter).

`version` is an opaque token that identifies the stored state (an HTTP ETag, a sequence number, or
anything else). Pass back the version you last read; reject the write with a conflict when it no
longer matches.

## Conflicts

```ts
class VersionConflictError extends Error {
  name: 'VersionConflictError';
}
function isVersionConflict(error: unknown): boolean;
```

`isVersionConflict` is true for `VersionConflictError` and for any error with `status === 412`.
Use it instead of `instanceof` when you may receive errors from several adapters.
