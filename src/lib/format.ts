/** Small numeric-formatting helpers. */

/**
 * Condense large axis labels: 1800 → "1.8k", 2000 → "2k", 2400 → "2.4k".
 * Keeps values below 1000 as-is so small charts stay readable.
 */
export function kcalTick(value: number): string {
  if (value >= 1000) return `${Number((value / 1000).toFixed(1))}k`;
  return String(Math.round(value));
}
