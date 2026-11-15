# React and Next.js

`@spannote/react` connects an `AnnotationService` to React. The service does the work; the
binding only subscribes to it and attaches it to the page.

## The pattern

1. Create one service per page (or one per application, if the page is the same everywhere).
2. Wrap the part of the tree that displays comments in `SpanNoteProvider`.
3. Read data with hooks.

```tsx
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';
import { SpanNoteProvider, useAnnotations, useAnchor, useAnnotationService } from '@spannote/react';

const service = new AnnotationService({ store: new MemoryAnnotationStore() });

export function App({ children }: { children: React.ReactNode }) {
  return <SpanNoteProvider service={service}>{children}</SpanNoteProvider>;
}
```

Create the service at module scope, not inside a component. Recreating it on every render loses
the state and re-attaches the page.

## SpanNoteProvider

| Prop       | Type                | Default         | Notes                                          |
| ---------- | ------------------- | --------------- | ---------------------------------------------- |
| `service`  | `AnnotationService` | required        | Must be stable across renders                  |
| `root`     | `Node \| null`      | `document.body` | The DOM root to anchor in. Pass a stable node. |
| `children` | `ReactNode`         |                 |                                                |

On mount it calls `service.attach(root)`. On unmount it calls `service.detach()`. Nothing runs on
the server, because the effect only runs in the browser.

Anchoring a sub-tree instead of the page:

```tsx
const articleRef = useRef<HTMLElement>(null);
return (
  <SpanNoteProvider service={service} root={articleRef.current}>
    <article ref={articleRef}>…</article>
  </SpanNoteProvider>
);
```

Because `root` is read in an effect, the first attach may happen after the first render. Prefer
a stable container that exists on mount, such as `document.body` or a `<main>` element you own.

## Hooks

| Hook                     | Returns                                      | Re-renders when             |
| ------------------------ | -------------------------------------------- | --------------------------- |
| `useAnnotationService()` | the service                                  | never (it is stable)        |
| `useAnnotations()`       | `readonly Annotation[]`, sorted by `created` | the annotation list changes |
| `useAnchorStates()`      | `ReadonlyMap<string, AnchorState>`           | any anchor changes          |
| `useAnchor(id)`          | `AnchorState \| undefined`                   | the anchor for `id` changes |

`useAnchor` still re-renders when any anchor changes, because it reads the shared map. Keep
per-item components small if you render many comments.

```tsx
function CommentItem({ id }: { id: string }) {
  const service = useAnnotationService();
  const annotation = useAnnotations().find((a) => a.id === id);
  const anchor = useAnchor(id);
  if (!annotation) return null;
  return (
    <li data-status={anchor?.status ?? 'unknown'}>
      {annotation.body[0]?.value}
      <button onClick={() => void service.remove(id)}>Delete</button>
    </li>
  );
}
```

`useAnnotationService` throws when used outside `SpanNoteProvider`. The error message names the
missing provider, so you will see it during development.

## Loading data

Load once, after the provider mounts:

```tsx
'use client';
import { useEffect } from 'react';
import { service } from '@/lib/annotations';

export function LoadComments() {
  useEffect(() => {
    void service.load();
  }, []);
  return null;
}
```

`load` replaces the list. Calling it twice is safe.

## Next.js App Router

- Put the provider and anything that uses hooks in client components (`'use client'`).
- The service module (`lib/annotations.ts`) has no browser-only code at import time, so it can be
  imported from client components. Do not call `attach` or `load` at module scope on the server.
- Server components can render the static page; comments appear after hydration, when the service
  loads and anchors.
- For a protocol store, keep credentials on the server. Route the protocol through a route handler
  and point the client at the handler, instead of putting tokens in the browser. See
  [Storage](storage.md#server-side-credentials).

```tsx
// app/layout.tsx (server component)
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```tsx
// app/providers.tsx
'use client';
import { useEffect } from 'react';
import { SpanNoteProvider } from '@spannote/react';
import { service } from '@/lib/annotations';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void service.load();
  }, []);
  return <SpanNoteProvider service={service}>{children}</SpanNoteProvider>;
}
```

## Strict Mode and concurrent rendering

The hooks use `useSyncExternalStore`, so they work under Strict Mode's double rendering and under
concurrent features. The provider's effect attaches and detaches once per mount, which Strict Mode
exercises in development. Attaching is idempotent, so this is harmless.

## Vue and Angular

Not yet. The core is framework-free, so bindings are small to write. See the
[roadmap](../../README.md#roadmap).
