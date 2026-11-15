/**
 * A text model decides which characters count as "the text of a page" and how they are counted.
 *
 * Two models exist on purpose:
 * - `POSITION_MODEL` is raw: every text node, whitespace kept, counted in code points. Offsets
 *   from this model are the interoperable ones (the spec counts code points).
 * - `QUOTE_MODEL` is normalized: non-content elements skipped and whitespace collapsed, so quotes
 *   survive reflows and non-breaking spaces.
 */
export interface TextModel {
  /** Human-readable name, used in diagnostics. */
  readonly name: string;
  /** Element names (upper case) whose text is ignored. */
  readonly skipElements: ReadonlySet<string>;
  /** Whether runs of whitespace (including non-breaking spaces) become a single space. */
  readonly collapseWhitespace: boolean;
}

const NON_CONTENT = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'] as const;
const CHROME = [
  'NAV',
  'HEADER',
  'FOOTER',
  'BUTTON',
  'SELECT',
  'OPTION',
  'TEXTAREA',
  'INPUT',
  'SVG',
] as const;

export const POSITION_MODEL: TextModel = Object.freeze({
  name: 'position',
  skipElements: new Set<string>(),
  collapseWhitespace: false,
});

export const QUOTE_MODEL: TextModel = Object.freeze({
  name: 'quote',
  skipElements: new Set<string>([...NON_CONTENT, ...CHROME]),
  collapseWhitespace: true,
});
