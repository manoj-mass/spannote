export {
  SPANNOTE_NS,
  ANNO_CONTEXT_IRI,
  ANNO_MEDIA_TYPE,
  MOTIVATIONS,
  type Agent,
  type Annotation,
  type AnnotationStatus,
  type Motivation,
  type ParseIssue,
  type Selector,
  type SpecificResource,
  type TextPositionSelector,
  type TextQuoteSelector,
  type TextualBody,
} from './types.js';
export { parseAnnotation, type ParsedAnnotation } from './validate.js';
export { toJsonLd, type AnnotationJsonLd } from './serialize.js';
export { fail, ok, type Result } from './result.js';
export type { AnnotationStore, Versioned } from './store.js';
export { VersionConflictError, isVersionConflict } from './errors.js';
