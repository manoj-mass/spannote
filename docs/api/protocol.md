# @spannote/protocol

A typed client for the [W3C Web Annotation Protocol](https://www.w3.org/TR/annotation-protocol/),
and an adapter that implements the model's `AnnotationStore`.

```ts
import {
  AnnotationProtocolClient,
  ProtocolAnnotationStore,
  ProtocolError,
  ConflictError,
  NotFoundError,
  type ProtocolClientOptions,
  type FetchLike,
  type HeaderProvider,
} from '@spannote/protocol';
```

## AnnotationProtocolClient

```ts
class AnnotationProtocolClient {
  constructor(options: ProtocolClientOptions);
  list(): Promise<readonly Versioned<Annotation>[]>;
  get(id: string): Promise<Versioned<Annotation>>;
  create(annotation: Annotation): Promise<Versioned<Annotation>>;
  update(annotation: Annotation, version: string | undefined): Promise<Versioned<Annotation>>;
  remove(id: string, version: string | undefined): Promise<void>;
}
```

`Versioned<T>` is `{ value: T; version: string | undefined }`. The `version` is the response's
`ETag`.

### list()

Sends `GET` to the container with `Prefer: return=representation; include="…PreferContainedDescriptions"`.
Reads `first` (embedded or an IRI) and follows `next` until there is none. A page that cannot be
parsed is skipped; items that fail `parseAnnotation` are skipped too.

Items carry `version: undefined`. See [Storage](../guides/storage.md#known-gap-protocol-list-versions).

### get(id)

`GET` the annotation. Throws `NotFoundError` on 404. Returns the ETag as the version.

### create(annotation)

`POST` to the container. Expects 201. Uses the response body when present; otherwise follows the
`Location` header with `get`. The returned annotation carries the server-assigned id.

### update(annotation, version)

`PUT` to `annotation.id`, with `If-Match: <version>` when `version` is not `undefined`. Throws
`ConflictError` on 412.

### remove(id, version)

`DELETE` with `If-Match` when a version is given. Accepts 204 or 200. Throws `NotFoundError` on
404 and `ConflictError` on 412.

## Options

```ts
interface ProtocolClientOptions {
  containerUrl: string; // the container IRI; include the trailing slash
  fetch?: FetchLike; // default: globalThis.fetch
  headers?: HeaderProvider; // extra headers for every request (for example Authorization)
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type HeaderProvider = () =>
  Readonly<Record<string, string>> | Promise<Readonly<Record<string, string>>>;
```

The client throws if no `fetch` is available and none was supplied.

## ProtocolAnnotationStore

```ts
class ProtocolAnnotationStore implements AnnotationStore {
  constructor(client: AnnotationProtocolClient);
}
```

Delegates each method of the store port to the client.

## Errors

```ts
class ProtocolError extends Error {
  readonly status: number;
  readonly body?: string;
  constructor(status: number, message: string, body?: string);
}
class ConflictError extends ProtocolError {
  /* status 412 */
}
class NotFoundError extends ProtocolError {
  /* status 404 */
}
```

Other non-success responses throw `ProtocolError` with the status and the response body.

## Limits of the protocol

The W3C protocol does not define search, live updates, or partial updates. SpanNote does not
implement them; use an extension your server provides, or fetch and filter on the client.

The client does not retry. Add retries inside your `fetch` wrapper.
