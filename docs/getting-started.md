# Getting started

This guide takes you from nothing to a working comment feature. It uses the in-memory store, so
you need no server. Later guides cover the W3C protocol store.

## Install

```bash
npm install @spannote/core @spannote/react
```

`@spannote/core` brings `@spannote/anchor` and `@spannote/model` with it. Install
`@spannote/render` if you want highlights, and `@spannote/protocol` if you want to store
comments on a server.

Requirements: Node 20.19 or later for tooling. In the browser, any evergreen browser with the DOM
`Range` API (Chrome, Edge, Firefox, Safari). React 18.2 or 19 for the React binding.

## Step 1: create the service

The service owns the annotations and the anchors. Create it once, outside any component.

```ts
// lib/annotations.ts
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';

export const annotations = new AnnotationService({
  store: new MemoryAnnotationStore(),
  creator: { type: 'Person', id: 'https://example.org/users/ana', name: 'Ana' },
});
```

`creator` is written on every annotation you create. Leave it out if you don't know the user yet.

## Step 2: attach the page and load

```ts
annotations.attach(document.body); // anchors are resolved inside this node
await annotations.load(); // reads the store, then resolves anchors
```

`attach` tells the service which DOM root to anchor in. Every annotation's text must be inside
this root, and the same root must be used when creating and resolving anchors.

## Step 3: create a comment from a selection

```ts
const selection = window.getSelection();
const range = selection?.getRangeAt(0);
if (range && !range.collapsed) {
  const created = await annotations.createFromRange(range, { body: 'Which quarter is this?' });
  console.log(created.id, annotations.anchors.get(created.id)?.status); // "attached"
}
```

`createFromRange` describes the range with a text quote and a text position, saves the
annotation, and re-resolves all anchors. It throws `EmptySelectionError` when the range covers no
text, and an `Error` when no root is attached.

## Step 4: show the comments in React

```tsx
// app/page.tsx (or any client component)
'use client';

import { SpanNoteProvider, useAnnotations } from '@spannote/react';
import { annotations } from '@/lib/annotations';

export function Comments() {
  const list = useAnnotations();
  return (
    <ul>
      {list.map((a) => (
        <li key={a.id}>{a.body[0]?.value}</li>
      ))}
    </ul>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <SpanNoteProvider service={annotations}>{children}</SpanNoteProvider>;
}
```

`SpanNoteProvider` attaches the service to `document.body` while it is mounted. Read
[React and Next.js](guides/react-and-nextjs.md) for server rendering and the App Router.

## Step 5: draw the highlights

The service knows where each annotation is. It does not draw anything. Connect the two:

```ts
import { createHighlightRenderer } from '@spannote/render';

const renderer = createHighlightRenderer();
annotations.on('anchors', (anchors) => {
  const ranges = [...anchors.values()].flatMap((a) => (a.range ? [a.range] : []));
  renderer.draw('comments', ranges);
});
```

```css
::highlight(spannote-comments) {
  background-color: rgb(255 230 0 / 0.45);
}
```

See [Highlights](guides/highlights.md) for fallbacks and styling.

## Next steps

- Store comments on a server: [Storage](guides/storage.md).
- Understand what happens when the page changes: [Concepts](concepts.md).
- Write tests for your integration: [Testing](guides/testing.md).
