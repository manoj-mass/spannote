# Architecture

## Layers

```
          @spannote/react            (binding: provider, hooks)
                  │
          @spannote/core             (service: list, anchors, events)
            │             │
  @spannote/anchor   @spannote/model        (locating · data model and ports)
            │                     ▲
  @spannote/render     @spannote/protocol   (drawing · HTTP adapter)
```

Dependencies point inward. `model` depends on nothing. `core` depends on `model` and `anchor`,
and never on `protocol` or `react`. Adapters implement ports declared in `model`.

## SOLID mapping

**Single Responsibility.** Each package has one reason to change:

- `model` changes when the W3C data model changes.
- `anchor` changes when the way ranges are located changes.
- `render` changes when the highlight mechanism changes.
- `protocol` changes when the HTTP protocol changes.
- `core` changes when the annotation workflow changes.
- `react` changes when React's APIs change.

Within `anchor`, each resolver (`PositionResolver`, `QuoteResolver`, `FuzzyResolver`) does one
thing and can be tested alone.

**Open/Closed.** `AnchorEngine` runs a list of `Resolver`s. Add a strategy by passing a new
resolver; the engine does not change. `createHighlightRenderer` chooses the renderer by
capability, so a new renderer is a new class plus one line in the factory.

**Liskov Substitution.** Every `AnnotationStore` must behave the same way: `update` and `remove`
reject a stale version with a conflict (`isVersionConflict` recognises both the model's
`VersionConflictError` and HTTP 412). `MemoryAnnotationStore` and `ProtocolAnnotationStore` honour
this, so the service works with either.

**Interface Segregation.** Interfaces are small: `Resolver` has one method, `HighlightRenderer`
has three, `AnnotationStore` has four. `HighlightRegistry` exposes only the two `CSS.highlights`
methods the renderer uses.

**Dependency Inversion.** `AnnotationService` depends on the `AnnotationStore` port and an
`AnchorEngine` it receives. Tests inject a memory store, a fixed clock and a fixed id source. The
protocol client receives its `fetch` and header provider. The React provider receives the service.

## Key decisions and why

- **Two text models.** TextPosition uses the raw model and code points, because the spec counts
  code points and other implementations agree on that. TextQuote uses a normalized model, because
  it has to survive reflow and non-breaking spaces. Both are measured in the spike.
- **Positions verified against quotes.** `PositionResolver` returns nothing when no quote is
  available. This rule came from the wrong attachments the spike found in the ad case.
- **Snapshots, not live indices.** `AnchorEngine.snapshot(root)` builds the text indices once per
  DOM state. Resolving 500 annotations reuses them, which is why it takes about a millisecond.
  The caller decides when the DOM has changed.
- **Immutable published state.** The service replaces its annotation list and anchor map on every
  change, so `useSyncExternalStore` can compare by reference.
- **Errors as values for untrusted input.** `parseAnnotation` never throws. Store and protocol
  failures throw typed errors, because callers must handle them.

## What is not here yet

- Revision-aware re-anchoring for edits inside a quote.
- Vue and Angular bindings.
- A shared contract test suite that every `AnnotationStore` adapter must pass.
- Image, video and PDF selectors.
