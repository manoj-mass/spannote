import type { Annotation, AnnotationStore, Versioned } from '@spannote/model';
import type { AnnotationProtocolClient } from './client.js';

/** Adapts the protocol client to the model's storage port, so the core never sees HTTP. */
export class ProtocolAnnotationStore implements AnnotationStore {
  constructor(private readonly client: AnnotationProtocolClient) {}

  list(): Promise<readonly Versioned<Annotation>[]> {
    return this.client.list();
  }

  create(annotation: Annotation): Promise<Versioned<Annotation>> {
    return this.client.create(annotation);
  }

  update(annotation: Annotation, version: string | undefined): Promise<Versioned<Annotation>> {
    return this.client.update(annotation, version);
  }

  async remove(id: string, version: string | undefined): Promise<void> {
    await this.client.remove(id, version);
  }
}
