# Demo app

There are three demos, one per binding. Each one imports the SpanNote packages the way an outside
project would, so you can try the library in a browser without writing any code:

| Demo    | Folder              | Framework  | Dev server URL        |
| ------- | ------------------- | ---------- | --------------------- |
| React   | `apps/demo-react`   | React 19   | http://localhost:5173 |
| Vue     | `apps/demo-vue`     | Vue 3      | http://localhost:5174 |
| Angular | `apps/demo-angular` | Angular 21 | http://localhost:5175 |

All three show the same page, controls and comment list, and they pass the same smoke test.

They use the **built** packages (`packages/*/dist`), not their source. That means what you see is
what a user gets from `npm install`.

## Run it

From the repository root:

```bash
npm install          # once
npm run build        # builds the packages the demos import
npm run demo         # the React demo, at http://localhost:5173
npm run demo:vue     # the Vue demo, at http://localhost:5174
npm run demo:angular # the Angular demo, at http://localhost:5175
npm run demo:server  # optional: local W3C annotation server, at http://localhost:4000
```

Open a demo URL in a current browser. The smoke test has only run in Chrome, so report problems in
other browsers.

## What to try

### Comment on a selection

Select words in the article, press **Comment** next to the selection, type a comment, and press
**Save comment**. The comment box opens beside the text, and the selected text stays highlighted
while you type. The comment appears with the status `attached`.

The comment box takes focus when it opens, which clears the page selection. The demo saves the range
when you press **Comment**, and it draws that range as a CSS highlight while the box is open. Your
own code needs the same handling. See
[the selection pitfall](../troubleshooting.md#the-comment-is-not-created-when-i-type-in-the-comment-box).

### Change the page

The **Simulate page changes** buttons edit the article's DOM and then re-resolve every anchor.

| Button              | What changes                                   | Expected status                  |
| ------------------- | ---------------------------------------------- | -------------------------------- |
| Insert ad           | An element is added inside the article         | `attached`                       |
| Wrap content        | The article's content moves into a new `<div>` | `attached`                       |
| Reword first quote  | The quoted words are edited                    | `orphan` (fuzzy matching is off) |
| Duplicate quote     | The quote is copied to the end of the page     | `attached`, on the original      |
| Non-breaking spaces | Every third space becomes a non-breaking space | `attached`                       |

### Reply, edit, resolve and delete

Each comment has four buttons:

- **Reply** asks for the reply text in a prompt.
- **Edit** asks for new text in a prompt.
- **Resolve** toggles the comment's `status` between `open` and `resolved`.
- **Delete** removes the comment.

### Compare the renderers

Add `?renderer=mark` to the URL to force the `<mark>` fallback. The highlights become `<mark>`
elements instead of CSS highlights. The default, `?renderer=css`, uses the CSS Custom Highlight API
and leaves the DOM untouched.

### Persist to a server

Start `npm run demo:server`, then open `?store=w3c`. Comments are saved to the server, survive a
reload, and disappear when you delete them.

## URL settings

| Parameter  | Values          | Default                       | Effect                                                                            |
| ---------- | --------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| `store`    | `memory`, `w3c` | `memory`                      | Where comments are kept. `memory` lives in the page; `w3c` uses the local server. |
| `renderer` | `css`, `mark`   | `css`                         | `css` uses the CSS Custom Highlight API; `mark` forces the fallback.              |
| `endpoint` | URL             | `http://localhost:4000/anno/` | The W3C container, used when `store=w3c`.                                         |

Settings are read from the URL when the page loads, so you can bookmark or share any combination.

## Automated smoke test

With the demo running (and the W3C server, for the last scenario), run in a second terminal:

```bash
npm run demo:smoke
```

The test drives headless Chrome through six scenarios:

1. A comment on a selection is attached and highlighted with CSS.
2. An inserted ad and a wrapper keep the comment attached.
3. A duplicate of the quote does not take over the comment.
4. Rewording the quote is reported as a status, not an error.
5. The `<mark>` fallback wraps the comment.
6. The W3C store keeps the comment across a reload, then deletes it.

It fails on any uncaught page error. Chrome is found at `/Applications/Google Chrome.app`. Set
`CHROME_PATH` to use another build, and `DEMO_URL` or `W3C_URL` to point at other servers.

To test the Vue or Angular demo, start that demo and point `DEMO_URL` at it:

```bash
DEMO_URL=http://localhost:5174/ npm run demo:smoke   # Vue
DEMO_URL=http://localhost:5175/ npm run demo:smoke   # Angular
```

## Limits

- **The W3C server is for testing only.** It keeps everything in memory, so restarting it clears every
  comment. It implements enough of the protocol for the client: container reads, create, read, replace
  with `If-Match`, and delete with `If-Match`. It has no search, no paging beyond one page, and no
  authentication.
- **The article is static.** React does not re-render it, so the page-change buttons can edit its DOM
  safely. A real page where React owns the content needs the approach in
  [React and Next.js](react-and-nextjs.md).
- **Types come from source; runtime uses the build.** The demo's typecheck uses the packages' source
  types, while the running app uses the built output. A type error in the built output would not show
  up in the typecheck.

## Where the code is

| File                     | Purpose                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `src/config.ts`          | Reads the URL settings and builds the service                                       |
| `src/app.tsx`            | Page layout and the provider                                                        |
| `src/comments-panel.tsx` | Comment creation, the comment list, and the reply, edit, resolve and delete actions |
| `src/page-changes.tsx`   | The page-change buttons                                                             |
| `src/highlights.ts`      | Connects anchors to the highlight renderer                                          |
| `server/w3c-server.mjs`  | The local W3C annotation server                                                     |
| `e2e/smoke.mjs`          | The smoke test                                                                      |

The Vue demo (`apps/demo-vue`) keeps the same structure in `src/App.vue` (the page and comment panel),
`src/service.ts` (URL settings and the service), and `src/main.ts` (the plugin). The Angular demo
(`apps/demo-angular`) has `src/app.ts` and `src/app.html` for the page, and `src/config.ts` and
`src/main.ts` for the service and the providers.
