# Vue

This guide shows how to add comments to a Vue 3 application with `@spannote/vue`. The reference is
[the Vue API page](../api/vue.md). A working example is in `apps/demo-vue`.

## 1. Install

```bash
npm install @spannote/core @spannote/vue @spannote/render
```

Vue `^3.4.0` must already be installed.

## 2. Create the service and install the plugin

```ts
// src/main.ts
import { createApp } from 'vue';
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';
import { SpanNotePlugin } from '@spannote/vue';
import App from './App.vue';

const service = new AnnotationService({ store: new MemoryAnnotationStore() });
createApp(App).use(SpanNotePlugin, { service }).mount('#app');
```

## 3. Anchor the article

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useSpanNoteRoot } from '@spannote/vue';

const article = ref<HTMLElement | null>(null);
useSpanNoteRoot(article);
</script>

<template>
  <article ref="article" v-once>
    <p>Across the base, 12% of users churn each quarter.</p>
  </article>
</template>
```

`v-once` keeps Vue from patching the article, which matters if your code also edits its DOM.

## 4. Create a comment from a selection

Keep the last selection inside the article, because focusing a text box clears the page selection:

```ts
const article = ref<HTMLElement | null>(null);
let lastRange: Range | undefined;

document.addEventListener('selectionchange', () => {
  const range = window.getSelection()?.getRangeAt(0);
  if (range && article.value?.contains(range.commonAncestorContainer) && !range.collapsed) {
    lastRange = range.cloneRange();
  }
});

async function submit(body: string) {
  if (lastRange) await service.createFromRange(lastRange, { body });
}
```

`useAnnotationService()` gives you `service` inside a component.

## 5. List the comments

```vue
<script setup lang="ts">
import { useAnchorStates, useAnnotations } from '@spannote/vue';

const annotations = useAnnotations();
const anchors = useAnchorStates();
</script>

<template>
  <ul>
    <li v-for="a in annotations" :key="a.id" :data-status="anchors.get(a.id)?.status ?? 'unknown'">
      {{ a.body[0]?.value }}
    </li>
  </ul>
</template>
```

## 6. Draw the highlights

See [the highlight example](../api/vue.md#highlights).

## Pitfalls

- **Calling a composable outside `setup()`** throws. Move the call into `setup()` or into another composable.
- **Missing plugin:** the error says `needs app.use(SpanNotePlugin, { service })`. Install the plugin on the
  same app that renders the component.
- **Two apps on one page** each need their own service, or the second one replaces the first.
- **Reactive props used as ids:** pass a getter to `useAnchor(() => props.id)` so the composable follows the
  prop.
