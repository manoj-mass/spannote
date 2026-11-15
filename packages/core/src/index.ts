export {
  AnnotationService,
  EmptySelectionError,
  type AnnotationDraft,
  type AnnotationServiceEvents,
  type AnnotationServiceOptions,
} from './service.js';
export { MemoryAnnotationStore } from './memory-store.js';
export { buildAnnotation, randomId, type NewAnnotationInput } from './factory.js';
export type { AnchorState, AnchorStatus } from './state.js';
export { EventHub } from './events.js';
