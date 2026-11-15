# SpanNote documentation

SpanNote lets people select text on a web page, leave a comment, and keep that comment attached
to the same passage when the page changes. Annotations use the
[W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/) and can be stored through
the [W3C Annotation Protocol](https://www.w3.org/TR/annotation-protocol/).

The library is split into packages. Use the ones you need.

## Contents

**Start here**

- [Getting started](getting-started.md): install, a first comment, React in five minutes.
- [Concepts](concepts.md): annotations, selectors, anchoring, states, and why the rules are the way they are.

**Guides**

- [React and Next.js](guides/react-and-nextjs.md): provider setup, server rendering, App Router.
- [Storage](guides/storage.md): the memory store, the W3C protocol store, and writing your own adapter.
- [Highlights](guides/highlights.md): drawing highlights, styling them, and the span fallback.
- [Concurrency and versions](guides/concurrency.md): conflicts, ETags, and a known gap to read before shipping.
- [Testing](guides/testing.md): testing components and anchors with jsdom.

**API reference**

- [@spannote/model](api/model.md): types, parsing, serialization, and the storage port.
- [@spannote/anchor](api/anchor.md): describing and resolving text ranges.
- [@spannote/render](api/render.md): highlight renderers.
- [@spannote/protocol](api/protocol.md): the W3C protocol client and its errors.
- [@spannote/core](api/core.md): the annotation service.
- [@spannote/react](api/react.md): provider and hooks.

**Reference material**

- [Architecture](ARCHITECTURE.md): layering, SOLID mapping, and the decisions behind them.
- [Troubleshooting](troubleshooting.md): symptoms and fixes.
- [FAQ](faq.md): common questions.
- [Releasing](RELEASING.md): how packages are versioned and published.

## Packages at a glance

| Package              | Use it for                                               | Depends on    | Touches the DOM        |
| -------------------- | -------------------------------------------------------- | ------------- | ---------------------- |
| `@spannote/model`    | Types, parsing, JSON-LD, the storage port                | nothing       | no                     |
| `@spannote/anchor`   | Turning a selection into selectors, and finding it again | model         | reads text             |
| `@spannote/render`   | Drawing highlights                                       | nothing       | only the span fallback |
| `@spannote/protocol` | Talking to a W3C annotation server                       | model         | no                     |
| `@spannote/core`     | The annotation list, anchors, and writes                 | model, anchor | no                     |
| `@spannote/react`    | React hooks and provider                                 | core, model   | through core           |

## Status

Version 0.1.0 is not yet published. The API is stable for the features documented here, but
read the [limitations](concepts.md#limitations) before you depend on it.
