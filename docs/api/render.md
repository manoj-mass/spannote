# @spannote/render

Draws highlights for DOM ranges. Two mechanisms, one interface.

```ts
import {
  createHighlightRenderer,
  CssHighlightRenderer,
  MarkHighlightRenderer,
  globalHighlightEnvironment,
  type HighlightRenderer,
} from '@spannote/render';
```

## HighlightRenderer

```ts
interface HighlightRenderer {
  draw(name: string, ranges: readonly Range[]): void; // replaces the group `name`
  clear(name: string): void; // removes the group; unknown names are ignored
  dispose(): void; // removes every group this renderer drew
}
```

A group is a named set of ranges. Drawing a group again replaces it.

## createHighlightRenderer

```ts
function createHighlightRenderer(options?: CreateRendererOptions): HighlightRenderer;

interface CreateRendererOptions {
  environment?: RenderEnvironment; // default: the global CSS and Highlight objects
  prefix?: string; // CSS highlight name prefix. Default "spannote".
  className?: string; // class for fallback spans. Default "spannote-highlight".
}

interface RenderEnvironment {
  highlights?: HighlightRegistry; // CSS.highlights
  Highlight?: HighlightConstructor; // the Highlight constructor
}
```

Returns a `CssHighlightRenderer` when both `highlights` and `Highlight` are present, and a
`MarkHighlightRenderer` otherwise.

## CssHighlightRenderer

```ts
class CssHighlightRenderer implements HighlightRenderer {
  constructor(registry: HighlightRegistry, createHighlight: HighlightConstructor, prefix?: string);
  keyFor(name: string): string; // "<prefix>-<name>", the name used in ::highlight()
  draw(name: string, ranges: readonly Range[]): void;
  clear(name: string): void;
  dispose(): void;
}
```

Registers a `Highlight` for each group under `keyFor(name)`. It does not change the DOM.

Style a group in CSS:

```css
::highlight(spannote-comments) {
  background-color: rgb(255 230 0 / 0.45);
}
```

## MarkHighlightRenderer

```ts
class MarkHighlightRenderer implements HighlightRenderer {
  constructor(className?: string); // default "spannote-highlight"
}
```

Wraps each covered piece of text in a `<mark class={className} data-spannote-highlight={name}>`.
Pieces that begin or end inside a text node are split first, so only the covered characters are
wrapped. `clear` moves the children back to their original place, removes the mark, and normalizes
the parent so adjacent text nodes merge again.

Because it edits the DOM, do not use it inside a region a framework manages, unless the framework
is fine with foreign nodes appearing there.

## HighlightRegistry and HighlightConstructor

```ts
interface HighlightRegistry {
  // the subset of CSS.highlights used
  set(name: string, highlight: unknown): unknown;
  delete(name: string): boolean;
}
type HighlightConstructor = new (...ranges: Range[]) => unknown; // the Highlight constructor
```

These exist so that tests can inject fakes.

## globalHighlightEnvironment

```ts
function globalHighlightEnvironment(): RenderEnvironment;
```

Reads `CSS.highlights` and `Highlight` from `globalThis`. Returns `undefined` for either when the
browser lacks it, so `createHighlightRenderer` picks the fallback.

## Behaviour notes

- Empty ranges are ignored by the mark renderer.
- The CSS renderer keeps the ranges it was given. If the DOM changes, redraw.
- Ranges from different groups may overlap. Each group is independent.
- `dispose` only removes groups this renderer drew; it does not touch other highlights.

## Measured behaviour

| Mechanism                                     | DOM mutation records (Chrome, 5 pages) | (Safari, 6 pages) |
| --------------------------------------------- | -------------------------------------- | ----------------- |
| CSS Custom Highlight API                      | 0                                      | 0                 |
| Span wrapping (before the switch to `<mark>`) | 26 to 42                               | 26 to 90          |

The `<mark>` fallback has not been measured yet. Its mechanism is the same as span wrapping, so
expect similar counts, but measure it before quoting a figure.
