import { describe, expect, it, vi } from 'vitest';
import {
  CssHighlightRenderer,
  MarkHighlightRenderer,
  createHighlightRenderer,
} from '@spannote/render';

function textRange(root: HTMLElement, needle: string): Range {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const at = (n as Text).data.indexOf(needle);
    if (at !== -1) {
      const r = document.createRange();
      r.setStart(n, at);
      r.setEnd(n, at + needle.length);
      return r;
    }
  }
  throw new Error('not found');
}

/** Stands in for the browser's Highlight constructor. */
class FakeHighlight {
  readonly ranges: Range[];
  constructor(...ranges: Range[]) {
    this.ranges = ranges;
  }
}

describe('CssHighlightRenderer', () => {
  it('registers a named highlight with the registry and removes it on clear', () => {
    const registry = { set: vi.fn(), delete: vi.fn(() => true) };
    const renderer = new CssHighlightRenderer(registry, FakeHighlight, 'al');
    const range = document.createRange();

    renderer.draw('comments', [range]);
    expect(registry.set).toHaveBeenCalledWith('al-comments', expect.any(FakeHighlight));

    renderer.clear('comments');
    expect(registry.delete).toHaveBeenCalledWith('al-comments');
  });

  it('disposes every group it drew', () => {
    const registry = { set: vi.fn(), delete: vi.fn(() => true) };
    const renderer = new CssHighlightRenderer(registry, FakeHighlight);
    renderer.draw('a', []);
    renderer.draw('b', []);
    renderer.dispose();
    expect(registry.delete).toHaveBeenCalledTimes(2);
  });
});

describe('createHighlightRenderer', () => {
  it('chooses the CSS Highlight API when the environment has it', () => {
    const renderer = createHighlightRenderer({
      environment: { highlights: { set: vi.fn(), delete: vi.fn() }, Highlight: FakeHighlight },
    });
    expect(renderer).toBeInstanceOf(CssHighlightRenderer);
  });

  it('falls back to marks when the API is missing', () => {
    expect(createHighlightRenderer({ environment: {} })).toBeInstanceOf(MarkHighlightRenderer);
  });
});

describe('MarkHighlightRenderer', () => {
  it('wraps the covered text and restores the original DOM on clear', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Hello <em>brave</em> new world</p>';
    const before = root.innerHTML;

    const renderer = new MarkHighlightRenderer('hl');
    renderer.draw('g', [textRange(root, 'new world')]);
    expect(root.querySelectorAll('mark.hl')).toHaveLength(1);
    expect(root.querySelector('mark.hl')?.textContent).toBe('new world');

    renderer.clear('g');
    expect(root.innerHTML).toBe(before);
  });
});
