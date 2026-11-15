import {
  VersionConflictError,
  type Annotation,
  type AnnotationStore,
  type Versioned,
} from '@spannote/model';

/**
 * In-memory store: for tests, demos and offline-only use. Versions are sequence numbers, and
 * stale writes are rejected with `VersionConflictError`, as an HTTP store would reject a 412.
 * Methods return promises, so callers can swap in a network store without changes.
 */
export class MemoryAnnotationStore implements AnnotationStore {
  private readonly entries = new Map<string, { annotation: Annotation; version: number }>();
  private sequence = 0;

  list(): Promise<readonly Versioned<Annotation>[]> {
    return Promise.resolve(
      [...this.entries.values()].map((e) => ({ value: e.annotation, version: String(e.version) })),
    );
  }

  create(annotation: Annotation): Promise<Versioned<Annotation>> {
    if (this.entries.has(annotation.id)) {
      return Promise.reject(
        new VersionConflictError(`Annotation ${annotation.id} already exists.`),
      );
    }
    const version = ++this.sequence;
    this.entries.set(annotation.id, { annotation, version });
    return Promise.resolve({ value: annotation, version: String(version) });
  }

  update(annotation: Annotation, version: string | undefined): Promise<Versioned<Annotation>> {
    const current = this.entries.get(annotation.id);
    if (!current) return Promise.reject(new Error(`Annotation ${annotation.id} not found.`));
    if (version !== undefined && version !== String(current.version)) {
      return Promise.reject(new VersionConflictError());
    }
    const next = ++this.sequence;
    this.entries.set(annotation.id, { annotation, version: next });
    return Promise.resolve({ value: annotation, version: String(next) });
  }

  remove(id: string, version: string | undefined): Promise<void> {
    const current = this.entries.get(id);
    if (!current) return Promise.reject(new Error(`Annotation ${id} not found.`));
    if (version !== undefined && version !== String(current.version)) {
      return Promise.reject(new VersionConflictError());
    }
    this.entries.delete(id);
    return Promise.resolve();
  }
}
