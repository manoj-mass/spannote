# @spannote/react

React bindings for SpanNote.

```tsx
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';
import { SpanNoteProvider, useAnnotations, useAnchor } from '@spannote/react';

const service = new AnnotationService({ store: new MemoryAnnotationStore() });

export function App() {
  return (
    <SpanNoteProvider service={service}>
      <Comments />
    </SpanNoteProvider>
  );
}

function Comments() {
  const annotations = useAnnotations();
  return (
    <ul>
      {annotations.map((a) => (
        <li key={a.id}>{a.body[0]?.value}</li>
      ))}
    </ul>
  );
}
```

- `useSyncExternalStore` underneath: safe under concurrent rendering and React Strict Mode.
- Server rendering: hooks return empty values on the server, and the provider attaches only in the
  browser.
- Works in Next.js App Router: put the provider in a client component (`'use client'`).
