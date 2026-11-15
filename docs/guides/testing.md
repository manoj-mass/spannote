# Testing

SpanNote is designed to test without a browser. Use jsdom (or happy-dom) for most tests, and a
real browser for end-to-end checks.

## Setup with Vitest

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'jsdom' },
});
```

## Testing anchors

Build a small document, select text with a live `Range`, describe it, change the document, and
resolve:

```ts
import { describe, expect, it } from 'vitest';
import { AnchorEngine } from '@spannote/anchor';

function rangeOver(needle: string, root: Node): Range {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const at = (n as Text).data.indexOf(needle);
    if (at !== -1) {
      const range = document.createRange();
      range.setStart(n, at);
      range.setEnd(n, at + needle.length);
      return range;
    }
  }
  throw new Error(`text not found: ${needle}`);
}

describe('anchors', () => {
  it('survives an inserted element', () => {
    document.body.innerHTML = '<p>The quick brown fox jumps.</p>';
    const engine = new AnchorEngine();
    const selectors = engine.describe(
      engine.snapshot(document.body),
      rangeOver('brown fox', document.body),
    );

    const ad = document.createElement('div');
    ad.textContent = 'Sponsored content inserted above.';
    document.body.prepend(ad);

    const resolution = engine.resolve(engine.snapshot(document.body), selectors);
    expect(resolution?.range.toString()).toBe('brown fox');
  });
});
```

Notes for jsdom:

- Use `Range.comparePoint`, `createTreeWalker`, and `splitText`. All are available in jsdom.
- Reset `document.body` in `beforeEach` (or `afterEach`), so tests stay independent.
- Real layout does not exist in jsdom: `getBoundingClientRect` returns zeros. SpanNote does not
  need layout, but your own layout code will.

## Testing the service

Inject a memory store, a fixed clock, and a fixed id source:

```ts
const service = new AnnotationService({
  store: new MemoryAnnotationStore(),
  now: () => new Date('2026-01-01T00:00:00Z'),
  newId: () => 'https://example.org/anno/1',
  source: () => 'https://example.org/page',
});
```

With those, `created` and `id` are deterministic, so you can compare whole objects in tests.

## Testing protocol code

Inject a fake `fetch` into `AnnotationProtocolClient`:

```ts
const fetch = vi.fn<FetchLike>(() => Promise.resolve(new Response(null, { status: 204 })));
const client = new AnnotationProtocolClient({ containerUrl: 'https://example.org/anno/', fetch });
await client.remove('https://example.org/anno/1', '"v1"');
expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({ 'If-Match': '"v1"' });
```

Mock responses must return promises, because `FetchLike` returns one.

## Testing React

Use `react-dom/client` and `act`. Set `IS_REACT_ACT_ENVIRONMENT` before rendering:

```tsx
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
```

Wrap the component in `SpanNoteProvider` with a service you control, then call service methods
inside `act` and assert on the rendered output.

## End-to-end

Run the page in a real browser (Playwright or similar) for:

- CSS Custom Highlight rendering (jsdom has no paint).
- Behaviour under real layout and real frameworks.
- The span fallback in a browser that lacks the API.

The SpanNote repository's own tests do not include a browser suite yet (see the roadmap).
