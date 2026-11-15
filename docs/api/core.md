# @spannote/core

The annotation service. It owns the annotation list and anchor states, and writes through a store.
It has no framework and no HTTP code.

```ts
import {
  AnnotationService,
  MemoryAnnotationStore,
  EmptySelectionError,
  EventHub,
  buildAnnotation,
  randomId,
  type AnnotationDraft,
  type AnnotationServiceOptions,
  type AnnotationServiceEvents,
  type AnchorState,
  type AnchorStatus,
} from '@spannote/core';
```

## AnnotationService

```ts
class AnnotationService {
  constructor(options: AnnotationServiceOptions);

  readonly annotations: readonly Annotation[]; // getter: sorted by `created`
  readonly anchors: ReadonlyMap<string, AnchorState>; // getter: one entry per annotation

  on<K extends keyof AnnotationServiceEvents>(
    event: K,
    listener: (payload: AnnotationServiceEvents[K]) => void,
  ): () => void;

  load(): Promise<void>;
  attach(root: Node): void;
  detach(): void;
  refreshAnchors(): void;

  createFromRange(range: Range, draft: AnnotationDraft): Promise<Annotation>;
  reply(parent: Annotation, draft: Omit<AnnotationDraft, 'motivation'>): Promise<Annotation>;
  update(id: string, changes: { body?: string; status?: AnnotationStatus }): Promise<Annotation>;
  remove(id: string): Promise<void>;
}
```

### Options

```ts
interface AnnotationServiceOptions {
  store: AnnotationStore; // required
  engine?: AnchorEngine; // default: new AnchorEngine()
  creator?: Agent; // written to annotations you create
  source?: () => string; // page URL for new annotations; default: location.href
  now?: () => Date; // clock; default: new Date()
  newId?: () => string; // id source for new annotations; default: randomId
}
```

`source` is evaluated for each new annotation, so single-page apps can return the current URL.
`newId` is used only for annotations you create; the store may replace the id.

### Events

```ts
type AnnotationServiceEvents = {
  change: readonly Annotation[]; // the list changed (load, create, update, remove)
  anchors: ReadonlyMap<string, AnchorState>; // anchors were re-resolved
};
```

`on` returns an unsubscribe function. Listeners run synchronously. A listener that throws does not
stop the others; its error is rethrown asynchronously, so it still appears in the console.

Both arrays and maps are replaced, never mutated, so you can keep a reference and compare it.

### Lifecycle

1. `new AnnotationService({ store })`
2. `attach(root)`: sets the DOM root and resolves anchors (no annotations yet, so nothing happens)
3. `await load()`: reads the store, publishes `change`, then resolves anchors
4. Writes (`createFromRange`, `reply`, `update`, `remove`) publish `change` and then re-resolve anchors
5. `refreshAnchors()` after the page changes, to publish fresh `anchors`
6. `detach()`: forgets the root and clears anchors. Annotations stay loaded.

`load` may be called again to re-read the store.

### load()

Reads every annotation through `store.list()`. Replaces the loaded list. Rejects with the store's
error if the read fails.

### attach(root) and detach()

`attach` sets the root that all anchors are resolved in. It re-resolves immediately. Attaching a
different root re-resolves against that root.

### refreshAnchors()

Builds a new snapshot of the root and re-resolves every annotation. It is a no-op publish when no
root is attached (the anchor map is emptied).

Call it after the page changes. It is cheap enough for a `MutationObserver` callback, but debounce
it: each call indexes the whole root.

### createFromRange(range, draft)

- Requires an attached root. Throws `Error` otherwise.
- Describes `range` with `AnchorEngine.describe`. Throws `EmptySelectionError` when there are no
  selectors.
- Builds the annotation with `motivation` (default `commenting`), `created` set to now, and
  `creator` and `source` from the options.
- Stores it, publishes `change`, and re-resolves anchors.
- Returns the stored annotation (with the store's id).

### reply(parent, draft)

Creates a `replying` annotation with `inReplyTo` set to `parent.id`. It targets the same source and
selectors as the parent. Does not require a range.

### update(id, changes)

- Throws `Error` when `id` is not loaded.
- Replaces `body` when `changes.body` is given, as a single `TextualBody` with `text/plain`.
- Sets `status` when given. Sets `modified` to now.
- Writes with the version the service holds for `id`. A stale version rejects with a conflict.
- Returns the updated annotation.

### remove(id)

Throws `Error` when `id` is not loaded. Deletes through the store with the held version, then
publishes `change` and re-resolves anchors.

## Types

```ts
interface AnnotationDraft {
  body: string;
  motivation?: Motivation; // default 'commenting'
  status?: AnnotationStatus;
}

type AnchorStatus = 'attached' | 'attached-fuzzy' | 'orphan';

interface AnchorState {
  annotationId: string;
  status: AnchorStatus;
  range?: Range; // present unless orphan
  strategy?: Strategy; // 'position' | 'quote' | 'unique-quote' | 'fuzzy'
  score?: number;
}
```

`status` is `attached-fuzzy` exactly when the strategy is `fuzzy`.

## Errors

| Error                      | When                                                                   |
| -------------------------- | ---------------------------------------------------------------------- |
| `EmptySelectionError`      | `createFromRange` for a range with no indexed text                     |
| `Error` ("Attach a root…") | `createFromRange` before `attach`                                      |
| `Error` ("is not loaded")  | `update` or `remove` for an unknown id                                 |
| Store errors               | Passed through unchanged. Use `isVersionConflict` to detect conflicts. |

## Helpers

```ts
function buildAnnotation(input: NewAnnotationInput): Annotation;   // pure builder
function randomId(): string;                                       // 'urn:uuid:…'
class MemoryAnnotationStore implements AnnotationStore { /* in-memory */ }
class EventHub<Events> { on(...); emit(...); clear(); }            // the typed hub the service uses
```

`buildAnnotation` takes an id, source, selectors, motivation, body, and `created`, and returns a
valid `Annotation`. Use it to create annotations outside the service, for example in an import.

`randomId` returns a `urn:uuid:` identifier. For production, let the store assign ids.
