import { AnchorEngine, type AnchorSnapshot, type Resolution } from '@spannote/anchor';
import type {
  Agent,
  Annotation,
  AnnotationStatus,
  AnnotationStore,
  Motivation,
  Versioned,
} from '@spannote/model';
import { buildAnnotation, randomId } from './factory.js';
import { EventHub } from './events.js';
import type { AnchorState } from './state.js';

/** What the user wrote, before it becomes an annotation. */
export interface AnnotationDraft {
  readonly body: string;
  readonly motivation?: Motivation;
  readonly status?: AnnotationStatus;
}

export interface AnnotationServiceOptions {
  readonly store: AnnotationStore;
  /** Anchor engine. Defaults to an engine with the standard resolver chain. */
  readonly engine?: AnchorEngine;
  /** Identity of the author of new annotations. */
  readonly creator?: Agent;
  /** Page the annotations refer to. Defaults to the current document URL. */
  readonly source?: () => string;
  /** Clock, injectable for tests. */
  readonly now?: () => Date;
  /** Identifier source for new annotations, injectable for tests. */
  readonly newId?: () => string;
}

/** Events the service emits. Listeners receive immutable snapshots. */
export type AnnotationServiceEvents = {
  readonly change: readonly Annotation[];
  readonly anchors: ReadonlyMap<string, AnchorState>;
};

/** Raised when a selection contains no text that can be described. */
export class EmptySelectionError extends Error {
  override readonly name = 'EmptySelectionError';
  constructor() {
    super('The selection does not cover any text that can be annotated.');
  }
}

const defaultSource = (): string =>
  (globalThis as { location?: { href?: string } }).location?.href ?? 'about:blank';

/**
 * The application service: owns the annotation list, keeps anchors current, and writes through
 * the store. It has no framework and no HTTP dependency (Single Responsibility, Dependency
 * Inversion). Bindings subscribe to its events.
 *
 * Anchors are valid for one DOM state. Call `refreshAnchors` after the page changes, or let a
 * binding do it.
 */
export class AnnotationService {
  private readonly events = new EventHub<AnnotationServiceEvents>();
  private readonly engine: AnchorEngine;
  private readonly store: AnnotationStore;
  private readonly options: AnnotationServiceOptions;
  private entries = new Map<string, Versioned<Annotation>>();
  private annotationList: readonly Annotation[] = [];
  private anchorStates: ReadonlyMap<string, AnchorState> = new Map();
  private root: Node | undefined;

  constructor(options: AnnotationServiceOptions) {
    this.options = options;
    this.store = options.store;
    this.engine = options.engine ?? new AnchorEngine();
  }

  /** The annotations, sorted by creation time. The array is replaced on every change. */
  get annotations(): readonly Annotation[] {
    return this.annotationList;
  }

  /** Anchor state per annotation id. Replaced on every refresh. */
  get anchors(): ReadonlyMap<string, AnchorState> {
    return this.anchorStates;
  }

  /** Subscribes to `change` or `anchors`. Returns the unsubscribe function. */
  on<K extends keyof AnnotationServiceEvents>(
    event: K,
    listener: (payload: AnnotationServiceEvents[K]) => void,
  ): () => void {
    return this.events.on(event, listener);
  }

  /** Loads every annotation from the store and refreshes anchors. */
  async load(): Promise<void> {
    const list = await this.store.list();
    this.entries = new Map(list.map((v) => [v.value.id, v]));
    this.publishChange();
    this.refreshAnchors();
  }

  /** Sets the DOM root the annotations are anchored in, then resolves anchors. */
  attach(root: Node): void {
    this.root = root;
    this.refreshAnchors();
  }

  /** Stops anchoring. Annotations remain loaded. */
  detach(): void {
    this.root = undefined;
    this.setAnchors(new Map());
  }

  /** Re-resolves every annotation against the current DOM. Cheap enough to call on mutation. */
  refreshAnchors(): void {
    if (!this.root) {
      this.setAnchors(new Map());
      return;
    }
    const snapshot = this.engine.snapshot(this.root);
    const next = new Map<string, AnchorState>();
    for (const annotation of this.annotationList) {
      next.set(annotation.id, this.stateFor(annotation, snapshot));
    }
    this.setAnchors(next);
  }

