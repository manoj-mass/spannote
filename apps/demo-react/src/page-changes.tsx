import type { AnnotationService } from '@spannote/core';

interface PageChangesProps {
  readonly article: HTMLElement | null;
  readonly service: AnnotationService;
  readonly report: (message: string) => void;
}

/** Edits the article's DOM the way a real page might change, then re-resolves the anchors. */
export function PageChanges({ article, service, report }: PageChangesProps) {
  const apply =
    (label: string, change: (root: HTMLElement, firstQuote: string | undefined) => void) => () => {
      if (!article) {
        report('The article is not mounted yet.');
        return;
      }
      change(article, firstQuote(service));
      service.refreshAnchors();
      report(`${label}: anchors re-resolved.`);
    };

  return (
    <section className="panel" aria-labelledby="page-changes-heading">
      <h2 id="page-changes-heading">Simulate page changes</h2>
      <p className="hint">Each button changes the article, then re-resolves every anchor.</p>
      <div className="button-row">
        <button type="button" onClick={apply('Insert ad', insertAd)}>
          Insert ad
        </button>
        <button type="button" onClick={apply('Wrap content', wrapContent)}>
          Wrap content
        </button>
        <button type="button" onClick={apply('Reword first quote', rewordQuote)}>
          Reword first quote
        </button>
        <button type="button" onClick={apply('Duplicate first quote', duplicateQuote)}>
          Duplicate quote
        </button>
        <button type="button" onClick={apply('Non-breaking spaces', nonBreakingSpaces)}>
          Non-breaking spaces
        </button>
        <button
          type="button"
          onClick={() => {
            service.refreshAnchors();
            report('Anchors re-resolved.');
          }}
        >
          Refresh anchors
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload page
        </button>
      </div>
    </section>
  );
}

function firstQuote(service: AnnotationService): string | undefined {
  const first = service.annotations[0];
  const selector = first?.target.selector.find((s) => s.type === 'TextQuoteSelector');
  return selector?.type === 'TextQuoteSelector' ? selector.exact : undefined;
}

/** Returns the text node containing `needle` and the offset where it starts. */
function findText(root: HTMLElement, needle: string): { node: Text; offset: number } | undefined {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const offset = text.data.indexOf(needle);
    if (offset !== -1) return { node: text, offset };
  }
  return undefined;
}

function insertAd(root: HTMLElement): void {
  const ad = document.createElement('aside');
  ad.className = 'demo-ad';
  ad.textContent = 'Sponsored: a banner inserted inside the article.';
  const paragraphs = root.querySelectorAll('p');
  const before = paragraphs[1];
  before?.parentNode?.insertBefore(ad, before);
}

function wrapContent(root: HTMLElement): void {
  const wrapper = document.createElement('div');
  wrapper.className = 'demo-wrap';
  while (root.firstChild) wrapper.appendChild(root.firstChild);
  root.appendChild(wrapper);
}

function rewordQuote(root: HTMLElement, quote: string | undefined): void {
  if (!quote) return;
  const hit = findText(root, quote);
  if (hit) hit.node.insertData(hit.offset + 5, ' (updated) ');
}

function duplicateQuote(root: HTMLElement, quote: string | undefined): void {
  if (!quote) return;
  const copy = document.createElement('p');
  copy.className = 'demo-duplicate';
  copy.textContent = quote;
  root.appendChild(copy);
}

function nonBreakingSpaces(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let count = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    text.data = text.data.replace(/ /g, () => (count++ % 3 === 0 ? ' ' : ' '));
  }
}
