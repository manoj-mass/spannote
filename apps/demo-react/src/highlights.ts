import { useEffect } from 'react';
import type { AnnotationService } from '@spannote/core';
import { createHighlightRenderer } from '@spannote/render';

/**
 * Draws one group for attached anchors and one for fuzzy anchors. The renderer is chosen by the
 * `renderer` setting: `css` uses the CSS Custom Highlight API, `mark` forces the `<mark>` fallback.
 */
export function useHighlights(service: AnnotationService, renderer: 'css' | 'mark'): void {
  useEffect(() => {
    const highlights =
      renderer === 'mark'
        ? createHighlightRenderer({ environment: {} })
        : createHighlightRenderer();

    const paint = (): void => {
      const attached: Range[] = [];
      const fuzzy: Range[] = [];
      for (const state of service.anchors.values()) {
        if (!state.range) continue;
        (state.status === 'attached-fuzzy' ? fuzzy : attached).push(state.range);
      }
      highlights.draw('comments', attached);
      highlights.draw('fuzzy', fuzzy);
    };

    const stop = service.on('anchors', paint);
    paint();
    return () => {
      stop();
      highlights.dispose();
    };
  }, [service, renderer]);
}
