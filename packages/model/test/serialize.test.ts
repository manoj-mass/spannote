import { describe, expect, it } from 'vitest';
import {
  SPANNOTE_NS,
  ANNO_CONTEXT_IRI,
  parseAnnotation,
  toJsonLd,
  type Annotation,
} from '@spannote/model';

const base: Annotation = {
  id: 'https://example.org/anno/2',
  type: 'Annotation',
  motivation: 'replying',
  target: {
    type: 'SpecificResource',
    source: 'https://example.org/page',
    selector: [{ type: 'TextQuoteSelector', exact: 'x' }],
  },
  body: [{ type: 'TextualBody', value: 'one' }],
  status: 'resolved',
  inReplyTo: 'https://example.org/anno/1',
};

describe('toJsonLd', () => {
  it('adds the W3C context and the SpanNote namespace', () => {
    const out = toJsonLd(base);
    expect(out['@context']).toEqual([ANNO_CONTEXT_IRI, { sn: SPANNOTE_NS }]);
    expect(out['sn:status']).toBe('resolved');
    expect(out['sn:inReplyTo']).toBe('https://example.org/anno/1');
  });

  it('writes one body as an object and several as an array', () => {
    expect(toJsonLd(base).body).toEqual({ type: 'TextualBody', value: 'one' });
    const many = toJsonLd({
      ...base,
      body: [
        { type: 'TextualBody', value: 'one' },
        { type: 'TextualBody', value: 'two' },
      ],
    });
    expect(Array.isArray(many.body)).toBe(true);
  });

  it('round-trips through the parser', () => {
    const parsed = parseAnnotation(JSON.parse(JSON.stringify(toJsonLd(base))));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.annotation).toMatchObject({
      id: base.id,
      motivation: 'replying',
      status: 'resolved',
      inReplyTo: base.inReplyTo,
    });
  });
});
