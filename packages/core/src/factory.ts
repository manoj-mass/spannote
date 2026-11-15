import type { Agent, Annotation, AnnotationStatus, Motivation, Selector } from '@spannote/model';

/** Input for building a new annotation from a user's selection and comment. */
export interface NewAnnotationInput {
  readonly id: string;
  readonly source: string;
  readonly selectors: readonly Selector[];
  readonly motivation: Motivation;
  readonly body: string;
  readonly created: string;
  readonly creator?: Agent;
  readonly status?: AnnotationStatus;
  readonly inReplyTo?: string;
}

/** Builds a valid `Annotation`. Pure: no DOM, no clock, no randomness (all are passed in). */
export function buildAnnotation(input: NewAnnotationInput): Annotation {
  const annotation: {
    -readonly [K in keyof Annotation]: Annotation[K];
  } = {
    id: input.id,
    type: 'Annotation',
    motivation: input.motivation,
    target: { type: 'SpecificResource', source: input.source, selector: [...input.selectors] },
    body: [{ type: 'TextualBody', value: input.body, format: 'text/plain' }],
    created: input.created,
  };
  if (input.creator !== undefined) annotation.creator = input.creator;
  if (input.status !== undefined) annotation.status = input.status;
  if (input.inReplyTo !== undefined) annotation.inReplyTo = input.inReplyTo;
  return annotation;
}

/** A random identifier. Uses `crypto.randomUUID` when available. */
export function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const uuid =
    c?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `urn:uuid:${uuid}`;
}
