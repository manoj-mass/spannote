# @spannote/anchor

Describe a text range in the DOM as W3C selectors, and find it again after the page has changed.

- **Two text models, one per job.** Positions use the raw model (all text, code points), so they
  interoperate with other W3C implementations. Quotes use a normalized model (collapsed whitespace,
  non-content elements skipped), so they survive reflow and non-breaking spaces.
- **A position is accepted only when its text matches the quote.** This prevents attaching to the
  wrong text after the page changes.
- **Pluggable strategies.** Resolvers implement one interface and run in order. Add one without
  changing the engine.
- **Fuzzy matching is off by default.** Enable it with `fuzzy: { minScore }`.

```ts
import { AnchorEngine } from '@spannote/anchor';

const engine = new AnchorEngine();
const snapshot = engine.snapshot(document.body); // rebuild after DOM changes

const selectors = engine.describe(snapshot, range); // [TextQuoteSelector, TextPositionSelector]
const resolution = engine.resolve(engine.snapshot(document.body), selectors);
if (resolution) {
  // resolution.range is a live DOM Range; resolution.strategy says how it was found.
}
```

Requires a DOM with `Range.comparePoint` (all evergreen browsers, and jsdom).

See the [package root](../../README.md) for the overall design and the evidence behind these rules.
