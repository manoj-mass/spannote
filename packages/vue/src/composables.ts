import {
  computed,
  getCurrentInstance,
  inject,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
} from 'vue';
import type { AnchorState, AnnotationService } from '@spannote/core';
import type { Annotation } from '@spannote/model';
import { SPANNOTE_SERVICE_KEY } from './plugin.js';

/** The service provided by `SpanNotePlugin`. Throws when the plugin is not installed. */
export function useAnnotationService(): AnnotationService {
  if (!getCurrentInstance()) {
    throw new Error('useAnnotationService() must be called inside setup() or another composable.');
  }
  const service = inject(SPANNOTE_SERVICE_KEY, undefined);
  if (!service) {
    throw new Error('useAnnotationService() needs app.use(SpanNotePlugin, { service }).');
  }
  return service;
}

/**
 * Reads service state into a Vue ref that updates when the service emits an event. The ref holds the
 * service's own immutable snapshot, so Vue compares by reference and only re-renders on real changes.
 */
function useServiceState<T>(
  read: (service: AnnotationService) => T,
  event: 'change' | 'anchors',
): ComputedRef<T> {
  const service = useAnnotationService();
  const state = shallowRef<T>(read(service));
  const stop = service.on(event, () => {
    state.value = read(service);
  });
  onScopeDispose(stop);
  // Vue unwraps generic refs to `any`, so the read is typed explicitly.
  return computed<T>(() => state.value as T);
}

/** The current annotations, sorted by creation time. */
export function useAnnotations(): ComputedRef<readonly Annotation[]> {
  return useServiceState((service) => service.annotations, 'change');
}

/** The anchor state of every annotation, keyed by annotation id. */
export function useAnchorStates(): ComputedRef<ReadonlyMap<string, AnchorState>> {
  return useServiceState((service) => service.anchors, 'anchors');
}

/** The anchor state of one annotation, or `undefined` while it is unknown. */
export function useAnchor(
  annotationId: MaybeRefOrGetter<string>,
): ComputedRef<AnchorState | undefined> {
  const states = useAnchorStates();
  return computed(() => states.value.get(toValue(annotationId)));
}

/**
 * Attaches the service to a DOM root while the calling component is mounted, and re-attaches when the
 * root changes. Detaches when the component's scope ends.
 */
export function useSpanNoteRoot(root: MaybeRefOrGetter<Node | null | undefined>): void {
  const service = useAnnotationService();
  watch(
    () => toValue(root),
    (node) => {
      if (node) service.attach(node);
      else service.detach();
    },
    { immediate: true },
  );
  onScopeDispose(() => {
    service.detach();
  });
}
