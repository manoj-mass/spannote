import type { TextModel } from './text-model.js';

// DOM constants are inlined so the module works without a global NodeFilter (SSR, workers).
const SHOW_TEXT = 0x4;
const FILTER_ACCEPT = 1;
const FILTER_REJECT = 2;

/** Where one UTF-16 code unit of the index comes from in the DOM. */
export interface CharLocation {
  readonly node: Text;
  readonly offset: number;
}

/** A flat text view of a DOM root, built once per DOM state and reused for many lookups. */
export interface TextIndex {
  readonly model: TextModel;
  readonly text: string;
  /** One entry per UTF-16 code unit of `text`. */
  readonly locations: readonly CharLocation[];
  /** Unit index where each code point starts. The last entry is `text.length`. */
  readonly codePointStarts: readonly number[];
}

/** Half-open span of code units: [start, end). */
export type UnitSpan = readonly [start: number, end: number];

function isWhitespace(ch: string): boolean {
  return /\s/.test(ch);
}

function acceptsText(node: Node, root: Node, model: TextModel): boolean {
  for (let parent = node.parentElement; parent && parent !== root; parent = parent.parentElement) {
    if (model.skipElements.has(parent.tagName.toUpperCase())) return false;
  }
  return true;
}

function codePointStartsOf(text: string): number[] {
  const starts: number[] = [];
  for (let unit = 0; unit < text.length;) {
    starts.push(unit);
    unit += (text.codePointAt(unit) ?? 0) > 0xffff ? 2 : 1;
  }
  starts.push(text.length);
  return starts;
}

/** Builds the text index for `root` under `model`. Pure with respect to the DOM (no mutation). */
export function buildTextIndex(root: Node, model: TextModel): TextIndex {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, SHOW_TEXT, {
    acceptNode: (node) => (acceptsText(node, root, model) ? FILTER_ACCEPT : FILTER_REJECT),
  });

  const units: string[] = [];
  const locations: CharLocation[] = [];
  let lastWasSpace = true;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const data = text.data;
    for (let i = 0; i < data.length; i++) {
      const ch = data.charAt(i);
      if (model.collapseWhitespace && isWhitespace(ch)) {
        if (lastWasSpace) continue;
        units.push(' ');
        locations.push({ node: text, offset: i });
        lastWasSpace = true;
        continue;
      }
      units.push(ch);
      locations.push({ node: text, offset: i });
      lastWasSpace = false;
    }
  }

  if (model.collapseWhitespace && units.length > 0 && units[units.length - 1] === ' ') {
    units.pop();
    locations.pop();
  }

  const full = units.join('');
  return { model, text: full, locations, codePointStarts: codePointStartsOf(full) };
}

/** Converts a code-unit index into a code-point index (binary search over the table). */
export function codePointIndexOf(index: TextIndex, unit: number): number {
  const starts = index.codePointStarts;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((starts[mid] ?? 0) < unit) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Converts a code-point index into a code-unit index, or `undefined` when out of range. */
export function unitIndexOf(index: TextIndex, codePoint: number): number | undefined {
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint < index.codePointStarts.length
    ? index.codePointStarts[codePoint]
    : undefined;
}

/**
 * Finds the code-unit span of `range` inside the index: a character is inside when both of its
 * boundary points are inside the range. Returns `undefined` when the range covers no indexed text.
 */
export function spanOf(index: TextIndex, range: Range): UnitSpan | undefined {
  let start = -1;
  let end = -1;
  for (let i = 0; i < index.locations.length; i++) {
    const loc = index.locations[i];
    if (!loc) continue;
    const inside =
      range.comparePoint(loc.node, loc.offset) === 0 &&
      range.comparePoint(loc.node, loc.offset + 1) === 0;
    if (inside) {
      if (start < 0) start = i;
      end = i + 1;
    } else if (start >= 0) {
      break;
    }
  }
  return start < 0 ? undefined : [start, end];
}

/** Turns a code-unit span back into a live DOM `Range`. */
export function rangeOf(index: TextIndex, span: UnitSpan): Range | undefined {
  const [start, end] = span;
  if (end <= start) return undefined;
  const first = index.locations[start];
  const last = index.locations[end - 1];
  if (!first || !last) return undefined;
  const doc = first.node.ownerDocument;
  const range = doc.createRange();
  range.setStart(first.node, first.offset);
  range.setEnd(last.node, last.offset + 1);
  return range;
}
