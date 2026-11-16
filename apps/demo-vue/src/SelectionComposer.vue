<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, shallowRef, watch } from 'vue';
import type { AnnotationService } from '@spannote/core';
import { runAction } from './feedback';
import { selectedRange } from './selection';

const props = defineProps<{
  article: HTMLElement | null;
  service: AnnotationService;
}>();
const emit = defineEmits<{ status: [message: string] }>();

/** Highlight group for the text a new comment is about. It is separate from the saved comments. */
const PENDING_GROUP = 'spannote-pending';
const COMPOSER_WIDTH = 320;

/**
 * Keeps the range visible while the comment box is open. A CSS highlight does not change the DOM,
 * and it stays drawn after focus moves to the textarea, which clears the page selection.
 */
function showPending(range: Range | undefined): void {
  if (!('highlights' in CSS)) return;
  if (range) CSS.highlights.set(PENDING_GROUP, new Highlight(range));
  else CSS.highlights.delete(PENDING_GROUP);
}

const selected = shallowRef<Range | undefined>(undefined);
const pending = shallowRef<Range | undefined>(undefined);
const draft = ref('');
// Changing this on scroll or resize re-measures the buttons, so they follow the text.
const frame = ref(0);
const textarea = ref<HTMLTextAreaElement | null>(null);

const trigger = computed(() => (pending.value ? undefined : selected.value));
const box = computed(() => {
  void frame.value;
  const range = pending.value ?? trigger.value;
  return range?.getBoundingClientRect();
});
const left = computed(() => {
  const rect = box.value;
  return rect ? Math.max(8, Math.min(rect.left, window.innerWidth - COMPOSER_WIDTH - 8)) : 0;
});
const quote = computed(() => pending.value?.toString().slice(0, 120) ?? '');

function onSelectionChange(): void {
  selected.value = selectedRange(props.article)?.cloneRange();
}
function onMove(): void {
  frame.value += 1;
}
document.addEventListener('selectionchange', onSelectionChange);
window.addEventListener('scroll', onMove, true);
window.addEventListener('resize', onMove);
onUnmounted(() => {
  document.removeEventListener('selectionchange', onSelectionChange);
  window.removeEventListener('scroll', onMove, true);
  window.removeEventListener('resize', onMove);
  showPending(undefined);
});

watch(pending, (range) => {
  showPending(range);
  if (range) void nextTick(() => textarea.value?.focus());
});

function startComment(): void {
  if (trigger.value) pending.value = trigger.value;
}

function close(): void {
  pending.value = undefined;
  draft.value = '';
}

function save(): void {
  const range = pending.value;
  if (!range) return;
  if (draft.value.trim() === '') {
    emit('status', 'Write a comment first.');
    return;
  }
  void runAction(
    (message) => emit('status', message),
    'Comment',
    async () => {
      await props.service.createFromRange(range, { body: draft.value });
      close();
    },
  );
}
</script>

<template>
  <button
    v-if="trigger && box"
    type="button"
    class="selection-trigger"
    data-testid="selection-comment"
    :style="{ top: `${box.bottom + 6}px`, left: `${box.left}px` }"
    @mousedown="(event) => event.preventDefault()"
    @click="startComment"
  >
    Comment
  </button>

  <section
    v-if="pending && box"
    class="composer"
    role="dialog"
    aria-label="New comment"
    data-testid="composer"
    :style="{ top: `${box.bottom + 8}px`, left: `${left}px` }"
  >
    <blockquote>{{ quote }}</blockquote>
    <textarea
      ref="textarea"
      v-model="draft"
      data-testid="comment-input"
      aria-label="Comment text"
      rows="3"
      placeholder="Write a comment"
      @keydown.esc="close"
    />
    <div class="button-row">
      <button type="button" data-testid="comment-submit" @click="save">Save comment</button>
      <button type="button" @click="close">Cancel</button>
    </div>
  </section>
</template>
