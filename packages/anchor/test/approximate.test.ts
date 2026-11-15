import { describe, expect, it } from 'vitest';
import {
  bestApproximateMatch,
  buildTextIndex,
  codePointIndexOf,
  POSITION_MODEL,
  unitIndexOf,
} from '@spannote/anchor';

describe('bestApproximateMatch', () => {
  it('finds an exact occurrence with distance 0', () => {
    expect(bestApproximateMatch('xx hello world yy', 'hello world')).toEqual({
      distance: 0,
      start: 3,
      end: 14,
    });
  });

  it('tolerates one substitution', () => {
    expect(bestApproximateMatch('xx hello wxrld yy', 'hello world')?.distance).toBe(1);
  });

  it('returns undefined for empty inputs', () => {
    expect(bestApproximateMatch('', 'a')).toBeUndefined();
    expect(bestApproximateMatch('abc', '')).toBeUndefined();
  });
});

describe('code points and code units', () => {
  it('counts an emoji as one code point but two code units (spec counts code points)', () => {
    const body = document.createElement('div');
    body.textContent = 'a\u{1F642}b';
    const index = buildTextIndex(body, POSITION_MODEL);
    expect(index.text.length).toBe(4);
    expect(codePointIndexOf(index, 3)).toBe(2); // 'b' is the third code point (index 2)
    expect(unitIndexOf(index, 2)).toBe(3);
  });
});
