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
  const c = (
    globalThis as {
      crypto?: {
        randomUUID?: () => string;
        getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
      };
    }
  ).crypto;

  const uuid =
    c?.randomUUID?.() ??
    (() => {
      if (!c?.getRandomValues) {
        throw new Error('Secure random generator is unavailable');
      }
      const bytes = c.getRandomValues(new Uint8Array(16));
      bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // version 4
      bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10xx
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
      return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
    })();

  return `urn:uuid:${uuid}`;
}
