import { describe, expect, it } from 'vitest';
import { AnchorEngine, FuzzyResolver, PositionResolver, QuoteResolver } from '@spannote/anchor';
import { ARTICLE, paragraph, rangeOver, setBody } from './helpers.js';

const QUOTE = '12% of users churn each quarter';

describe('AnchorEngine', () => {
  it('describes a range with a quote and a position, then resolves it to the same text', () => {
    const body = setBody(ARTICLE);
    const engine = new AnchorEngine();
    const selectors = engine.describe(engine.snapshot(body), rangeOver(QUOTE));
    expect(selectors.map((s) => s.type)).toEqual(['TextQuoteSelector', 'TextPositionSelector']);

    const resolution = engine.resolve(engine.snapshot(body), selectors);
    expect(resolution?.strategy).toBe('position');
    expect(resolution?.range.toString()).toBe(QUOTE);
  });

  it('returns no selectors for a collapsed range', () => {
    const body = setBody(ARTICLE);
    const engine = new AnchorEngine();
    const range = document.createRange();
    range.setStart(paragraph(body).firstChild as Text, 0);
    range.collapse(true);
    expect(engine.describe(engine.snapshot(body), range)).toEqual([]);
  });

  it('survives a structural wrapper: the text is unchanged, so the position still verifies', () => {
    const body = setBody(ARTICLE);
    const engine = new AnchorEngine();
    const selectors = engine.describe(engine.snapshot(body), rangeOver(QUOTE));

    const wrapper = document.createElement('div');
    while (body.firstChild) wrapper.appendChild(body.firstChild);
    body.appendChild(wrapper);

    const resolution = engine.resolve(engine.snapshot(body), selectors);
    expect(resolution?.range.toString()).toBe(QUOTE);
  });

  it('survives an inserted ad: the position shifts, so the quote is used and verified', () => {
    const body = setBody(ARTICLE);
    const engine = new AnchorEngine();
    const selectors = engine.describe(engine.snapshot(body), rangeOver(QUOTE));

    const ad = document.createElement('div');
    ad.textContent = 'Sponsored: a long promotional line that shifts every later offset.';
    body.insertBefore(ad, body.querySelector('p'));

    const resolution = engine.resolve(engine.snapshot(body), selectors);
    expect(resolution).toBeDefined();
    expect(resolution?.range.toString()).toBe(QUOTE);
    expect(resolution?.strategy).not.toBe('position');
  });

  it('matches through a non-breaking space change, because the quote model normalizes it', () => {
    const body = setBody(ARTICLE);
    const engine = new AnchorEngine();
    const selectors = engine.describe(engine.snapshot(body), rangeOver(QUOTE));

    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      (n as Text).data = (n as Text).data.replace(/ /g, '\u00a0');
    }

    const resolution = engine.resolve(engine.snapshot(body), selectors);
    expect(resolution?.range.toString().replace(/\u00a0/g, ' ')).toBe(QUOTE);
  });

  it('attaches to the original, not to a duplicate of the quote later in the page', () => {
    const body = setBody(ARTICLE);
    const engine = new AnchorEngine();
    const selectors = engine.describe(engine.snapshot(body), rangeOver(QUOTE));

    const copy = document.createElement('p');
    copy.className = 'dup';
    copy.textContent = QUOTE;
    body.appendChild(copy);

    const resolution = engine.resolve(engine.snapshot(body), selectors);
    expect(resolution?.range.commonAncestorContainer.parentElement?.className).not.toBe('dup');
  });

  it('orphans an annotation whose text was removed', () => {
    const body = setBody(ARTICLE);
    const engine = new AnchorEngine();
    const selectors = engine.describe(engine.snapshot(body), rangeOver(QUOTE));
    paragraph(body).textContent = 'Entirely different content.';
    expect(engine.resolve(engine.snapshot(body), selectors)).toBeUndefined();
  });

  it('never accepts a position without a quote to verify it', () => {
    const body = setBody(ARTICLE);
    const engine = new AnchorEngine();
    const [, position] = engine.describe(engine.snapshot(body), rangeOver(QUOTE));
    expect(
      new PositionResolver().resolve({
        quoteIndex: engine.snapshot(body).quoteIndex,
        positionIndex: engine.snapshot(body).positionIndex,
        quote: undefined,
        position: position as never,
      }),
    ).toBeUndefined();
  });

  it('uses fuzzy matching only when enabled, and then recovers a small in-quote edit', () => {
    const body = setBody(ARTICLE);
    const plain = new AnchorEngine();
    const selectors = plain.describe(plain.snapshot(body), rangeOver(QUOTE));

    const textNode = paragraph(body).firstChild as Text;
    const at = textNode.data.indexOf('quarter') + 3;
    textNode.insertData(at, ' (updated) ');

    expect(plain.resolve(plain.snapshot(body), selectors)).toBeUndefined();

    const fuzzy = new AnchorEngine({ fuzzy: { minScore: 0.8 } });
    const resolution = fuzzy.resolve(fuzzy.snapshot(body), selectors);
    expect(resolution?.strategy).toBe('fuzzy');
    expect(resolution?.score).toBeGreaterThanOrEqual(0.8);
  });

  it('lets callers replace the resolver chain (Open/Closed)', () => {
    const body = setBody(ARTICLE);
    const engine = new AnchorEngine({ resolvers: [new QuoteResolver()] });
    const selectors = engine.describe(engine.snapshot(body), rangeOver(QUOTE));
    expect(engine.resolve(engine.snapshot(body), selectors)?.strategy).toBe('quote');
  });
});

describe('FuzzyResolver', () => {
  it('refuses a match below the score threshold', () => {
    const body = setBody('<p>abcdefghij</p>');
    const engine = new AnchorEngine();
    const snapshot = engine.snapshot(body);
    const resolver = new FuzzyResolver({ minScore: 0.99 });
    expect(
      resolver.resolve({
        quoteIndex: snapshot.quoteIndex,
        positionIndex: snapshot.positionIndex,
        quote: { type: 'TextQuoteSelector', exact: 'zzzzzzzzzz' },
        position: undefined,
      }),
    ).toBeUndefined();
  });
});
