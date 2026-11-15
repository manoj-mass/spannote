# Concurrency and versions

Two people can edit the same annotation. SpanNote prevents silent overwrites with **versions**:
each write says which version it started from, and the store refuses it if that version is no
longer current.

## How it works

1. A read returns the annotation with its version (an ETag in the protocol, a sequence number in
   memory).
2. A write passes that version back (`If-Match` in the protocol).
3. If the stored version has changed, the store rejects the write with a conflict.

```ts
import { isVersionConflict } from '@spannote/model';

try {
  await service.update(id, { body: 'Revised comment' });
} catch (error) {
  if (isVersionConflict(error)) {
    await service.load(); // re-read the list, then let the user merge and retry
  } else {
    throw error;
  }
}
```

## What the service does

- `service.load()` reads every annotation and stores the version each one came with.
- `service.update` and `service.remove` use the version stored for that annotation.
- `service.createFromRange` and `service.reply` create annotations; the store assigns the version.
- After a successful write, the service stores the new version.

## Known gap: protocol list versions

With `ProtocolAnnotationStore`, `load()` cannot read ETags for list items, so their versions are
`undefined`. A write without a version has no precondition, so it cannot detect a concurrent change.

This is a real limitation today. See [Storage](storage.md#known-gap-protocol-list-versions) for the
workaround.

The in-memory store is not affected: it keeps versions for everything it stores.

## Choosing a conflict policy

| Policy                           | When it fits                  | How                                                                   |
| -------------------------------- | ----------------------------- | --------------------------------------------------------------------- |
| Reject and ask the user to retry | Editing long comments         | Catch the conflict, reload, show the new text                         |
| Last write wins                  | Short comments, rarely edited | Pass `undefined` as the version (the default for protocol list items) |
| Merge                            | Structured data               | Reload, merge the fields you own, write again                         |

Replies never conflict with each other: each reply is a new annotation. Only edits to an existing
annotation can conflict.
