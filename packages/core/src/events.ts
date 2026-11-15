type AnyListener = (payload: unknown) => void;

/**
 * A small typed event hub. Listener errors do not stop other listeners: each error is rethrown
 * asynchronously so it still surfaces in the console and error tracking.
 */
export class EventHub<Events extends { readonly [event: string]: unknown }> {
  private readonly listeners = new Map<keyof Events, Set<AnyListener>>();

  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void {
    const set = this.listeners.get(event) ?? new Set<AnyListener>();
    this.listeners.set(event, set);
    const erased = listener as AnyListener;
    set.add(erased);
    return () => {
      set.delete(erased);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        listener(payload);
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }

  /** Removes every listener. */
  clear(): void {
    this.listeners.clear();
  }
}
