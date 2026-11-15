import type { TextPositionSelector, TextQuoteSelector } from '@spannote/model';
import { codePointIndexOf, spanOf, type TextIndex } from './text-index.js';
import { isLowSurrogate } from './text.js';

/** Characters of context stored before and after a quote. */
export const DEFAULT_CONTEXT_LENGTH = 32;

/** Moves a start boundary left so it never splits a surrogate pair. */
function safeStart(text: string, index: number): number {
  return index > 0 && isLowSurrogate(text.charCodeAt(index)) ? index - 1 : index;
}

/** Moves an end boundary right so it never splits a surrogate pair. */
function safeEnd(text: string, index: number): number {
  return index < text.length && isLowSurrogate(text.charCodeAt(index)) ? index + 1 : index;
}

/**
 * Describes a range as a TextQuoteSelector over the quote-model index.
 * Returns `undefined` when the range covers no indexed text.
 */
export function describeQuote(
  quoteIndex: TextIndex,
  range: Range,
  contextLength: number = DEFAULT_CONTEXT_LENGTH,
): TextQuoteSelector | undefined {
  const span = spanOf(quoteIndex, range);
  if (!span) return undefined;
  const [start, end] = span;
  const text = quoteIndex.text;
  const exact = text.slice(start, end);
  if (exact.length === 0) return undefined;
  const prefixStart = safeStart(text, Math.max(0, start - contextLength));
  const suffixEnd = safeEnd(text, Math.min(text.length, end + contextLength));
  return {
    type: 'TextQuoteSelector',
    exact,
    prefix: text.slice(prefixStart, start),
    suffix: text.slice(end, suffixEnd),
  };
}

/**
 * Describes a range as a TextPositionSelector over the position-model index, in code points.
 * Returns `undefined` when the range covers no indexed text.
 */
export function describePosition(
  positionIndex: TextIndex,
  range: Range,
): TextPositionSelector | undefined {
  const span = spanOf(positionIndex, range);
  if (!span) return undefined;
  const [start, end] = span;
  return {
    type: 'TextPositionSelector',
    start: codePointIndexOf(positionIndex, start),
    end: codePointIndexOf(positionIndex, end),
  };
}
