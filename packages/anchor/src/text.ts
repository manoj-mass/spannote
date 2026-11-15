/** Collapses every run of whitespace (including non-breaking spaces) into one space. */
export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ');
}

/** Normalizes a quote for comparison: collapsed whitespace, trimmed ends. */
export function normalizeQuote(value: string): string {
  return collapseSpaces(value).trim();
}

export function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}
