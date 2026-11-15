export type { HighlightConstructor, HighlightRegistry, HighlightRenderer } from './types.js';
export { CssHighlightRenderer } from './css-highlight.js';
export { MarkHighlightRenderer } from './mark-highlight.js';
export {
  createHighlightRenderer,
  globalHighlightEnvironment,
  type CreateRendererOptions,
  type RenderEnvironment,
} from './factory.js';
