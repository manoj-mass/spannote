import { useContext, useSyncExternalStore } from 'react';
import type { AnchorState, AnnotationService } from '@spannote/core';
import type { Annotation } from '@spannote/model';
import { SpanNoteContext } from './context.js';

const NO_ANNOTATIONS: readonly Annotation[] = Object.freeze([]);
const NO_ANCHORS: ReadonlyMap<string, AnchorState> = new Map();

/** The service from the nearest `SpanNoteProvider`. Throws when there is none. */
export function useAnnotationService(): AnnotationService {
  const service = useContext(SpanNoteContext);
  if (!service) {
    throw new Error('useAnnotationService must be used inside <SpanNoteProvider>.');
  }
  return service;
}

/**
 * The current annotations. Re-renders only when the list changes. Uses
 * `useSyncExternalStore`, so it is safe under concurrent rendering and server rendering.
 */
export function useAnnotations(): readonly Annotation[] {
  const service = useAnnotationService();
  return useSyncExternalStore(
    (onChange) => service.on('change', onChange),
    () => service.annotations,
    () => NO_ANNOTATIONS,
  );
}

/** Anchor state for every annotation. Re-renders when any anchor changes. */
export function useAnchorStates(): ReadonlyMap<string, AnchorState> {
  const service = useAnnotationService();
  return useSyncExternalStore(
    (onChange) => service.on('anchors', onChange),
    () => service.anchors,
    () => NO_ANCHORS,
  );
}

/** Anchor state for one annotation, or `undefined` while it is unknown. */
export function useAnchor(annotationId: string): AnchorState | undefined {
  return useAnchorStates().get(annotationId);
}
