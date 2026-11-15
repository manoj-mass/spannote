# @spannote/render

Draws highlights for DOM ranges.

- `CssHighlightRenderer` uses the CSS Custom Highlight API. It leaves the host DOM untouched.
  Style it with `::highlight(spannote-<name>)`.
- `MarkHighlightRenderer` is the fallback. It wraps text in `<mark>` elements and restores it on `clear`.
- `createHighlightRenderer()` picks the right one for the environment.

```ts
import { createHighlightRenderer } from '@spannote/render';

const renderer = createHighlightRenderer();
renderer.draw('comments', [range]);
```

```css
::highlight(spannote-comments) {
  background-color: rgb(255 230 0 / 0.4);
}
```

Measured in the spike: zero DOM mutations in Chrome and Safari for the CSS path, against 26 to 90
mutation records for span wrapping, measured before the switch to `<mark>`. Re-measure before relying on the exact figure.
