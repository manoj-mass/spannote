import { useEffect, useRef, useState } from 'react';
import type { Annotation } from '@spannote/model';
import { isVersionConflict } from '@spannote/model';
import type { AnnotationService } from '@spannote/core';
import { useAnchorStates, useAnnotations } from '@spannote/react';

interface CommentsPanelProps {
  readonly article: HTMLElement | null;
  readonly service: AnnotationService;
  readonly report: (message: string) => void;
}

/** The selection, if it lies inside the article. */
function selectedRange(article: HTMLElement | null): Range | undefined {
  const selection = window.getSelection();
  if (!article || !selection || selection.rangeCount === 0 || selection.isCollapsed)
    return undefined;
  const range = selection.getRangeAt(0);
  return article.contains(range.commonAncestorContainer) ? range : undefined;
}

function quoteOf(annotation: Annotation): string {
  const selector = annotation.target.selector.find((s) => s.type === 'TextQuoteSelector');
  return selector?.type === 'TextQuoteSelector' ? selector.exact : '';
}

function describeError(error: unknown): string {
  if (isVersionConflict(error))
    return 'Conflict: someone else changed this comment. Reload and try again.';
  return error instanceof Error ? error.message : String(error);
}

export function CommentsPanel({ article, service, report }: CommentsPanelProps) {
  const annotations = useAnnotations();
  const anchors = useAnchorStates();
  const [draft, setDraft] = useState('');
  const [selection, setSelection] = useState('');
  // Focusing the comment box clears the page selection, so keep the last selection inside the article.
  const lastRange = useRef<Range | undefined>(undefined);

  useEffect(() => {
    const update = (): void => {
      const range = selectedRange(article);
      if (range) lastRange.current = range.cloneRange();
      setSelection(range?.toString() ?? '');
    };
    document.addEventListener('selectionchange', update);
    return () => {
      document.removeEventListener('selectionchange', update);
    };
  }, [article]);

  const attempt = async (label: string, action: () => Promise<unknown>): Promise<void> => {
    try {
      await action();
      report(`${label}: done.`);
    } catch (error) {
      report(`${label} failed. ${describeError(error)}`);
    }
  };

  const commentOnSelection = (): void => {
    const saved = lastRange.current;
    const range =
      selectedRange(article) ??
      (saved && article?.contains(saved.commonAncestorContainer) && !saved.collapsed
        ? saved
        : undefined);
    if (!range) {
      report('Select some text inside the article first.');
      return;
    }
    if (draft.trim() === '') {
      report('Write a comment first.');
      return;
    }
    void attempt('Comment', async () => {
      await service.createFromRange(range, { body: draft });
      setDraft('');
    });
  };

  return (
    <section className="panel" aria-labelledby="comments-heading">
      <h2 id="comments-heading">Comments</h2>

      <p className="hint" data-testid="selection-preview">
        Selection: {selection === '' ? 'none' : `“${selection.slice(0, 80)}”`}
      </p>

      <textarea
        data-testid="comment-input"
        aria-label="Comment text"
        rows={3}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        placeholder="Write a comment, then select text in the article and press Comment on selection."
      />
      <div className="button-row">
        <button type="button" data-testid="comment-submit" onClick={commentOnSelection}>
          Comment on selection
        </button>
      </div>

      <ul className="comment-list" data-testid="comment-list">
        {annotations.map((annotation) => {
          const state = anchors.get(annotation.id);
          const status = state?.status ?? 'unknown';
          return (
            <li
              key={annotation.id}
              className="comment"
              data-testid="comment-item"
              data-status={status}
            >
              <blockquote>{quoteOf(annotation)}</blockquote>
              <p className="comment-body">{annotation.body[0]?.value}</p>
              <p className="meta">
                <span data-testid="anchor-status" data-status={status}>
                  {status}
                </span>
                {state?.strategy ? ` · ${state.strategy}` : ''}
                {state?.score !== undefined && state.strategy === 'fuzzy'
                  ? ` · ${state.score.toFixed(2)}`
                  : ''}
                {annotation.status ? ` · ${annotation.status}` : ''}
              </p>
              <div className="button-row">
                <button
                  type="button"
                  onClick={() =>
                    void attempt('Reply', () =>
                      service.reply(annotation, { body: draft || 'Reply' }),
                    )
                  }
                >
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const body = window.prompt('New text', annotation.body[0]?.value ?? '');
                    if (body !== null)
                      void attempt('Edit', () => service.update(annotation.id, { body }));
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void attempt('Toggle resolved', () =>
                      service.update(annotation.id, {
                        status: annotation.status === 'resolved' ? 'open' : 'resolved',
                      }),
                    )
                  }
                >
                  Resolve
                </button>
                <button
                  type="button"
                  onClick={() => void attempt('Delete', () => service.remove(annotation.id))}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {annotations.length === 0 ? <p className="hint">No comments yet.</p> : null}
    </section>
  );
}
