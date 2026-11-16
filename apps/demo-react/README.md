# SpanNote demo

A small React app that imports the SpanNote packages the way an outside project would, and lets
you exercise them in a browser. It uses the **built** packages (`packages/*/dist`), so run the
package build first.

## Run it

```bash
npm install          # once, at the repository root
npm run build        # builds the packages the demo imports
npm run demo         # the demo, at http://localhost:5173
npm run demo:server  # the local W3C annotation server, at http://localhost:4000 (optional)
```

Open http://localhost:5173 in a current browser. Chrome is the only browser the smoke test has run in, so
report problems in other browsers.

## What to try

1. **Comment on a selection.** Select words in the article, type a comment in the box, and press
   _Comment_ appears next to the selection. Press it to open the comment box beside the text, and
   _Save comment_ to create the comment. The selected text stays highlighted while you type, because
   the demo saves the range when you press _Comment_.
2. **Change the page.** Use _Simulate page changes_:
   - _Insert ad_ adds an element inside the article. The comment should stay `attached`.
   - _Wrap content_ moves the article into a new `<div>`. The comment should stay `attached`.
   - _Reword first quote_ edits the quoted words. Exact matching cannot find them, so expect `orphan`.
   - _Duplicate quote_ copies the quote to the end of the page. The comment must stay on the original.
   - _Non-breaking spaces_ changes every third space. The comment should stay `attached`.
3. **Reply, edit, resolve, delete.** Each comment has buttons for these. _Edit_ asks for new text in a
   prompt.
4. **Compare the renderers.** Open `?renderer=mark` to force the `<mark>` fallback. Highlights become
   `<mark>` elements instead of CSS highlights.
5. **Persist to a server.** Start `npm run demo:server`, then open `?store=w3c`. Comments survive a
   reload, and _Delete_ removes them from the server.

## URL settings

| Parameter  | Values          | Default                       | Effect                                                                            |
| ---------- | --------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| `store`    | `memory`, `w3c` | `memory`                      | Where comments are kept. `memory` lives in the page; `w3c` uses the local server. |
| `renderer` | `css`, `mark`   | `css`                         | `css` uses the CSS Custom Highlight API; `mark` forces the fallback.              |
| `endpoint` | URL             | `http://localhost:4000/anno/` | The W3C container, when `store=w3c`.                                              |

## Automated smoke test

With the demo and the W3C server running, in a second terminal:

```bash
npm run demo:smoke
```

The smoke test drives headless Chrome (installed on the machine at
`/Applications/Google Chrome.app`; set `CHROME_PATH` to use another build) through six scenarios:
creating a comment, an inserted ad and a wrapper, a duplicate quote, rewording a quote, the `<mark>`
fallback, and the W3C store with reload and delete. It fails on any uncaught page error.

## Notes for testers

- The local W3C server is in memory. Restarting it clears every comment. It implements enough of the
  protocol for the client: container reads, create, read, replace with `If-Match`, and delete with
  `If-Match`. It does not implement search, paging beyond one page, or authentication.
- The demo's article is static and is not re-rendered by React, so the page-change buttons can edit its
  DOM without fighting React.
- The demo has no build-time type link to the built packages. Its typecheck uses the source types, and
  its runtime uses the built output.
