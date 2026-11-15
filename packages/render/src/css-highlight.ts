import type { HighlightConstructor, HighlightRegistry, HighlightRenderer } from './types.js';

/**
 * Renders with the CSS Custom Highlight API. Does not change the host DOM: highlights are
 * registered by name and styled with `::highlight(<name>)` in the host stylesheet.
 */
export class CssHighlightRenderer implements HighlightRenderer {
  private readonly names = new Set<string>();

  constructor(
    private readonly registry: HighlightRegistry,
    private readonly createHighlight: HighlightConstructor,
    private readonly prefix: string = 'spannote',
  ) {}

  draw(name: string, ranges: readonly Range[]): void {
    const key = this.keyFor(name);
    this.registry.set(key, new this.createHighlight(...ranges));
    this.names.add(key);
  }

  clear(name: string): void {
    const key = this.keyFor(name);
    this.registry.delete(key);
    this.names.delete(key);
  }

  dispose(): void {
    for (const key of this.names) this.registry.delete(key);
    this.names.clear();
  }

  /** The highlight name to use in CSS: `::highlight(spannote-<name>)`. */
  keyFor(name: string): string {
    return `${this.prefix}-${name}`;
  }
}
