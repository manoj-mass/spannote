# @spannote/vue

Vue 3 bindings for SpanNote: a plugin that provides the annotation service, composables that read its
state, and a composable that attaches the service to a DOM root.

```ts
import { createApp } from 'vue';
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';
import { SpanNotePlugin, useAnnotations } from '@spannote/vue';

const service = new AnnotationService({ store: new MemoryAnnotationStore() });
createApp(App).use(SpanNotePlugin, { service }).mount('#app');
```

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useAnnotations, useSpanNoteRoot } from '@spannote/vue';

const article = ref<HTMLElement | null>(null);
useSpanNoteRoot(article);
const annotations = useAnnotations();
</script>

<template>
  <article ref="article" v-once>…</article>
  <ul>
    <li v-for="a in annotations" :key="a.id">{{ a.body[0]?.value }}</li>
  </ul>
</template>
```

- Requires Vue `^3.4.0`. The package does not bundle Vue; your application's Vue is used.
- Composables must be called inside `setup()` or another composable. They throw a clear error otherwise.
- `useAnchor(() => id)` follows an id that changes, such as a prop.
- Draw highlights from `useAnchorStates()` with `@spannote/render`.

Full reference and a guide: [docs/api/vue.md](https://github.com/manoj-mass/spannote/blob/main/docs/api/vue.md)
and [docs/guides/vue.md](https://github.com/manoj-mass/spannote/blob/main/docs/guides/vue.md).
