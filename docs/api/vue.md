# @spannote/vue

Vue 3 bindings: a plugin that provides the annotation service, composables that read its state, and a
composable that attaches it to a DOM root.

```ts
import {
  SpanNotePlugin,
  SPANNOTE_SERVICE_KEY,
  useAnnotationService,
  useAnnotations,
  useAnchorStates,
  useAnchor,
  useSpanNoteRoot,
  type SpanNotePluginOptions,
} from '@spannote/vue';
```

Requires Vue `^3.4.0`. The package has no runtime dependency on Vue, so the application's Vue is the one
used.

## SpanNotePlugin

```ts
const SpanNotePlugin: Plugin<[SpanNotePluginOptions]>;

interface SpanNotePluginOptions {
  service: AnnotationService; // create once, outside any component
}
```

Install it once, when the application starts:

```ts
import { createApp } from 'vue';
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';
import { SpanNotePlugin } from '@spannote/vue';

const service = new AnnotationService({ store: new MemoryAnnotationStore() });
createApp(App).use(SpanNotePlugin, { service }).mount('#app');
```

The plugin provides the service under `SPANNOTE_SERVICE_KEY` (an `InjectionKey<AnnotationService>`). Use
the key with `inject()` if you prefer to read it directly.

## Composables

All composables must be called inside `setup()` or another composable. Each one throws a clear error when
the plugin is not installed.

### useAnnotationService()

```ts
function useAnnotationService(): AnnotationService;
```

Returns the service, for calls such as `createFromRange`, `reply`, `update` and `remove`.

### useAnnotations()

```ts
function useAnnotations(): ComputedRef<readonly Annotation[]>;
```

The current annotations, sorted by `created`. The value changes when the service emits `change`.

### useAnchorStates()

```ts
function useAnchorStates(): ComputedRef<ReadonlyMap<string, AnchorState>>;
```

The anchor state of every annotation. The value changes when the service emits `anchors`.

### useAnchor(annotationId)

```ts
function useAnchor(annotationId: MaybeRefOrGetter<string>): ComputedRef<AnchorState | undefined>;
```

The anchor state of one annotation. Pass a getter (`() => props.id`) when the id can change, so the
composable follows it.

### useSpanNoteRoot(root)

```ts
function useSpanNoteRoot(root: MaybeRefOrGetter<Node | null | undefined>): void;
```

Attaches the service to `root` immediately, re-attaches when the value changes, and detaches when the
component's scope ends. A `null` root detaches the service.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useSpanNoteRoot } from '@spannote/vue';

const article = ref<HTMLElement | null>(null);
useSpanNoteRoot(article);
</script>

<template>
  <article ref="article">…</article>
</template>
```

## Highlights

The composables do not draw highlights. Draw them from `useAnchorStates()` with
`@spannote/render`, as the demo does:

```ts
const anchors = useAnchorStates();
const highlights = createHighlightRenderer();
watch(
  anchors,
  () => {
    const ranges = [...anchors.value.values()].flatMap((s) => (s.range ? [s.range] : []));
    highlights.draw('comments', ranges);
  },
  { immediate: true },
);
onUnmounted(() => highlights.dispose());
```

## Keeping the article static

Vue patches the DOM it renders. If you edit the article's DOM directly, as the demo's page-change buttons
do, mark the article `v-once` so Vue never patches it. Otherwise Vue may overwrite your change or fail to
find its own nodes.

## Server rendering (Nuxt)

The composables read the service on the server, where it has no DOM. `useSpanNoteRoot` attaches only in
the browser: it runs in `watch` with a root that is `null` on the server. Keep the service a module-level
singleton only if the server does not share it between requests. For Nuxt, create the service in a plugin
per request, and install `SpanNotePlugin` there.

## Measured behaviour

The Vue demo passes the same six browser scenarios as the React demo (`npm run demo:smoke` with
`DEMO_URL` pointing at the Vue demo). See [the demo guide](../guides/demo.md).