  /** Creates an annotation for the selected range. Requires an attached root. */
  async createFromRange(range: Range, draft: AnnotationDraft): Promise<Annotation> {
    const snapshot = this.requireSnapshot();
    const selectors = this.engine.describe(snapshot, range);
    if (selectors.length === 0) throw new EmptySelectionError();
    const annotation = buildAnnotation({
      id: (this.options.newId ?? randomId)(),
      source: (this.options.source ?? defaultSource)(),
      selectors,
      motivation: draft.motivation ?? 'commenting',
      body: draft.body,
      created: this.now(),
      ...(this.options.creator !== undefined ? { creator: this.options.creator } : {}),
      ...(draft.status !== undefined ? { status: draft.status } : {}),
    });
    return this.persistNew(annotation);
  }

  /** Replies to `parent`. The reply shares the parent's target and points back at it. */
  async reply(parent: Annotation, draft: Omit<AnnotationDraft, 'motivation'>): Promise<Annotation> {
    const annotation = buildAnnotation({
      id: (this.options.newId ?? randomId)(),
      source: parent.target.source,
      selectors: [...parent.target.selector],
      motivation: 'replying',
      body: draft.body,
      created: this.now(),
      inReplyTo: parent.id,
      ...(this.options.creator !== undefined ? { creator: this.options.creator } : {}),
      ...(draft.status !== undefined ? { status: draft.status } : {}),
    });
    return this.persistNew(annotation);
  }

  /** Changes the body and/or status of an annotation. Uses the version read at load time. */
  async update(
    id: string,
    changes: { readonly body?: string; readonly status?: AnnotationStatus },
  ): Promise<Annotation> {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Annotation ${id} is not loaded.`);
    const current = entry.value;
    const body =
      changes.body !== undefined
        ? [{ type: 'TextualBody' as const, value: changes.body, format: 'text/plain' as const }]
        : current.body;
    const next: Annotation = {
      ...current,
      body,
      modified: this.now(),
      ...(changes.status !== undefined ? { status: changes.status } : {}),
    };
    const saved = await this.store.update(next, entry.version);
    this.entries.set(saved.value.id, saved);
    this.publishChange();
    this.refreshAnchors();
    return saved.value;
  }

  /** Deletes an annotation. */
  async remove(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Annotation ${id} is not loaded.`);
    await this.store.remove(id, entry.version);
    this.entries.delete(id);
    this.publishChange();
    this.refreshAnchors();
  }

  private async persistNew(annotation: Annotation): Promise<Annotation> {
    const saved = await this.store.create(annotation);
    this.entries.set(saved.value.id, saved);
    this.publishChange();
    this.refreshAnchors();
    return saved.value;
  }

  private stateFor(annotation: Annotation, snapshot: AnchorSnapshot): AnchorState {
    const resolution: Resolution | undefined = this.engine.resolve(
      snapshot,
      annotation.target.selector,
    );
    if (!resolution) return { annotationId: annotation.id, status: 'orphan' };
    return {
      annotationId: annotation.id,
      status: resolution.strategy === 'fuzzy' ? 'attached-fuzzy' : 'attached',
      range: resolution.range,
      strategy: resolution.strategy,
      score: resolution.score,
    };
  }

  private requireSnapshot(): AnchorSnapshot {
    if (!this.root) throw new Error('Attach a root with attach() before creating annotations.');
    return this.engine.snapshot(this.root);
  }

  private now(): string {
    return (this.options.now ?? (() => new Date()))().toISOString();
  }

  private publishChange(): void {
    this.annotationList = [...this.entries.values()]
      .map((v) => v.value)
      .sort((a, b) => (a.created ?? '').localeCompare(b.created ?? ''));
    this.events.emit('change', this.annotationList);
  }

  private setAnchors(next: ReadonlyMap<string, AnchorState>): void {
    this.anchorStates = next;
    this.events.emit('anchors', next);
  }
}
