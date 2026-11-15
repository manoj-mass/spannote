import { createContext, useEffect, type ReactNode } from 'react';
import type { AnnotationService } from '@spannote/core';

export const SpanNoteContext = createContext<AnnotationService | null>(null);
SpanNoteContext.displayName = 'SpanNoteContext';

export interface SpanNoteProviderProps {
  /** The service the whole subtree shares. Create it once, outside render. */
  readonly service: AnnotationService;
  /**
   * The DOM root to anchor in. Defaults to `document.body` in the browser. Pass a stable node:
   * a new node on every render re-attaches the service.
   */
  readonly root?: Node | null;
  readonly children?: ReactNode;
}

/**
 * Connects an `AnnotationService` to the React tree. It attaches the service to `root` while
 * mounted and detaches on unmount. Renders nothing on the server, where there is no DOM.
 */
export function SpanNoteProvider({ service, root, children }: SpanNoteProviderProps) {
  useEffect(() => {
    const target =
      root !== undefined ? root : typeof document !== 'undefined' ? document.body : null;
    if (!target) return undefined;
    service.attach(target);
    return () => {
      service.detach();
    };
  }, [service, root]);

  return <SpanNoteContext.Provider value={service}>{children}</SpanNoteContext.Provider>;
}
