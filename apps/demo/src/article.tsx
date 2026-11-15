import { memo } from 'react';

interface ArticleProps {
  readonly onRoot: (node: HTMLElement | null) => void;
}

/**
 * Static content. It never re-renders, so the page changes made by the demo's buttons do not
 * fight React over the same DOM nodes.
 */
export const Article = memo(function Article({ onRoot }: ArticleProps) {
  return (
    <article ref={onRoot} className="article" data-testid="article">
      <h1>Pricing review</h1>
      <p>Across the base, 12% of users churn each quarter after the first renewal.</p>
      <p>Students can use annotations to refer back to key passages in a long document.</p>
      <p>
        Priced items may repeat across the catalogue, so a quote needs its context to be found
        again.
      </p>
      <p>
        {
          'Spacing   matters here:   these   words   have   extra   spaces, and this one&nbsp;is joined.'
        }
      </p>
    </article>
  );
});
