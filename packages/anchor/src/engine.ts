import type { Selector } from '@spannote/model';
import { describePosition, describeQuote, DEFAULT_CONTEXT_LENGTH } from './describe.js';
import {
  FuzzyResolver,
  PositionResolver,
  QuoteResolver,
  type FuzzyResolverOptions,
  type Resolution,
  type Resolver,
} from './resolvers.js';
import { POSITION_MODEL, QUOTE_MODEL } from './text-model.js';
import { buildTextIndex, type TextIndex } from './text-index.js';

/**
 * The text of one DOM root, indexed under both models. Build it once per DOM state and reuse it
 * for every describe and resolve call. Discard it when the DOM changes.
 */
export interface AnchorSnapshot {
  readonly root: Node;
  readonly quoteIndex: TextIndex;
  readonly positionIndex: TextIndex;
}

export interface AnchorEngineOptions {
  /** Resolvers in the order they are tried. Defaults to position, quote, then fuzzy when enabled. */
  readonly resolvers?: readonly Resolver[];
  /** Characters of context stored around a quote. Default 32. */
  readonly contextLength?: number;
  /** Enables the fuzzy resolver with these options. Default: disabled. */
  readonly fuzzy?: FuzzyResolverOptions | false;
}

/** Builds the default resolver chain from engine options. */
export function defaultResolvers(options: Pick<AnchorEngineOptions, 'fuzzy'> = {}): Resolver[] {
  const chain: Resolver[] = [new PositionResolver(), new QuoteResolver()];
  if (options.fuzzy) chain.push(new FuzzyResolver(options.fuzzy));
  return chain;
}

function pick<T extends Selector['type']>(
  selectors: readonly Selector[],
  type: T,
): Extract<Selector, { type: T }> | undefined {
  return selectors.find((s): s is Extract<Selector, { type: T }> => s.type === type);
}

/**
 * Facade over describing and resolving anchors. Depends on resolver abstractions, so strategies
 * can be swapped or extended without changing this class (Dependency Inversion, Open/Closed).
 */
export class AnchorEngine {
  private readonly resolvers: readonly Resolver[];
  private readonly contextLength: number;

  constructor(options: AnchorEngineOptions = {}) {
    this.resolvers = options.resolvers ?? defaultResolvers(options);
    this.contextLength = options.contextLength ?? DEFAULT_CONTEXT_LENGTH;
  }

  /** Indexes `root` under both text models. Read-only with respect to the DOM. */
  snapshot(root: Node): AnchorSnapshot {
    return {
      root,
      quoteIndex: buildTextIndex(root, QUOTE_MODEL),
      positionIndex: buildTextIndex(root, POSITION_MODEL),
    };
  }

  /**
   * Describes `range` as selectors: a TextQuoteSelector and a TextPositionSelector. Returns an
   * empty array when the range covers no text.
   */
  describe(snapshot: AnchorSnapshot, range: Range): Selector[] {
    const quote = describeQuote(snapshot.quoteIndex, range, this.contextLength);
    const position = describePosition(snapshot.positionIndex, range);
    const selectors: Selector[] = [];
    if (quote) selectors.push(quote);
    if (position) selectors.push(position);
    return selectors;
  }

  /**
   * Finds the live range for `selectors` in the current DOM. Returns `undefined` when no resolver
   * succeeds, which means the anchor is an orphan.
   */
  resolve(snapshot: AnchorSnapshot, selectors: readonly Selector[]): Resolution | undefined {
    const input = {
      quoteIndex: snapshot.quoteIndex,
      positionIndex: snapshot.positionIndex,
      quote: pick<'TextQuoteSelector'>(selectors, 'TextQuoteSelector'),
      position: pick<'TextPositionSelector'>(selectors, 'TextPositionSelector'),
    };
    if (!input.quote && !input.position) return undefined;
    for (const resolver of this.resolvers) {
      const found = resolver.resolve(input);
      if (found) return found;
    }
    return undefined;
  }
}
