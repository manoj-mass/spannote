# Concepts

## Annotations

An annotation says that a **body** (the comment text) relates to a **target** (a passage of a
page), and why (its **motivation**). SpanNote follows the W3C data model:

```json
{
  "@context": ["http://www.w3.org/ns/anno.jsonld", { "al": "https://spannote.dev/ns#" }],
  "id": "https://annotations.example.org/anno/42",
  "type": "Annotation",
  "motivation": "commenting",
  "creator": { "type": "Person", "name": "Ana" },
  "created": "2026-11-15T10:02:00.000Z",
  "target": {
    "type": "SpecificResource",
    "source": "https://example.org/pricing",
    "selector": [
      {
        "type": "TextQuoteSelector",
        "exact": "12% of users",
        "prefix": "Across the base, ",
        "suffix": " churn each"
      },
      { "type": "TextPositionSelector", "start": 1204, "end": 1216 }
    ]
  },
  "body": { "type": "TextualBody", "format": "text/plain", "value": "Which quarter is this?" },
  "sn:status": "open"
}
```

- **Motivation** is one of the 13 standard values, such as `commenting`, `replying`,
  `highlighting`, or `questioning`. SpanNote creates `commenting` and `replying` annotations.
- **Body** is one or more `TextualBody` objects. SpanNote supports text only.
- **Extension terms** use the `sn:` namespace (`https://spannote.dev/ns#`): `sn:status` and
  `sn:inReplyTo`. The spec does not define them, so other tools may ignore them.

## Selectors

A selector describes which part of a page the annotation refers to. SpanNote writes two text
selectors for every range:

| Selector               | Stores                                                                   | Used for                                          |
| ---------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| `TextQuoteSelector`    | `exact` text, plus `prefix` and `suffix` (32 characters each by default) | Finding the passage by its words and surroundings |
| `TextPositionSelector` | `start` and `end` as **code-point** offsets                              | Fast, precise lookup when the page is unchanged   |

The spec requires offsets in code points, so a position is portable across implementations.
Unknown selector types (for example `FragmentSelector`) are dropped with a warning when parsed.

## Two text models

Positions and quotes measure text differently, on purpose:

- **Position model (raw):** every text node in the root, whitespace kept, counted in code points.
  Offsets from this model agree with the Apache Annotator implementation on every check in our
  test corpus.
- **Quote model (normalized):** script, style, template, navigation, header, footer, and form
  controls are skipped, and every run of whitespace (including non-breaking spaces) becomes one
  space. Quotes match here, so reflow and non-breaking spaces do not break them.

## Anchoring

Anchoring finds the live `Range` for a stored set of selectors. `AnchorEngine.resolve` tries the
resolvers in order and returns the first match:

1. **`position`**: the text at the stored position must match the quote. An unverified position is
   never accepted.
2. **`quote`**: the quote must occur, with matching prefix and suffix. When several occurrences
   match, the one nearest the position hint wins.
3. **`unique-quote`**: the quote occurs exactly once, but its context changed. This is accepted.
4. **`fuzzy`**: an approximate match, only when you enable it. Off by default.

If nothing matches, the annotation is an **orphan**.

### Why verify positions

When a page changes, a stored position can point at different text without any error. In our
tests, an ad inserted before the passage made a position-only lookup attach to the wrong text in
every case. Checking the text before accepting the position removes those wrong attachments.

## Anchor states

The service reports one state per annotation, in `service.anchors` and the `anchors` event:

| Status           | Meaning                                                 | Strategy                               |
| ---------------- | ------------------------------------------------------- | -------------------------------------- |
| `attached`       | Found exactly                                           | `position`, `quote`, or `unique-quote` |
| `attached-fuzzy` | Found approximately; the text may have moved or changed | `fuzzy`                                |
| `orphan`         | Not found; the passage was removed or changed too much  | none                                   |

Show `attached-fuzzy` differently (for example, with a dotted underline and a note), and give
orphans a place of their own, such as a panel listing their original quotes.

## Snapshots

Indexing the page is the expensive step. `AnchorEngine.snapshot(root)` indexes the root once; the
service does this for you on `attach`, on `refreshAnchors`, and after every change. Resolving 500
annotations against one snapshot took 0.6 to 2.5 ms in our measurements, on Apple Silicon.

A snapshot is valid for one DOM state. After the page changes, call `service.refreshAnchors()`.
If you use the engine directly, build a new snapshot.

## Concurrency

Every write goes through the store with the version it last read. A store rejects a stale version
with a conflict. See [Concurrency and versions](guides/concurrency.md), including the gap in the
protocol store.

## Limitations

These are the current limits, not plans:

- **Text only.** Images, video, and PDF selectors are not implemented.
- **Edits inside a quote are not recovered by default.** When someone edits the words of an
  annotated passage, exact matching orphans it. Fuzzy matching recovers small edits, but it can
  also attach to the wrong text. Keep a text revision history in your content system if this
  matters to you.
- **Versions are not loaded from the protocol list.** See
  [Concurrency and versions](guides/concurrency.md#known-gap-protocol-list-versions).
- **No highlight wiring in core or React.** You draw highlights yourself (see
  [Highlights](guides/highlights.md)).
- **No edit history.** `update` replaces the body; the previous text is not kept.
- **No offline queue.** Writes fail when the store is unreachable; nothing is retried.
- **Single root.** A service anchors in one DOM root. Create one service per independent root.
