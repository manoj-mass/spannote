/**
 * Draws highlights for a set of live DOM ranges. Implementations decide the mechanism (CSS
 * Custom Highlight API or mark wrapping). Callers depend only on this interface (Liskov and
 * Dependency Inversion).
 */
export interface HighlightRenderer {
  /** Draws (or replaces) the highlight group `name` over `ranges`. */
  draw(name: string, ranges: readonly Range[]): void;
  /** Removes the highlight group `name`. Unknown names are ignored. */
  clear(name: string): void;
  /** Removes every group this renderer drew. */
  dispose(): void;
}

/** The subset of `CSS.highlights` this package uses. Injectable for tests. */
export interface HighlightRegistry {
  set(name: string, highlight: unknown): unknown;
  delete(name: string): boolean;
}

/** The subset of the `Highlight` constructor this package uses. */
export type HighlightConstructor = new (...ranges: Range[]) => unknown;
