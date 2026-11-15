/** Sets the document body and returns the first text node containing `needle`. */
export function setBody(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

/** A live range over the first occurrence of `needle` in `root`'s text. */
export function rangeOver(needle: string, root: Node = document.body): Range {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Text).data;
    const at = data.indexOf(needle);
    if (at !== -1) {
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + needle.length);
      return range;
    }
  }
  throw new Error(`text not found: ${needle}`);
}

export const ARTICLE = `
  <h1>Pricing review</h1>
  <p>Across the base, 12% of users churn each quarter after the first renewal.</p>
  <p>Students can use annotations to refer back to key passages in a long document.</p>
`;

/** The first paragraph of `root`. Throws when there is none, so tests fail loudly. */
export function paragraph(root: ParentNode): HTMLElement {
  const p = root.querySelector('p');
  if (!p) throw new Error('no paragraph in fixture');
  return p;
}
