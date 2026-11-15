# @spannote/model

W3C Web Annotation data model for JavaScript: types, parsing of untrusted JSON, and JSON-LD serialization.

- No DOM and no runtime dependencies. Works in browsers, Node, Deno and workers.
- Parsing never throws. It returns `ok` with warnings, or `fail` with issues.
- SpanNote extension terms live in the `sn:` namespace (`https://spannote.dev/ns#`).

```ts
import { parseAnnotation, toJsonLd } from '@spannote/model';

const result = parseAnnotation(JSON.parse(payload));
if (result.ok) {
  const wire = toJsonLd(result.value.annotation);
} else {
  console.error(result.error); // [{ path, message }]
}
```

See the [package root](../../README.md) for the overall design.
