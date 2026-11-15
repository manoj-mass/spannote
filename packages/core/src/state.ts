import type { Strategy } from '@spannote/anchor';

/** Whether an annotation's anchor is currently in the document. */
export type AnchorStatus = 'attached' | 'attached-fuzzy' | 'orphan';

/** The current anchor of one annotation. `range` is live: rebuild it after DOM changes. */
export interface AnchorState {
  readonly annotationId: string;
  readonly status: AnchorStatus;
  readonly range?: Range;
  readonly strategy?: Strategy;
  readonly score?: number;
}
