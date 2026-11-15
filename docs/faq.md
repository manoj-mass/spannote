# FAQ

**Do I need a server?**
No. `MemoryAnnotationStore` works without one. Add `@spannote/protocol` when you want comments
stored and shared.

**Which standards does SpanNote follow?**
The [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/) and the
[W3C Web Annotation Protocol](https://www.w3.org/TR/annotation-protocol/). Extension terms use the
`sn:` namespace.

**Can I use it with Vue, Angular, or Svelte?**
Use `@spannote/core` directly. It is framework-free: subscribe to `change` and `anchors` and
render with your framework. Vue and Angular bindings are planned.

**Does it modify my page?**
Not by default. Anchoring only reads text. Highlights use the CSS Custom Highlight API, which does
not change the DOM. The span fallback does change the DOM, and it restores it on `clear`.

**What happens when the page changes?**
Each annotation is re-resolved against the new page. An annotation whose passage moved is still
found, if its text and context are intact. One whose text was removed or changed a lot becomes an
orphan. Orphans keep their stored quote, so you can show them.

**Why do edits inside a quote orphan the annotation?**
Exact matching needs the quoted text. When someone edits those words, no exact match exists. Fuzzy
matching can recover small edits, but it can also attach to the wrong text, so it is off by
default. The most reliable fix is to keep a text revision history in your content system.

**Why are there two text models?**
Positions are measured on the raw text, in code points, because that is how the spec defines them,
and other implementations agree. Quotes are matched on normalized text, so reflow and non-breaking
spaces do not break them.

**Can two people edit the same comment?**
Yes, but without a conflict check, the last write wins for protocol-loaded comments (see
[Concurrency](guides/concurrency.md#known-gap-protocol-list-versions)). Memory-store comments are
checked.

**Can I add an image or PDF annotation?**
Not yet. The model accepts only text selectors. Image, video, and PDF selectors are on the
roadmap.

**Does it work offline?**
Reading and anchoring work offline if the annotations are already loaded. Writes fail when the
store is unreachable; there is no offline queue yet.

**How fast is it?**
In our measurements (Chrome and Safari on Apple Silicon), resolving 500 annotations took 0.6 to 2.5
ms once the page is indexed. Indexing a page takes 1 to 12 ms. Results on other hardware will
differ.

**Which browsers are supported?**
The current and previous major versions of evergreen browsers, with the DOM `Range` API. The CSS
path needs the CSS Custom Highlight API; other browsers use the span fallback.

**Is it safe to render user comments?**
Comment text is data. Render it as text (React escapes it). If you render Markdown or HTML, use a
sanitizer; the library does not sanitize `format: 'text/markdown'` or `'text/html'` bodies.

**What license is it under?**
Apache-2.0, as set in the repository. This has not been confirmed yet.
