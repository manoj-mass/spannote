import type { Annotation } from './types.js';

/** An annotation together with its version token (the HTTP ETag, or any opaque string). */
export interface Versioned<T> {
  readonly value: T;
  readonly version: string | undefined;
}

/**
 * Storage port: what the core needs from any backend. Adapters (HTTP, memory, IndexedDB) implement
 * it. The core depends on this interface, never on a concrete adapter (Dependency Inversion).
 *
 * `update` and `remove` take the version they last read, so the backend can reject lost updates.
 * A backend that rejects a stale version must throw a `ConflictError`-style error with status 412.
 */
export interface AnnotationStore {
  list(): Promise<readonly Versioned<Annotation>[]>;
  create(annotation: Annotation): Promise<Versioned<Annotation>>;
  update(annotation: Annotation, version: string | undefined): Promise<Versioned<Annotation>>;
  remove(id: string, version: string | undefined): Promise<void>;
}
