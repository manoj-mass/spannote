import { Component, computed, DestroyRef, effect, inject, signal, viewChild } from '@angular/core';
import type { ElementRef } from '@angular/core';
import type { AnchorState, AnnotationService } from '@spannote/core';
import type { Annotation } from '@spannote/model';
import { isVersionConflict } from '@spannote/model';
import { createHighlightRenderer } from '@spannote/render';
import {
  attachSpanNoteRoot,
  injectAnchorStates,
  injectAnnotations,
  injectSpanNote,
} from '@spannote/angular';
import { readConfig } from './config';

function describe(error: unknown): string {
  if (isVersionConflict(error))
    return 'Conflict: someone else changed this comment. Reload and try again.';
  return error instanceof Error ? error.message : String(error);
}

function quoteOf(annotation: Annotation): string {
  const selector = annotation.target.selector.find((s) => s.type === 'TextQuoteSelector');
  return selector?.type === 'TextQuoteSelector' ? selector.exact : '';
}

function findText(root: HTMLElement, needle: string): { node: Text; offset: number } | undefined {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const offset = text.data.indexOf(needle);
    if (offset !== -1) return { node: text, offset };
  }
  return undefined;
}

/** Simulated page changes. Each one edits the article's DOM, and the component then re-resolves anchors. */
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
      text.data = text.data.replace(/ /g, () => (count++ % 3 === 0 ? ' ' : ' '));
    }
  },
};

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  readonly config = readConfig(window.location.search);
  private readonly service: AnnotationService = injectSpanNote();
  readonly annotations = injectAnnotations();
  private readonly anchors = injectAnchorStates();

  private readonly articleRef = viewChild<ElementRef<HTMLElement>>('article');

  readonly message = signal('Loading comments…');
  readonly draft = signal('');
  readonly selection = signal('');
  readonly selectionLabel = computed(() => {
    const text = this.selection();
    return text === '' ? 'none' : `“${text.slice(0, 80)}”`;
  });
  private readonly firstQuote = computed(() => {
    const first = this.annotations()[0];
    return first ? quoteOf(first) : undefined;
  });

  // Focusing the comment box clears the page selection, so keep the last selection inside the article.
  private lastRange: Range | undefined;

  private readonly highlights =
    this.config.renderer === 'mark'
      ? createHighlightRenderer({ environment: {} })
      : createHighlightRenderer();

  constructor() {
    attachSpanNoteRoot(() => this.articleRef()?.nativeElement);
    effect(() => {
      this.paint(this.anchors());
    });

    const onSelectionChange = (): void => {
      this.updateSelection();
    };
    document.addEventListener('selectionchange', onSelectionChange);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('selectionchange', onSelectionChange);
      this.highlights.dispose();
    });

    this.service
      .load()
      .then(() => {
        this.message.set(
          `Loaded ${this.service.annotations.length} comment(s) from the ${this.config.store} store.`,
        );
      })
      .catch((error: unknown) => {
        this.message.set(`Could not load comments: ${String(error)}`);
      });
  }

  stateOf(id: string): AnchorState | undefined {
    return this.anchors().get(id);
  }

  quoteOf(annotation: Annotation): string {
    return quoteOf(annotation);
  }

  onDraftInput(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  commentOnSelection(): void {
    const root = this.articleRef()?.nativeElement;
    const saved = this.lastRange;
    const range =
      this.selectedRange() ??
      (saved && root?.contains(saved.commonAncestorContainer) && !saved.collapsed
        ? saved
        : undefined);
    if (!range) {
      this.message.set('Select some text inside the article first.');
      return;
    }
    if (this.draft().trim() === '') {
      this.message.set('Write a comment first.');
      return;
    }
    void this.attempt('Comment', async () => {
      await this.service.createFromRange(range, { body: this.draft() });
      this.draft.set('');
    });
  }

  reply(annotation: Annotation): void {
    void this.attempt('Reply', () =>
      this.service.reply(annotation, { body: this.draft() || 'Reply' }),
    );
  }

  editComment(annotation: Annotation): void {
    const body = window.prompt('New text', annotation.body[0]?.value ?? '');
    if (body !== null)
      void this.attempt('Edit', () => this.service.update(annotation.id, { body }));
  }

  toggleResolved(annotation: Annotation): void {
    void this.attempt('Toggle resolved', () =>
      this.service.update(annotation.id, {
        status: annotation.status === 'resolved' ? 'open' : 'resolved',
      }),
    );
  }

  remove(annotation: Annotation): void {
    void this.attempt('Delete', () => this.service.remove(annotation.id));
  }

  applyChange(label: string): void {
    const root = this.articleRef()?.nativeElement;
    if (!root) {
      this.message.set('The article is not mounted yet.');
      return;
    }
    changes[label]?.(root, this.firstQuote());
    this.service.refreshAnchors();
    this.message.set(`${label}: anchors re-resolved.`);
  }

  refreshAnchors(): void {
    this.service.refreshAnchors();
    this.message.set('Anchors re-resolved.');
  }

  reloadPage(): void {
    window.location.reload();
  }

  private selectedRange(): Range | undefined {
    const root = this.articleRef()?.nativeElement;
    const current = window.getSelection();
    if (!root || !current || current.rangeCount === 0 || current.isCollapsed) return undefined;
    const range = current.getRangeAt(0);
    return root.contains(range.commonAncestorContainer) ? range : undefined;
  }

  private updateSelection(): void {
    const range = this.selectedRange();
    if (range) this.lastRange = range.cloneRange();
    this.selection.set(range?.toString() ?? '');
  }

  private async attempt(label: string, action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
      this.message.set(`${label}: done.`);
    } catch (error) {
      this.message.set(`${label} failed. ${describe(error)}`);
    }
  }

  private paint(states: ReadonlyMap<string, AnchorState>): void {
    const attached: Range[] = [];
    const fuzzy: Range[] = [];
    for (const state of states.values()) {
      if (!state.range) continue;
      (state.status === 'attached-fuzzy' ? fuzzy : attached).push(state.range);
    }
    this.highlights.draw('comments', attached);
    this.highlights.draw('fuzzy', fuzzy);
  }
}
