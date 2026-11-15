import { computed, DestroyRef, effect, inject, signal, type Signal } from '@angular/core';
import type { AnchorState, AnnotationService } from '@spannote/core';
import type { Annotation } from '@spannote/model';
import { SPANNOTE_SERVICE } from './token';

/**
 * The service registered by `provideSpanNote`. Must run in an injection context (a constructor, a field
 * initialiser, or `runInInjectionContext`). Throws a clear error when the provider is missing.
 */
export function injectSpanNote(): AnnotationService {
  const service = inject(SPANNOTE_SERVICE, { optional: true });
  if (!service) {
    throw new Error(
      'injectSpanNote() needs provideSpanNote(service) in the application providers.',
    );
  }
  return service;
}

/**
 * A read-only signal of one service value. The signal is set from the service's own events, and the
 * subscription ends when the injector is destroyed.
 */
function serviceSignal<T>(
  read: (service: AnnotationService) => T,
  event: 'change' | 'anchors',
): Signal<T> {
  const service = injectSpanNote();
  const state = signal<T>(read(service));
  const stop = service.on(event, () => {
    state.set(read(service));
  });
  inject(DestroyRef).onDestroy(stop);
  return state.asReadonly();
}

/** The current annotations, sorted by creation time. */
export function injectAnnotations(): Signal<readonly Annotation[]> {
  return serviceSignal((service) => service.annotations, 'change');
}

/** The anchor state of every annotation, keyed by annotation id. */
export function injectAnchorStates(): Signal<ReadonlyMap<string, AnchorState>> {
  return serviceSignal((service) => service.anchors, 'anchors');
}

/**
 * The anchor state of one annotation. Pass a function so that the signal follows a changing id:
 * `injectAnchor(() => this.id())`.
 */
export function injectAnchor(annotationId: () => string): Signal<AnchorState | undefined> {
  const states = injectAnchorStates();
  return computed(() => states().get(annotationId()));
}

/**
 * Attaches the service to the DOM root returned by `root`, and re-attaches when the root changes.
 * The service is detached when the injector is destroyed. Attaching runs in an effect, so it happens
 * during change detection rather than immediately.
 */
export function attachSpanNoteRoot(root: () => Node | null | undefined): void {
  const service = injectSpanNote();
  effect(() => {
    const node = root();
    if (node) service.attach(node);
    else service.detach();
  });
  inject(DestroyRef).onDestroy(() => {
    service.detach();
  });
}
