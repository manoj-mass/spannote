# @spannote/protocol

A typed client for the [W3C Web Annotation Protocol](https://www.w3.org/TR/annotation-protocol/),
plus an adapter that implements the model's `AnnotationStore` port.

- Uses the protocol's media type, `If-Match` ETags for concurrency, `Location` on create, and
  paged containers (`first` and `next`).
- Injected `fetch` and header provider, so it runs in browsers, Node, and tests without globals.
- Throws `ConflictError` (412), `NotFoundError` (404) and `ProtocolError` for other failures.

```ts
import { AnnotationProtocolClient, ProtocolAnnotationStore } from '@spannote/protocol';

const client = new AnnotationProtocolClient({
  containerUrl: 'https://example.org/annotations/',
  headers: async () => ({ Authorization: `Bearer ${await getToken()}` }),
});
const store = new ProtocolAnnotationStore(client);
```

Search, live updates and PATCH are not part of the W3C protocol and are not implemented here.
