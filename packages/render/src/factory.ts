import { CssHighlightRenderer } from './css-highlight.js';
import { MarkHighlightRenderer } from './mark-highlight.js';
import type { HighlightConstructor, HighlightRegistry, HighlightRenderer } from './types.js';

/** The browser APIs a renderer needs. Pass a fake in tests. Defaults to the global environment. */
export interface RenderEnvironment {
  readonly highlights?: HighlightRegistry | undefined;
  readonly Highlight?: HighlightConstructor | undefined;
}

/** Reads the global CSS Custom Highlight API if the browser has it. */
export function globalHighlightEnvironment(): RenderEnvironment {
  const g = globalThis as unknown as {
    CSS?: { highlights?: HighlightRegistry };
    Highlight?: HighlightConstructor;
  };
  return { highlights: g.CSS?.highlights, Highlight: g.Highlight };
}

export interface CreateRendererOptions {
  readonly environment?: RenderEnvironment;
  /** Prefix for CSS highlight names. Default "spannote". */
  readonly prefix?: string;
  /** Class added to fallback marks. Default "spannote-highlight". */
  readonly className?: string;
}

/**
 * Chooses the best renderer for the environment: the CSS Custom Highlight API when present
 * (it leaves the DOM untouched), otherwise `<mark>` wrapping.
 */
export function createHighlightRenderer(options: CreateRendererOptions = {}): HighlightRenderer {
  const env = options.environment ?? globalHighlightEnvironment();
  if (env.highlights && env.Highlight) {
    return new CssHighlightRenderer(env.highlights, env.Highlight, options.prefix);
  }
  return new MarkHighlightRenderer(options.className);
}
