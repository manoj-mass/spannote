/**
 * Domain types for W3C Web Annotations (Data Model REC, 2017) plus the SpanNote extension
 * namespace. This module has no runtime dependencies and no DOM access.
 */

/** JSON-LD context of the W3C Web Annotation Data Model. */
export const ANNO_CONTEXT_IRI = 'http://www.w3.org/ns/anno.jsonld' as const;

/** Media type used by the W3C Annotation Protocol for annotations. */
export const ANNO_MEDIA_TYPE = `application/ld+json; profile="${ANNO_CONTEXT_IRI}"` as const;

/** Namespace for SpanNote extension terms (never used for terms the spec already defines). */
export const SPANNOTE_NS = 'https://spannote.dev/ns#' as const;

/** The 13 motivations defined by the Web Annotation Vocabulary. */
export const MOTIVATIONS = [
  'assessing',
  'bookmarking',
  'classifying',
  'commenting',
  'describing',
  'editing',
  'highlighting',
  'identifying',
  'linking',
  'moderating',
  'questioning',
  'replying',
  'tagging',
] as const;

export type Motivation = (typeof MOTIVATIONS)[number];

/** Selects text by quoting it, with optional context to disambiguate repeats. */
export interface TextQuoteSelector {
  readonly type: 'TextQuoteSelector';
  readonly exact: string;
  readonly prefix?: string;
  readonly suffix?: string;
}

/** Selects text by code-point offsets. Start is inclusive, end is exclusive. */
export interface TextPositionSelector {
  readonly type: 'TextPositionSelector';
  readonly start: number;
  readonly end: number;
}

/** Selectors this version understands. Unknown selector types are dropped during parsing. */
export type Selector = TextQuoteSelector | TextPositionSelector;

/** A part of a source resource, identified by one or more selectors. */
export interface SpecificResource {
  readonly type: 'SpecificResource';
  readonly source: string;
  readonly selector: readonly Selector[];
}

/** A textual body (comment text). */
export interface TextualBody {
  readonly type: 'TextualBody';
  readonly value: string;
  readonly format?: 'text/plain' | 'text/markdown' | 'text/html';
  readonly language?: string;
}

/** A person, organisation or software agent. */
export interface Agent {
  readonly id?: string;
  readonly type?: 'Person' | 'Organization' | 'Software';
  readonly name?: string;
}

/** SpanNote extension: review state of a comment thread. */
export type AnnotationStatus = 'open' | 'resolved' | 'proposed';

/** A W3C Web Annotation, with SpanNote extensions. */
export interface Annotation {
  readonly id: string;
  readonly type: 'Annotation';
  readonly motivation: Motivation;
  readonly target: SpecificResource;
  readonly body: readonly TextualBody[];
  readonly creator?: Agent;
  readonly generator?: Agent;
  readonly created?: string;
  readonly modified?: string;
  /** SpanNote: state of the thread. */
  readonly status?: AnnotationStatus;
  /** SpanNote: parent annotation id for replies. */
  readonly inReplyTo?: string;
}

/** A structured problem found while parsing untrusted input. */
export interface ParseIssue {
  readonly path: string;
  readonly message: string;
}
