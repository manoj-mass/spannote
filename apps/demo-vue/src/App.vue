<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import type { AnchorState, AnnotationService } from '@spannote/core';
import type { Annotation } from '@spannote/model';
import { createHighlightRenderer } from '@spannote/render';
import {
  useAnchorStates,
  useAnnotations,
  useAnnotationService,
  useSpanNoteRoot,
} from '@spannote/vue';
import SelectionComposer from './SelectionComposer.vue';
import { runAction } from './feedback';
import { readConfig } from './service';

const config = readConfig(window.location.search);
const service: AnnotationService = useAnnotationService();
const annotations = useAnnotations();
const anchors = useAnchorStates();

const article = ref<HTMLElement | null>(null);
useSpanNoteRoot(article);

const message = ref('Loading comments…');

function attempt(label: string, action: () => Promise<unknown>): Promise<void> {
  return runAction(
    (text) => {
      message.value = text;
    },
    label,
    action,
  );
}

function quoteOf(annotation: Annotation): string {
  const selector = annotation.target.selector.find((s) => s.type === 'TextQuoteSelector');
  return selector?.type === 'TextQuoteSelector' ? selector.exact : '';
}

function stateOf(id: string): AnchorState | undefined {
  return anchors.value.get(id);
}

function replyTo(annotation: Annotation): void {
  const body = window.prompt('Reply', 'Reply');
  if (body !== null && body.trim() !== '')
    void attempt('Reply', () => service.reply(annotation, { body }));
}

function editComment(annotation: Annotation): void {
  const body = window.prompt('New text', annotation.body[0]?.value ?? '');
  if (body !== null) void attempt('Edit', () => service.update(annotation.id, { body }));
}

function toggleResolved(annotation: Annotation): void {
  void attempt('Toggle resolved', () =>
    service.update(annotation.id, {
      status: annotation.status === 'resolved' ? 'open' : 'resolved',
    }),
  );
}

// ----- Highlights: draw from the anchor states, with the renderer chosen by the URL.
const highlights =
  config.renderer === 'mark'
    ? createHighlightRenderer({ environment: {} })
    : createHighlightRenderer();

function paint(): void {
  const attached: Range[] = [];
  const fuzzy: Range[] = [];
  for (const state of anchors.value.values()) {
    if (!state.range) continue;
    (state.status === 'attached-fuzzy' ? fuzzy : attached).push(state.range);
  }
  highlights.draw('comments', attached);
  highlights.draw('fuzzy', fuzzy);
}
watch(anchors, paint, { immediate: true });
onUnmounted(() => highlights.dispose());

// ----- Load once, after the component mounts.
void service
  .load()
  .then(() => {
    message.value = `Loaded ${service.annotations.length} comment(s) from the ${config.store} store.`;
  })
  .catch((error: unknown) => {
    message.value = `Could not load comments: ${String(error)}`;
  });

// ----- Simulated page changes. Each one edits the article's DOM, then re-resolves the anchors.
const firstQuote = computed(() => {
  const first = annotations.value[0];
  return first ? quoteOf(first) : undefined;
});

function findText(root: HTMLElement, needle: string): { node: Text; offset: number } | undefined {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const offset = text.data.indexOf(needle);
    if (offset !== -1) return { node: text, offset };
  }
  return undefined;
}

const changes: Record<string, (root: HTMLElement, quote: string | undefined) => void> = {
  'Insert ad': (root) => {
    const ad = document.createElement('aside');
    ad.className = 'demo-ad';
    ad.textContent = 'Sponsored: a banner inserted inside the article.';
    const before = root.querySelectorAll('p')[1];
    before?.parentNode?.insertBefore(ad, before);
  },
  'Wrap content': (root) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'demo-wrap';
    while (root.firstChild) wrapper.appendChild(root.firstChild);
    root.appendChild(wrapper);
  },
  'Reword first quote': (root, quote) => {
    if (!quote) return;
    const hit = findText(root, quote);
    if (hit) hit.node.insertData(hit.offset + 5, ' (updated) ');
  },
  'Duplicate quote': (root, quote) => {
    if (!quote) return;
    const copy = document.createElement('p');
    copy.className = 'demo-duplicate';
    copy.textContent = quote;
    root.appendChild(copy);
  },
  'Non-breaking spaces': (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let count = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text;
      text.data = text.data.replace(/ /g, () => (count++ % 3 === 0 ? ' ' : ' '));
    }
  },
};

