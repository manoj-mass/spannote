import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { injectSpanNote } from '@spannote/angular';
import type { AnnotationService } from '@spannote/core';
import { runAction } from './feedback';
import { selectedRange } from './selection';

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

/**
 * A Google Docs style comment: press Comment next to the selected text, and the comment box opens
 * beside it. The range is saved when Comment is pressed, so typing does not lose the selection.
 */
@Component({
  selector: 'app-selection-composer',
  templateUrl: './selection-composer.html',
})
export class SelectionComposer {
  readonly article = input<HTMLElement | undefined>();
  readonly status = output<string>();

  private readonly service: AnnotationService = injectSpanNote();
  private readonly injector = inject(Injector);
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  private readonly selected = signal<Range | undefined>(undefined);
  readonly pending = signal<Range | undefined>(undefined);
  readonly draft = signal('');
  // Changing this on scroll or resize re-measures the buttons, so they follow the text.
  private readonly frame = signal(0);

  readonly trigger = computed(() => (this.pending() ? undefined : this.selected()));
  readonly box = computed(() => {
    void this.frame();
    const range = this.pending() ?? this.trigger();
    return range?.getBoundingClientRect();
  });
  readonly left = computed(() => {
    const rect = this.box();
    return rect ? Math.max(8, Math.min(rect.left, window.innerWidth - COMPOSER_WIDTH - 8)) : 0;
  });
  readonly quote = computed(() => this.pending()?.toString().slice(0, 120) ?? '');

  constructor() {
    const onSelectionChange = (): void => {
      this.selected.set(selectedRange(this.article())?.cloneRange());
    };
    const onMove = (): void => {
      this.frame.update((n) => n + 1);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    });

    effect((onCleanup) => {
      showPending(this.pending());
      onCleanup(() => {
        showPending(undefined);
      });
    });
  }

  startComment(): void {
    const range = this.trigger();
    if (!range) return;
    this.pending.set(range);
    afterNextRender(
      () => {
        this.textarea()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  onDraftInput(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  close(): void {
    this.pending.set(undefined);
    this.draft.set('');
  }

  save(): void {
    const range = this.pending();
    if (!range) return;
    if (this.draft().trim() === '') {
      this.status.emit('Write a comment first.');
      return;
    }
    void runAction(
      (message) => {
        this.status.emit(message);
      },
      'Comment',
      async () => {
        await this.service.createFromRange(range, { body: this.draft() });
        this.close();
      },
    );
  }
}
