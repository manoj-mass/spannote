# Troubleshooting

## "useAnnotationService must be used inside <SpanNoteProvider>"

A component that uses an SpanNote hook is not below `SpanNoteProvider`. Move the provider above
it, or check that the component is rendered inside the provider's `children`.

## "Attach a root with attach() before creating annotations."

`createFromRange` or `reply` need a root. Call `service.attach(root)` first, or mount
`SpanNoteProvider` before the user can select text.

## Every annotation is an orphan after a reload

Possible causes, in order of likelihood:

1. **The root is different.** Positions are measured within the root. Create and resolve in the
   same root (for example, always `document.body`). Check `root` in `SpanNoteProvider`.
2. **The page content is not the same.** Dynamic content loaded later changes the text. Call
   `service.refreshAnchors()` after the content loads.
3. **The annotations were created in another root.** Comments on a sub-tree, read back on the full
   page, may fail when the sub-tree text is not present yet.

## Annotations attach to the wrong text

This should not happen with the default strategies, because a position is accepted only when its
text matches. If it does:

- Check whether you enabled fuzzy matching with a low `minScore`. Use 0.9 or higher.
- Check for a custom resolver that accepts matches without verifying the text.
- Open an issue with the quote, the page, and the `strategy` value from `anchors`.

## Anchors are attached but the highlight is not visible

- The highlight is drawn by you. Confirm that `renderer.draw` runs on each `anchors` event.
- The CSS rule must use the exact name: `::highlight(spannote-<name>)` for the group you drew.
- Check that the browser supports the CSS Custom Highlight API (`CSS.highlights`). If not, the
  fallback adds `.spannote-highlight` spans; style that class instead.

## Highlights appear in the wrong place after the page changes

Ranges are live, but a DOM change can move them. Redraw after changes: call `refreshAnchors`, then
draw from the `anchors` event.

## Mark fallback breaks my framework

The mark fallback inserts nodes into the page. Frameworks that own that DOM (React, for example)
may complain when text nodes they manage are split. Prefer the CSS Custom Highlight API, which is
available in all current evergreen browsers. If you must use the fallback, draw inside an element
you own, outside the framework's render output.

## Update or delete fails with a conflict

`isVersionConflict(error)` returns true. Reload the list with `service.load()`, show the user the
current text, and retry. Annotations loaded from a protocol store have no version (see
[Concurrency](guides/concurrency.md#known-gap-protocol-list-versions)); they cannot be
conflict-checked until that is fixed.

## `parseAnnotation` returns errors for data that looks valid

- The `type` must be the string `"Annotation"`.
- The `motivation` must be one of the 13 standard values, not a custom one.
- Each `TextPositionSelector` needs integer `start` and `end` with `start <= end`.
- A target needs `source` and at least one supported selector.

Read `error` (an array of `{ path, message }`); each entry names the JSON path.

## Positions are off by one for some emoji

Positions count code points, as the spec requires. A tool that counts UTF-16 units (for example,
`dom-anchor-text-position`) reports a different number for text after an emoji. Use the
`TextPositionSelector` only with implementations that count code points, or rely on the quote,
which does not depend on positions.

## Tests fail with "Range.comparePoint is not a function"

Your test environment is too old or does not implement `Range`. Use jsdom 16 or later, or
happy-dom. Check that `document` is the jsdom document, not a stub.

## Build or typecheck errors about `exactOptionalPropertyTypes`

The packages are typed with `exactOptionalPropertyTypes`. Do not pass `undefined` to an optional
property; omit it instead. The same applies to options such as `fuzzy`, `creator`, and `source`.
