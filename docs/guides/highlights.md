# Highlights

The service tells you where each annotation is. Drawing the highlights is your choice, and
`@spannote/render` makes it easy.

## Connect anchors to the renderer

```ts
import { createHighlightRenderer } from '@spannote/render';

const renderer = createHighlightRenderer();

service.on('anchors', (anchors) => {
  const ranges = [...anchors.values()].flatMap((state) => (state.range ? [state.range] : []));
  renderer.draw('comments', ranges);
});
```

Call `draw` on every `anchors` event. Each call replaces the group, so stale highlights disappear.
When you leave the page, call `renderer.dispose()`.

To highlight annotations differently by status, draw each status as its own group:

```ts
service.on('anchors', (anchors) => {
  const attached: Range[] = [];
  const fuzzy: Range[] = [];
  for (const state of anchors.values()) {
    if (!state.range) continue;
    (state.status === 'attached-fuzzy' ? fuzzy : attached).push(state.range);
  }
  renderer.draw('attached', attached);
  renderer.draw('fuzzy', fuzzy);
});
```

## Styling (CSS Custom Highlight API)

The CSS Custom Highlight API styles ranges without changing the DOM. Use the highlight name with
the prefix `spannote-` (the default):

```css
::highlight(spannote-attached) {
  background-color: rgb(255 230 0 / 0.45);
}

::highlight(spannote-fuzzy) {
  background-color: rgb(255 230 0 / 0.2);
  text-decoration: underline dotted;
}
```

Only the properties allowed by the API apply to `::highlight()`: colours, text decoration,
text shadow, and a few others. Layout properties do not.

Pass `prefix` to `createHighlightRenderer` to change the prefix.

## Mark fallback

Browsers without the CSS Custom Highlight API get a fallback. `createHighlightRenderer` chooses it
automatically, so you do not need to check.

The fallback wraps the highlighted text in `<mark class="spannote-highlight">` elements, with a
`data-spannote-highlight` attribute naming the group. It edits the page DOM, which can disturb
frameworks that own that DOM. `clear` and `dispose` restore the original text nodes.

Style the fallback with the class:

```css
.spannote-highlight {
  background-color: rgb(255 230 0 / 0.45);
}
```

Measured behaviour (our tests): the CSS path produced zero DOM mutation records in Chrome and
Safari. Span wrapping, measured before the switch to `<mark>`, produced 26 to 90. The `<mark>`
fallback has not been measured yet.

## Choosing the renderer explicitly

```ts
import { CssHighlightRenderer, MarkHighlightRenderer } from '@spannote/render';

const renderer = new CssHighlightRenderer(CSS.highlights, Highlight, 'spannote');
// or
const fallback = new MarkHighlightRenderer('my-highlight');
```

`createHighlightRenderer({ environment })` accepts a fake environment in tests:

```ts
createHighlightRenderer({ environment: { highlights: fakeRegistry, Highlight: FakeHighlight } });
```

## Limits

- Ranges are live. A DOM change can move or collapse them. Redraw after the page changes; the
  service's `anchors` event fires after each refresh.
- Highlights are not clickable by default. Use `range.getBoundingClientRect()` or your own hit
  testing to connect a click to an annotation.
