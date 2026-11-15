# Storage

The service writes through a store. A store implements `AnnotationStore` from
`@spannote/model`. Two are provided.

## MemoryAnnotationStore

Keeps annotations in memory. Use it for demos, tests, and offline-only pages. Nothing survives a
reload.

```ts
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';

const service = new AnnotationService({ store: new MemoryAnnotationStore() });
```

Versions are sequence numbers. A write with a stale version rejects with `VersionConflictError`,
as an HTTP store would reject a 412.

## ProtocolAnnotationStore (W3C Annotation Protocol)

Talks to any server that implements the [W3C Annotation Protocol](https://www.w3.org/TR/annotation-protocol/).

```ts
import { AnnotationProtocolClient, ProtocolAnnotationStore } from '@spannote/protocol';
import { AnnotationService } from '@spannote/core';

const client = new AnnotationProtocolClient({
  containerUrl: 'https://annotations.example.org/anno/',
  headers: async () => ({ Authorization: `Bearer ${await currentToken()}` }),
});

const service = new AnnotationService({ store: new ProtocolAnnotationStore(client) });
```

### What the client does

| Operation                     | Request                                                                        | Success              | Errors                                       |
| ----------------------------- | ------------------------------------------------------------------------------ | -------------------- | -------------------------------------------- |
| `list()`                      | `GET` the container with `Prefer` for descriptions; follows `first` and `next` | 200                  | `ProtocolError`                              |
| `get(id)`                     | `GET` the annotation with the protocol media type                              | 200                  | `NotFoundError`, `ProtocolError`             |
| `create(annotation)`          | `POST` to the container                                                        | 201, with `Location` | `ProtocolError`                              |
| `update(annotation, version)` | `PUT` with `If-Match: <version>`                                               | 200                  | `ConflictError` (412), `ProtocolError`       |
| `remove(id, version)`         | `DELETE` with `If-Match` when a version is given                               | 204                  | `ConflictError` (412), `NotFoundError` (404) |

Every request sends the media type `application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"`.
A `create` that returns a body uses it; otherwise the client follows `Location`.

### Options

```ts
interface ProtocolClientOptions {
  containerUrl: string; // the LDP container, with a trailing slash
  fetch?: FetchLike; // default: globalThis.fetch
  headers?: HeaderProvider; // called before every request
}
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type HeaderProvider = () => Record<string, string> | Promise<Record<string, string>>;
```

Inject `fetch` in tests, or to add retries, logging, or a custom agent.

### Errors

```ts
class ProtocolError extends Error {
  status: number;
  body?: string;
}
class ConflictError extends ProtocolError {} // status 412
class NotFoundError extends ProtocolError {} // status 404
```

Catch `ConflictError` for lost updates, or use `isVersionConflict(error)` from `@spannote/model`,
which also recognises any error with `status === 412`.

## Known gap: protocol list versions

`list()` returns items without ETags, because the container's embedded descriptions do not carry
them. `service.load()` stores those items with no version. Consequently, `service.update` and
`service.remove` for a loaded annotation send **no** `If-Match` header, and a concurrent edit by
someone else is overwritten silently.

Until this is fixed, you have two options:

- Call `client.get(id)` yourself before writing, and write with the returned version. The service
  does not do this for you.
- Accept last-write-wins for comments that are rarely edited concurrently, and say so in your
  product documentation.

The fix belongs in the library: `list()` should fetch ETags (or the service should read each item
before writing). That change is not made yet.

## Server-side credentials

Do not put long-lived tokens in browser code. Proxy the protocol through your own route handler:

```ts
// Browser: point the client at your handler. No token here.
const client = new AnnotationProtocolClient({ containerUrl: '/api/annotations/' });
```

```ts
// Server (for example app/api/annotations/[[...path]]/route.ts): add the token and forward.
export async function handler(request: Request): Promise<Response> {
  const target = new URL(
    request.url.replace('/api/annotations', 'https://annotations.example.org/anno'),
  );
  return fetch(target, {
    method: request.method,
    headers: { ...Object.fromEntries(request.headers), Authorization: `Bearer ${serverToken()}` },
    body: request.method === 'GET' || request.method === 'DELETE' ? undefined : request.body,
  });
}
```

Adapt the forwarding to your framework and to your authentication. Strip headers you do not want
to forward, and check that the route is only reachable by signed-in users.

## Writing your own adapter

Implement the four methods of `AnnotationStore`:

```ts
import type { Annotation, AnnotationStore, Versioned } from '@spannote/model';
import { VersionConflictError } from '@spannote/model';

export class LocalStorageStore implements AnnotationStore {
  constructor(private readonly key = 'spannote') {}

  private read(): Record<string, { value: Annotation; version: number }> {
    return JSON.parse(localStorage.getItem(this.key) ?? '{}') as Record<
      string,
      { value: Annotation; version: number }
    >;
  }

  private write(data: Record<string, { value: Annotation; version: number }>): void {
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  list(): Promise<readonly Versioned<Annotation>[]> {
    return Promise.resolve(
      Object.values(this.read()).map((e) => ({ value: e.value, version: String(e.version) })),
    );
  }

  create(annotation: Annotation): Promise<Versioned<Annotation>> {
    const data = this.read();
    data[annotation.id] = { value: annotation, version: 1 };
    this.write(data);
    return Promise.resolve({ value: annotation, version: '1' });
  }

  update(annotation: Annotation, version: string | undefined): Promise<Versioned<Annotation>> {
    const data = this.read();
    const current = data[annotation.id];
    if (!current) return Promise.reject(new Error(`${annotation.id} not found`));
    if (version !== undefined && version !== String(current.version)) {
      return Promise.reject(new VersionConflictError());
    }
    const next = current.version + 1;
    data[annotation.id] = { value: annotation, version: next };
    this.write(data);
    return Promise.resolve({ value: annotation, version: String(next) });
  }

  remove(id: string, version: string | undefined): Promise<void> {
    const data = this.read();
    const current = data[id];
    if (!current) return Promise.reject(new Error(`${id} not found`));
    if (version !== undefined && version !== String(current.version)) {
      return Promise.reject(new VersionConflictError());
    }
    delete data[id];
    this.write(data);
    return Promise.resolve();
  }
}
```

Rules every store must follow (the service relies on them):

1. `list` returns every annotation, with a version when you have one.
2. `create` returns the stored annotation. Use the id the store assigns; the service uses it.
3. `update` and `remove` reject a version that is no longer current with a conflict error
   (`VersionConflictError`, or any error with `status: 412`).
4. A missing `version` (`undefined`) means "no precondition": write unconditionally.
5. Errors propagate. Do not swallow them; the service and its callers decide what to do.
