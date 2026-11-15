import { describe, expect, it } from 'vitest';
import { parseAnnotation, MOTIVATIONS } from '@spannote/model';

const valid = {
  '@context': 'http://www.w3.org/ns/anno.jsonld',
  id: 'https://example.org/anno/1',
  type: 'Annotation',
  motivation: 'commenting',
  target: {
    type: 'SpecificResource',
    source: 'https://example.org/page',
    selector: [
      { type: 'TextQuoteSelector', exact: '12% of users', prefix: 'Across ', suffix: ' churn' },
      { type: 'TextPositionSelector', start: 10, end: 22 },
    ],
  },
  body: { type: 'TextualBody', value: 'Which quarter?', format: 'text/plain' },
};

describe('parseAnnotation', () => {
  it('parses a valid W3C annotation', () => {
    const result = parseAnnotation(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.annotation.id).toBe(valid.id);
    expect(result.value.annotation.target.selector).toHaveLength(2);
    expect(result.value.annotation.body[0]?.value).toBe('Which quarter?');
    expect(result.value.warnings).toHaveLength(0);
  });

  it('fails with a path when required fields are missing', () => {
    const result = parseAnnotation({ ...valid, id: undefined, motivation: 'nonsense' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.error.map((issue) => issue.path);
    expect(paths).toContain('id');
    expect(paths).toContain('motivation');
  });

  it('drops unknown selector types with a warning instead of failing', () => {
    const input = structuredClone(valid);
    input.target.selector.push({ type: 'FragmentSelector', value: 'xywh=0,0,10,10' } as never);
    const result = parseAnnotation(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.annotation.target.selector).toHaveLength(2);
    expect(result.value.warnings[0]?.message).toMatch(/unsupported selector/);
  });

  it('rejects a text position whose start is after its end', () => {
    const input = structuredClone(valid);
    input.target.selector[1] = { type: 'TextPositionSelector', start: 30, end: 5 };
    const result = parseAnnotation(input);
    expect(result.ok).toBe(true); // the quote selector still makes the target usable
    if (!result.ok) return;
    expect(result.value.warnings.length).toBeGreaterThan(0);
  });

  it('keeps the first recognised motivation from an array', () => {
    const result = parseAnnotation({ ...valid, motivation: ['unknown', 'highlighting'] });
    expect(result.ok && result.value.annotation.motivation).toBe('highlighting');
  });

  it('never throws on arbitrary input', () => {
    const samples: unknown[] = [null, 42, 'text', [], { type: 'Annotation' }, { target: 7 }];
    for (const sample of samples) {
      expect(() => parseAnnotation(sample)).not.toThrow();
      expect(parseAnnotation(sample).ok).toBe(false);
    }
  });

  it('knows the 13 standard motivations', () => {
    expect(MOTIVATIONS).toHaveLength(13);
  });
});
