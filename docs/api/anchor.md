# @spannote/anchor

Turns a DOM range into W3C selectors, and finds the range again after the page changes.

```ts
import { AnchorEngine, FuzzyResolver, type Resolution, type Strategy } from '@spannote/anchor';
```

## AnchorEngine

```ts
class AnchorEngine {
  constructor(options?: AnchorEngineOptions);
  snapshot(root: Node): AnchorSnapshot;
  describe(snapshot: AnchorSnapshot, range: Range): Selector[];
  resolve(snapshot: AnchorSnapshot, selectors: readonly Selector[]): Resolution | undefined;
}
```

### Options

```ts
interface AnchorEngineOptions {
  resolvers?: readonly Resolver[]; // default: position, quote, then fuzzy if enabled
  contextLength?: number; // default 32
  fuzzy?: FuzzyResolverOptions | false; // default false
}
```

- `resolvers` replaces the resolver chain. Use it to add, remove, or reorder strategies.
- `contextLength` is the number of characters of prefix and suffix stored with each quote.
- `fuzzy` enables approximate matching after the exact resolvers. Pass `{ minScore }` to enable.

### snapshot(root)

Indexes the text under `root` in both text models. It does not modify the DOM. The result is
valid only for the DOM state it was built from. Build a new snapshot after changes.

### describe(snapshot, range)

Returns `[TextQuoteSelector, TextPositionSelector]`, or an empty array when the range covers no
indexed text (for example, a collapsed range or a range inside `<script>`).

```ts
const engine = new AnchorEngine();
const selectors = engine.describe(engine.snapshot(document.body), range);
```

### resolve(snapshot, selectors)

Returns a `Resolution` or `undefined`.

```ts
interface Resolution {
  range: Range; // live DOM range, valid until the DOM changes
  strategy: Strategy; // 'position' | 'quote' | 'unique-quote' | 'fuzzy'
  score: number; // 1 for exact strategies; similarity 0–1 for fuzzy
}
```

Returns `undefined` when there is no `TextQuoteSelector` and no `TextPositionSelector`, or when no
resolver succeeds.

## Resolvers

Each resolver implements one interface, and receives everything it needs in one object:

```ts
interface Resolver {
  readonly strategy: Strategy;
  resolve(input: ResolutionInput): Resolution | undefined;
}

interface ResolutionInput {
  quoteIndex: TextIndex;
  positionIndex: TextIndex;
  quote: TextQuoteSelector | undefined;
  position: TextPositionSelector | undefined;
}
```

| Class              | Accepts when                                                          | Notes                                                               |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `PositionResolver` | The text at the position, normalized, equals the normalized quote     | Never accepts a position without a quote                            |
| `QuoteResolver`    | The quote occurs with matching context, or occurs exactly once        | Chooses the occurrence nearest the position hint when several match |
| `FuzzyResolver`    | Similarity is at least `minScore` and the matched length is plausible | Off by default                                                      |

```ts
interface FuzzyResolverOptions {
  minScore?: number; // default 0.9
  windowPadding?: number; // default 300 characters around the position hint
}
```

The length guard rejects a match whose length differs from the quote by more than
`max(5, 20%)` of the quote's length.

Build your own resolver by implementing `Resolver`, then pass the chain to the engine:

```ts
const engine = new AnchorEngine({
  resolvers: [new PositionResolver(), new QuoteResolver(), myResolver],
});
```

`defaultResolvers({ fuzzy })` returns the default chain as an array you can extend.

## Text models and helpers

```ts
const POSITION_MODEL: TextModel; // raw, code points
const QUOTE_MODEL: TextModel; // normalized, skips non-content elements
interface TextModel {
  name: string;
  skipElements: ReadonlySet<string>;
  collapseWhitespace: boolean;
}

function buildTextIndex(root: Node, model: TextModel): TextIndex;
function codePointIndexOf(index: TextIndex, unit: number): number;
function unitIndexOf(index: TextIndex, codePoint: number): number | undefined;
function normalizeQuote(value: string): string; // collapse whitespace, then trim
function describeQuote(
  index: TextIndex,
  range: Range,
  contextLength?: number,
): TextQuoteSelector | undefined;
function describePosition(index: TextIndex, range: Range): TextPositionSelector | undefined;
function bestApproximateMatch(text: string, pattern: string): ApproximateMatch | undefined;
```

`TextIndex` exposes `text` (the concatenated string), `locations` (one DOM position per UTF-16
unit), and `codePointStarts`. Most applications do not need these; the engine uses them for you.

`bestApproximateMatch` is the approximate matcher behind `FuzzyResolver`. It returns the substring
of `text` with the smallest edit distance to `pattern`.

## Behaviour notes

- **Offsets are code points** in `TextPositionSelector`, as the spec requires. JavaScript strings
  count UTF-16 units, so the library converts between them. `dom-anchor-text-position` counts
  units, which disagrees with the spec for characters outside the Basic Multilingual Plane (for
  example, most emoji).
- **Ranges are live.** `Resolution.range` is a DOM `Range`. A DOM change can move or collapse it.
- **Not a highlighter.** `describe` and `resolve` never modify the DOM. Drawing is
  `@spannote/render`'s job.
- **Requires `Range.comparePoint`.** Available in evergreen browsers and jsdom.

## Choosing a strategy order

The default order (position, quote, fuzzy) suits most sites. Consider these changes:

- Remove `PositionResolver` if your pages never repeat a quote. Without it, a quote that occurs
  several times with matching context is resolved to the occurrence nearest the position hint; with
  it, the same choice is made after verifying the position's text.
- Put `FuzzyResolver` last, with a high `minScore` (0.9 or more). Lower thresholds attached to the
  wrong text in our tests.
