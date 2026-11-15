# @spannote/core

The annotation service. It has no framework and no HTTP dependency.

- `AnnotationService` owns the annotation list, resolves anchors against the page, and writes
  through a store port (`AnnotationStore`, from `@spannote/model`).
- Typed events: `change` (annotations) and `anchors` (anchor state per annotation).
- `MemoryAnnotationStore` for tests and offline use. Adapters such as `@spannote/protocol`
  implement the same port.

```ts
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';

const service = new AnnotationService({ store: new MemoryAnnotationStore() });
service.on('anchors', (states) => console.log(states));
service.attach(document.body);
await service.load();

const range = window.getSelection()!.getRangeAt(0);
await service.createFromRange(range, { body: 'Which quarter is this?' });
```

Anchors are valid for one DOM state. Call `refreshAnchors()` after the page changes.