function reloadPage(): void {
  window.location.reload();
}

function applyChange(label: string): void {
  const root = article.value;
  if (!root) {
    message.value = 'The article is not mounted yet.';
    return;
  }
  changes[label]?.(root, firstQuote.value);
  service.refreshAnchors();
  message.value = `${label}: anchors re-resolved.`;
}
</script>

<template>
  <header class="page-header">
    <h1>SpanNote demo (Vue)</h1>
    <p class="hint" data-testid="status">{{ message }}</p>
    <p class="hint">
      Store: <code>{{ config.store }}</code> · Renderer: <code>{{ config.renderer }}</code>
    </p>
  </header>

  <SelectionComposer :article="article" :service="service" @status="message = $event" />

  <main class="layout">
    <!-- v-once: the article is static, so the page-change buttons can edit its DOM safely. -->
    <article ref="article" v-once class="article" data-testid="article">
      <h1>Pricing review</h1>
      <p>Across the base, 12% of users churn each quarter after the first renewal.</p>
      <p>Students can use annotations to refer back to key passages in a long document.</p>
      <p>
        Priced items may repeat across the catalogue, so a quote needs its context to be found
        again.
      </p>
      <p>Spacing matters here: these words have extra spaces, and this one&nbsp;is joined.</p>
    </article>

    <aside class="sidebar">
      <section class="panel" aria-labelledby="comments-heading">
        <h2 id="comments-heading">Comments</h2>
        <p class="hint">Select text in the article, then press Comment next to the selection.</p>

        <ul class="comment-list" data-testid="comment-list">
          <li
            v-for="annotation in annotations"
            :key="annotation.id"
            class="comment"
            data-testid="comment-item"
            :data-status="stateOf(annotation.id)?.status ?? 'unknown'"
          >
            <blockquote>{{ quoteOf(annotation) }}</blockquote>
            <p class="comment-body">{{ annotation.body[0]?.value }}</p>
            <p class="meta">
              <span
                data-testid="anchor-status"
                :data-status="stateOf(annotation.id)?.status ?? 'unknown'"
              >
                {{ stateOf(annotation.id)?.status ?? 'unknown' }}
              </span>
              <template v-if="stateOf(annotation.id)?.strategy">
                · {{ stateOf(annotation.id)?.strategy }}
              </template>
              <template v-if="annotation.status"> · {{ annotation.status }}</template>
            </p>
            <div class="button-row">
              <button type="button" @click="replyTo(annotation)">Reply</button>
              <button type="button" @click="editComment(annotation)">Edit</button>
              <button type="button" @click="toggleResolved(annotation)">Resolve</button>
              <button type="button" @click="attempt('Delete', () => service.remove(annotation.id))">
                Delete
              </button>
            </div>
          </li>
        </ul>
        <p v-if="annotations.length === 0" class="hint">No comments yet.</p>
      </section>

      <section class="panel" aria-labelledby="page-changes-heading">
        <h2 id="page-changes-heading">Simulate page changes</h2>
        <p class="hint">Each button changes the article, then re-resolves every anchor.</p>
        <div class="button-row">
          <button type="button" @click="applyChange('Insert ad')">Insert ad</button>
          <button type="button" @click="applyChange('Wrap content')">Wrap content</button>
          <button type="button" @click="applyChange('Reword first quote')">
            Reword first quote
          </button>
          <button type="button" @click="applyChange('Duplicate quote')">Duplicate quote</button>
          <button type="button" @click="applyChange('Non-breaking spaces')">
            Non-breaking spaces
          </button>
          <button
            type="button"
            @click="
              service.refreshAnchors();
              message = 'Anchors re-resolved.';
            "
          >
            Refresh anchors
          </button>
          <button type="button" @click="reloadPage">Reload page</button>
        </div>
      </section>
    </aside>
  </main>
</template>
