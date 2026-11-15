# @spannote/react

React bindings: a provider that attaches the service to the page, and hooks that read its state.

```ts
import {
  SpanNoteProvider,
  useAnnotationService,
  useAnnotations,
  useAnchorStates,
  useAnchor,
  type SpanNoteProviderProps,
} from '@spannote/react';
```

## SpanNoteProvider

```ts
function SpanNoteProvider(props: SpanNoteProviderProps): JSX.Element;

interface SpanNoteProviderProps {
  service: AnnotationService; // required; keep it stable
  root?: Node | null; // default document.body
  children?: ReactNode;
}
```

- Provides the service to the subtree.
- In an effect, calls `service.attach(root)` when mounted, and `service.detach()` when unmounted or
  when `service` or `root` changes.
- When `root` is `null`, nothing is attached.
- The effect runs only in the browser, so the provider is safe to render on the server.

## Hooks

### useAnnotationService()

```ts
function useAnnotationService(): AnnotationService;
```

Returns the service. Throws an `Error` naming `SpanNoteProvider` when there is none above.

### useAnnotations()

```ts
function useAnnotations(): readonly Annotation[];
```

Returns the current list. Re-renders when the list changes. On the server, returns an empty array.

### useAnchorStates()

```ts
function useAnchorStates(): ReadonlyMap<string, AnchorState>;
```

Returns the anchor state for every annotation. Re-renders when any anchor state changes. On the
server, returns an empty map.

### useAnchor(annotationId)

```ts
function useAnchor(annotationId: string): AnchorState | undefined;
```

Returns the state for one annotation. Implemented on top of `useAnchorStates`, so it re-renders on
any anchor change.

## Re-rendering

The hooks use `useSyncExternalStore`. The service replaces its arrays and maps on each change, so
a hook returns the same reference until something changes, and components skip work otherwise.

## Server rendering

Hooks return empty values during server rendering and hydration. The first client render matches
the server output, then the list fills in after the service loads.

## What the binding does not do

- It does not call `service.load()`. Load where your application starts.
- It does not draw highlights. Connect `service.on('anchors', …)` to a renderer (see
  [Highlights](../guides/highlights.md)).
- It does not call `refreshAnchors` on DOM mutations. Call it, debounced, when your page changes.
