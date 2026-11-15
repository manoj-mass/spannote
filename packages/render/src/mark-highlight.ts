import type { HighlightRenderer } from './types.js';

const SHOW_TEXT = 0x4;
const FILTER_ACCEPT = 1;
const FILTER_REJECT = 2;
const NAME_ATTRIBUTE = 'data-spannote-highlight';

interface TextPiece {
  readonly node: Text;
  readonly start: number;
  readonly end: number;
}

/**
 * Fallback renderer for browsers without the CSS Custom Highlight API. Wraps the covered text in
 * `<mark>` elements, the HTML element for text highlighted for reference. This is the only renderer
 * that edits the host DOM, so it is used only when necessary. `clear` restores the original text
 * nodes and touches only the marks this renderer created, so a page's own marks are left alone.
 */
export class MarkHighlightRenderer implements HighlightRenderer {
  private readonly groups = new Map<string, HTMLElement[]>();

  constructor(private readonly className: string = 'spannote-highlight') {}

  draw(name: string, ranges: readonly Range[]): void {
    this.clear(name);
    const marks: HTMLElement[] = [];
    for (const range of ranges) {
      for (const piece of textPiecesOf(range)) {
        marks.push(wrap(piece, this.className, name));
      }
    }
    this.groups.set(name, marks);
  }

  clear(name: string): void {
    const marks = this.groups.get(name);
    if (!marks) return;
    for (const mark of marks) unwrap(mark);
    this.groups.delete(name);
  }

  dispose(): void {
    for (const name of [...this.groups.keys()]) this.clear(name);
  }
}

/** Text pieces inside `range`, with start and end offsets clipped to the range. */
function textPiecesOf(range: Range): TextPiece[] {
  const root = range.commonAncestorContainer;
  if (root.nodeType === 3) {
    // A range inside one text node: the tree walker below would not visit the node itself.
    const text = root as Text;
    return range.endOffset > range.startOffset
      ? [{ node: text, start: range.startOffset, end: range.endOffset }]
      : [];
  }
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, SHOW_TEXT, {
    acceptNode: (node) => (range.intersectsNode(node) ? FILTER_ACCEPT : FILTER_REJECT),
  });
  const pieces: TextPiece[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const start = text === range.startContainer ? range.startOffset : 0;
    const end = text === range.endContainer ? range.endOffset : text.length;
    if (end > start) pieces.push({ node: text, start, end });
  }
  return pieces;
}

/** Isolates the piece's text in its own node and wraps it in a mark. */
function wrap(piece: TextPiece, className: string, name: string): HTMLElement {
  let target = piece.node;
  if (piece.end < target.length) target.splitText(piece.end);
  if (piece.start > 0) target = target.splitText(piece.start);
  const doc = target.ownerDocument;
  const mark = doc.createElement('mark');
  mark.className = className;
  mark.setAttribute(NAME_ATTRIBUTE, name);
  target.parentNode?.insertBefore(mark, target);
  mark.appendChild(target);
  return mark;
}

/** Moves the mark's children back to its place, then removes the mark. */
function unwrap(mark: HTMLElement): void {
  const parent = mark.parentNode;
  if (!parent) return;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  parent.removeChild(mark);
  parent.normalize();
}
