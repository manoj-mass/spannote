import { Component, computed, DestroyRef, effect, inject, signal, viewChild } from '@angular/core';
import type { ElementRef } from '@angular/core';
import type { AnchorState, AnnotationService } from '@spannote/core';
import type { Annotation } from '@spannote/model';
import { createHighlightRenderer } from '@spannote/render';
import {
  attachSpanNoteRoot,
  injectAnchorStates,
  injectAnnotations,
  injectSpanNote,
} from '@spannote/angular';
import { runAction } from './feedback';
import { readConfig } from './config';
import { SelectionComposer } from './selection-composer';

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
      text.data = text.data.replace(/ /g, () => (count++ % 3 === 0 ? ' ' : ' '));
    }
  },
};

@Component({
  selector: 'app-root',
  imports: [SelectionComposer],
  templateUrl: './app.html',
})
export class App {
  readonly config = readConfig(window.location.search);
  private readonly service: AnnotationService = injectSpanNote();
  readonly annotations = injectAnnotations();
  private readonly anchors = injectAnchorStates();

  private readonly articleRef = viewChild<ElementRef<HTMLElement>>('article');
  readonly articleElement = computed(() => this.articleRef()?.nativeElement);

  readonly message = signal('Loading comments…');
  private readonly firstQuote = computed(() => {
    const first = this.annotations()[0];
    return first ? quoteOf(first) : undefined;
  });

  private readonly highlights =
    this.config.renderer === 'mark'
      ? createHighlightRenderer({ environment: {} })
      : createHighlightRenderer();

  constructor() {
    attachSpanNoteRoot(() => this.articleRef()?.nativeElement);
    effect(() => {
      this.paint(this.anchors());
    });

    inject(DestroyRef).onDestroy(() => {
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

  reply(annotation: Annotation): void {
    const body = window.prompt('Reply', 'Reply');
    if (body !== null && body.trim() !== '')
      void this.attempt('Reply', () => this.service.reply(annotation, { body }));
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

  private attempt(label: string, action: () => Promise<unknown>): Promise<void> {
    return runAction(
      (text) => {
        this.message.set(text);
      },
      label,
      action,
    );
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
