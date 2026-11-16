import type { Annotation } from '@spannote/model';
import type { AnnotationService } from '@spannote/core';
import { useAnchorStates, useAnnotations } from '@spannote/react';
import { runAction } from './feedback';

interface CommentsPanelProps {
  readonly service: AnnotationService;
  readonly report: (message: string) => void;
}

function quoteOf(annotation: Annotation): string {
  const selector = annotation.target.selector.find((s) => s.type === 'TextQuoteSelector');
  return selector?.type === 'TextQuoteSelector' ? selector.exact : '';
}

export function CommentsPanel({ service, report }: CommentsPanelProps) {
  const annotations = useAnnotations();
  const anchors = useAnchorStates();

  return (
    <section className="panel" aria-labelledby="comments-heading">
      <h2 id="comments-heading">Comments</h2>
      <p className="hint">Select text in the article, then press Comment next to the selection.</p>

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
                  onClick={() => {
                    const body = window.prompt('Reply', 'Reply');
                    if (body !== null && body.trim() !== '')
                      void runAction(report, 'Reply', () => service.reply(annotation, { body }));
                  }}
                >
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const body = window.prompt('New text', annotation.body[0]?.value ?? '');
                    if (body !== null)
                      void runAction(report, 'Edit', () => service.update(annotation.id, { body }));
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void runAction(report, 'Toggle resolved', () =>
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
                  onClick={() =>
                    void runAction(report, 'Delete', () => service.remove(annotation.id))
                  }
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
