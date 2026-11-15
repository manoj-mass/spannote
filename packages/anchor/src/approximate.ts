/** The best approximate occurrence of a pattern inside a text. */
export interface ApproximateMatch {
  /** Edit distance (insertions, deletions and substitutions). */
  readonly distance: number;
  /** Code-unit start, inclusive. */
  readonly start: number;
  /** Code-unit end, exclusive. */
  readonly end: number;
}

/**
 * Semi-global edit distance (Sellers, 1980): finds the substring of `text` that is closest to
 * `pattern`. Runs in O(|text| * |pattern|) time and O(|pattern|) memory.
 *
 * Ties are resolved in favour of the earliest end position.
 */
export function bestApproximateMatch(text: string, pattern: string): ApproximateMatch | undefined {
  const m = pattern.length;
  if (m === 0 || text.length === 0) return undefined;

  let previous = new Array<number>(m + 1);
  let previousStart = new Array<number>(m + 1);
  for (let i = 0; i <= m; i++) {
    previous[i] = i;
    previousStart[i] = 0;
  }

  let best: ApproximateMatch | undefined;
  for (let j = 1; j <= text.length; j++) {
    const current = new Array<number>(m + 1);
    const currentStart = new Array<number>(m + 1);
    current[0] = 0;
    currentStart[0] = j;
    for (let i = 1; i <= m; i++) {
      const cost = pattern.charCodeAt(i - 1) === text.charCodeAt(j - 1) ? 0 : 1;
      let value = (previous[i - 1] ?? 0) + cost;
      let start = previousStart[i - 1] ?? 0;
      const skipText = (previous[i] ?? 0) + 1;
      if (skipText < value) {
        value = skipText;
        start = previousStart[i] ?? 0;
      }
      const skipPattern = (current[i - 1] ?? 0) + 1;
      if (skipPattern < value) {
        value = skipPattern;
        start = currentStart[i - 1] ?? 0;
      }
      current[i] = value;
      currentStart[i] = start;
    }
    const distance = current[m] ?? Infinity;
    if (!best || distance < best.distance) {
      best = { distance, start: currentStart[m] ?? 0, end: j };
    }
    previous = current;
    previousStart = currentStart;
  }
  return best;
}
