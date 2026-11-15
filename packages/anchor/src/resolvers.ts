import type { TextPositionSelector, TextQuoteSelector } from '@spannote/model';
import { bestApproximateMatch } from './approximate.js';
import { rangeOf, unitIndexOf, type TextIndex } from './text-index.js';
import { collapseSpaces, normalizeQuote } from './text.js';

/** How an anchor was found. Ordered from most to least certain. */
export type Strategy = 'position' | 'quote' | 'unique-quote' | 'fuzzy';

/** A successful lookup: a live range plus how it was found. */
export interface Resolution {
  readonly range: Range;
  readonly strategy: Strategy;
  /** 1 for exact strategies; the similarity score (0..1) for the fuzzy strategy. */
  readonly score: number;
}

/** Everything a resolver may read. Resolvers are pure over this input. */
export interface ResolutionInput {
  readonly quoteIndex: TextIndex;
  readonly positionIndex: TextIndex;
  readonly quote: TextQuoteSelector | undefined;
  readonly position: TextPositionSelector | undefined;
}

/**
 * One way of finding an anchor. Open for extension: add a resolver without editing the engine
 * (Open/Closed). Each resolver is independently testable (Single Responsibility).
 */
export interface Resolver {
  readonly strategy: Strategy;
  resolve(input: ResolutionInput): Resolution | undefined;
}

/** The position hint, mapped from the position model into the quote model's units. */
function quoteUnitHint(input: ResolutionInput): number | undefined {
  const { position, positionIndex, quoteIndex } = input;
  if (!position) return undefined;
  const rawUnit = unitIndexOf(positionIndex, position.start);
  if (rawUnit === undefined || positionIndex.text.length === 0) return undefined;
  return Math.round((rawUnit / positionIndex.text.length) * quoteIndex.text.length);
}

/**
 * Accepts a TextPosition only when its text matches the quote. An unverified position is never
 * accepted: that rule is what prevents attaching to the wrong text after the page changes.
 */
export class PositionResolver implements Resolver {
  readonly strategy = 'position' as const;

  resolve(input: ResolutionInput): Resolution | undefined {
    const { position, quote, positionIndex } = input;
    if (!position || !quote) return undefined;
    const start = unitIndexOf(positionIndex, position.start);
    const end = unitIndexOf(positionIndex, position.end);
    if (start === undefined || end === undefined || start >= end) return undefined;
    const found = normalizeQuote(positionIndex.text.slice(start, end));
    if (found !== normalizeQuote(quote.exact)) return undefined;
    const range = rangeOf(positionIndex, [start, end]);
    return range ? { range, strategy: 'position', score: 1 } : undefined;
  }
}

/**
 * Finds the quote in the quote-model text. Prefers occurrences whose prefix and suffix match.
 * If the context changed but the quote occurs exactly once, accepts that single occurrence.
 * When several occurrences match the context, picks the one nearest the position hint.
 */
export class QuoteResolver implements Resolver {
  readonly strategy = 'quote' as const;

  resolve(input: ResolutionInput): Resolution | undefined {
    const { quote, quoteIndex } = input;
    if (!quote) return undefined;
    const exact = normalizeQuote(quote.exact);
    if (exact.length === 0) return undefined;
    const prefix = collapseSpaces(quote.prefix ?? '');
    const suffix = collapseSpaces(quote.suffix ?? '');
    const text = quoteIndex.text;

    const hits: number[] = [];
    for (let at = text.indexOf(exact); at !== -1; at = text.indexOf(exact, at + 1)) hits.push(at);
    if (hits.length === 0) return undefined;

    const contextual = hits.filter(
      (at) =>
        text.slice(0, at).endsWith(prefix) && text.slice(at + exact.length).startsWith(suffix),
    );
    const candidates = contextual.length > 0 ? contextual : hits.length === 1 ? hits : [];
    if (candidates.length === 0) return undefined;

    const hint = quoteUnitHint(input);
    const chosen =
      hint === undefined
        ? candidates[0]
        : candidates.reduce((best, at) =>
            Math.abs(at - hint) < Math.abs(best - hint) ? at : best,
          );
    if (chosen === undefined) return undefined;

    const range = rangeOf(quoteIndex, [chosen, chosen + exact.length]);
    if (!range) return undefined;
    return {
      range,
      strategy: contextual.length > 0 ? 'quote' : 'unique-quote',
      score: 1,
    };
  }
}

export interface FuzzyResolverOptions {
  /** Minimum similarity (0..1) to accept. Default 0.9. */
  readonly minScore?: number;
  /** Characters searched on each side of the position hint. Default 300. */
  readonly windowPadding?: number;
}

/**
 * Approximate matching, used only after the exact resolvers fail. Off by default: the spike found
 * it attaches to wrong text in some in-quote edits. Accepts a match only when its similarity and
 * length are both plausible.
 */
export class FuzzyResolver implements Resolver {
  readonly strategy = 'fuzzy' as const;
  private readonly minScore: number;
  private readonly windowPadding: number;

  constructor(options: FuzzyResolverOptions = {}) {
    this.minScore = options.minScore ?? 0.9;
    this.windowPadding = options.windowPadding ?? 300;
  }

  resolve(input: ResolutionInput): Resolution | undefined {
    const { quote, quoteIndex } = input;
    if (!quote) return undefined;
    const pattern = normalizeQuote(quote.exact);
    if (pattern.length === 0) return undefined;

    const text = quoteIndex.text;
    const hint = quoteUnitHint(input);
    const lo = hint === undefined ? 0 : Math.max(0, hint - this.windowPadding);
    const hi =
      hint === undefined
        ? text.length
        : Math.min(text.length, hint + pattern.length + this.windowPadding);

    const best = bestApproximateMatch(text.slice(lo, hi), pattern);
    if (!best) return undefined;

    const score = 1 - best.distance / pattern.length;
    if (score < this.minScore) return undefined;
    const lengthSlack = Math.max(5, 0.2 * pattern.length);
    if (Math.abs(best.end - best.start - pattern.length) > lengthSlack) return undefined;

    const range = rangeOf(quoteIndex, [lo + best.start, lo + best.end]);
    return range ? { range, strategy: 'fuzzy', score } : undefined;
  }
}
