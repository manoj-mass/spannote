export {
  AnchorEngine,
  defaultResolvers,
  type AnchorEngineOptions,
  type AnchorSnapshot,
} from './engine.js';
export {
  FuzzyResolver,
  PositionResolver,
  QuoteResolver,
  type FuzzyResolverOptions,
  type Resolution,
  type Resolver,
  type ResolutionInput,
  type Strategy,
} from './resolvers.js';
export { describePosition, describeQuote, DEFAULT_CONTEXT_LENGTH } from './describe.js';
export { POSITION_MODEL, QUOTE_MODEL, type TextModel } from './text-model.js';
export { buildTextIndex, codePointIndexOf, unitIndexOf, type TextIndex } from './text-index.js';
export { bestApproximateMatch, type ApproximateMatch } from './approximate.js';
export { normalizeQuote } from './text.js';
