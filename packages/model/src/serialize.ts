import { SPANNOTE_NS, ANNO_CONTEXT_IRI, type Annotation } from './types.js';

/** The JSON-LD shape of an annotation as sent over the wire. */
export interface AnnotationJsonLd {
  readonly '@context': readonly [typeof ANNO_CONTEXT_IRI, { readonly sn: typeof SPANNOTE_NS }];
  readonly id: string;
  readonly type: 'Annotation';
  readonly motivation: string;
  readonly target: unknown;
  readonly body?: unknown;
  readonly creator?: unknown;
  readonly generator?: unknown;
  readonly created?: string;
  readonly modified?: string;
  readonly 'sn:status'?: string;
  readonly 'sn:inReplyTo'?: string;
}

/**
 * Converts an `Annotation` into its JSON-LD form. Extension terms use the `sn:` prefix.
 * A single body is written as an object, several as an array, as the spec allows.
 */
export function toJsonLd(annotation: Annotation): AnnotationJsonLd {
  const out: {
    -readonly [K in keyof AnnotationJsonLd]: AnnotationJsonLd[K];
  } = {
    '@context': [ANNO_CONTEXT_IRI, { sn: SPANNOTE_NS }],
    id: annotation.id,
    type: 'Annotation',
    motivation: annotation.motivation,
    target: {
      type: 'SpecificResource',
      source: annotation.target.source,
      selector: annotation.target.selector.map((s) => ({ ...s })),
    },
  };
  if (annotation.body.length === 1) out.body = annotation.body[0];
  else if (annotation.body.length > 1) out.body = annotation.body;
  if (annotation.creator) out.creator = annotation.creator;
  if (annotation.generator) out.generator = annotation.generator;
  if (annotation.created) out.created = annotation.created;
  if (annotation.modified) out.modified = annotation.modified;
  if (annotation.status) out['sn:status'] = annotation.status;
  if (annotation.inReplyTo) out['sn:inReplyTo'] = annotation.inReplyTo;
  return out;
}
