import { useEffect, useState } from 'react';
import type { AnnotationService } from '@spannote/core';
import { runAction } from './feedback';
import { selectedRange } from './selection';

interface SelectionComposerProps {
  readonly article: HTMLElement | null;
  readonly service: AnnotationService;
  readonly report: (message: string) => void;
}

/** Highlight group for the text a new comment is about. It is separate from the saved comments. */
const PENDING_GROUP = 'spannote-pending';
const COMPOSER_WIDTH = 320;

/**
 * Keeps the range visible while the comment box is open. A CSS highlight does not change the
 * DOM, and it stays drawn after focus moves to the textarea, which clears the page selection.
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
export function SelectionComposer({ article, service, report }: SelectionComposerProps) {
  const [selected, setSelected] = useState<Range | undefined>(undefined);
  const [pending, setPending] = useState<Range | undefined>(undefined);
  const [draft, setDraft] = useState('');
  // Re-rendering on scroll moves the buttons with the text.
  const [, setFrame] = useState(0);

  useEffect(() => {
    const onSelectionChange = (): void => {
      setSelected(selectedRange(article)?.cloneRange());
    };
    const onMove = (): void => {
      setFrame((frame) => frame + 1);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [article]);

  useEffect(() => {
    showPending(pending);
    return () => {
      showPending(undefined);
    };
  }, [pending]);

  const trigger = pending ? undefined : selected;
  const anchor = pending ?? trigger;
  const rect = anchor?.getBoundingClientRect();

  const close = (): void => {
    setPending(undefined);
    setDraft('');
  };

  const save = (): void => {
    if (!pending) return;
    if (draft.trim() === '') {
      report('Write a comment first.');
      return;
    }
    void runAction(report, 'Comment', async () => {
      await service.createFromRange(pending, { body: draft });
      close();
    });
  };

  const left = rect ? Math.max(8, Math.min(rect.left, window.innerWidth - COMPOSER_WIDTH - 8)) : 0;

  return (
    <>
      {trigger && rect ? (
        <button
          type="button"
          className="selection-trigger"
          data-testid="selection-comment"
          style={{ top: rect.bottom + 6, left: rect.left }}
          // Keeps the page selection while the button is pressed.
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => {
            setPending(trigger);
          }}
        >
          Comment
        </button>
      ) : null}

      {pending && rect ? (
        <section
          className="composer"
          role="dialog"
          aria-label="New comment"
          data-testid="composer"
          style={{ top: rect.bottom + 8, left }}
        >
          <blockquote>{pending.toString().slice(0, 120)}</blockquote>
          <textarea
            data-testid="comment-input"
            aria-label="Comment text"
            rows={3}
            autoFocus
            value={draft}
            placeholder="Write a comment"
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') close();
            }}
          />
          <div className="button-row">
            <button type="button" data-testid="comment-submit" onClick={save}>
              Save comment
            </button>
            <button type="button" onClick={close}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
