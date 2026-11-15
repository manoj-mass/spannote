export type { HighlightConstructor, HighlightRegistry, HighlightRenderer } from './types.js';
export { CssHighlightRenderer } from './css-highlight.js';
export { SpanHighlightRenderer } from './span-highlight.js';
export {
  createHighlightRenderer,
  globalHighlightEnvironment,
  type CreateRendererOptions,
  type RenderEnvironment,
} from './factory.js';
