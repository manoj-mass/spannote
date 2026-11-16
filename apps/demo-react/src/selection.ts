/** The page selection, if it is not collapsed and lies inside the article. */
export function selectedRange(article: HTMLElement | null): Range | undefined {
  const selection = window.getSelection();
  if (!article || !selection || selection.rangeCount === 0 || selection.isCollapsed)
    return undefined;
  const range = selection.getRangeAt(0);
  return article.contains(range.commonAncestorContainer) ? range : undefined;
}
