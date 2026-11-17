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

## Choosing a renderer

Use the automatic choice unless you have a reason not to:

| Choice              | Code                                                  | Use when                                                                                                              |
| ------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Automatic (default) | `createHighlightRenderer()`                           | Most apps. CSS highlights where the browser supports them, `<mark>` elements elsewhere.                               |
| CSS only            | `new CssHighlightRenderer(CSS.highlights, Highlight)` | The DOM must never change. Check `'highlights' in CSS` first, because older browsers have no `CSS.highlights`.        |
| `<mark>` only       | `new MarkHighlightRenderer()`                         | You need highlights as real elements, for example to attach click handlers, and your framework tolerates extra nodes. |

The demo's `?renderer=mark` setting uses the `<mark>` option. The demo guide lists the URL settings.

## Accessibility

Each option affects assistive technology differently. The text stays readable in both cases, but the
highlight itself reaches a screen reader only in some cases.

- **CSS highlights** leave the text and the DOM as they are, so a screen reader reads the article in
  its original order. The highlight is visual only. Chrome's guidance says custom highlights are not
  exposed to the accessibility tree, so a screen reader user won't hear that a passage has a comment.
- **`<mark>` elements** are semantic, and some screen readers announce them. Their support varies, so
  test with the screen readers your users rely on. The extra elements also split text nodes, which
  can affect text search and reading.

For both options:

- Don't rely on colour alone. The fuzzy highlight adds an underline, and the comment list gives the
  same information in text. Keep that list as the main accessible route to the comments.
- Keep the text readable on the highlight colour. Check the contrast of your highlight colour against
  the text, using WCAG 2.2 criterion 1.4.3 (at least 4.5:1 for normal text).
- Highlights can't receive keyboard focus. If you add click handling, give keyboard users the same
  action, such as opening the comment from the list.
- The comment list and the comment box need keyboard support. Test them without a mouse.

## Browser support

| Browser         | CSS highlights                                    | `<mark>` fallback |
| --------------- | ------------------------------------------------- | ----------------- |
| Chrome and Edge | 105 and later                                     | Works everywhere  |
| Safari          | 17.2 and later                                    | Works everywhere  |
| Firefox         | 140 and later (added June 2025)                   | Works everywhere  |
| Older browsers  | Not supported; the automatic choice uses `<mark>` | Works             |

These versions come from MDN and web.dev summaries, so check the
[MDN compatibility table](https://developer.mozilla.org/en-US/docs/Web/API/css_custom_highlight_api)
before you publish. Some members lag behind the core API. For example, `highlightsFromPoint()` was
supported in Chrome only when this page was written.

Our tests run in Chrome. Safari was measured in the Phase 0 spike, and Firefox has not been tested
with SpanNote.

Sources:

- [web.dev, New to the web platform in June 2025](https://web.dev/blog/web-platform-06-2025)
- [MDN, CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/css_custom_highlight_api)
- [Chrome, Highlight text ranges](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/highlight-text-ranges)
- [W3C CSS WG issue #6498, how highlights are exposed to the accessibility tree](https://github.com/w3c/csswg-drafts/issues/6498)

## Limits

- Ranges are live. A DOM change can move or collapse them. Redraw after the page changes; the
  service's `anchors` event fires after each refresh.
- Highlights are not clickable by default. Use `range.getBoundingClientRect()` or your own hit
  testing to connect a click to an annotation.
