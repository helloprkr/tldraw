/**
 * The `generated:` stamp, in one place.
 *
 * BUILD.md §7's example reads `2026-07-30T14:02:11Z` — seconds, no
 * milliseconds. Two edges write this field, and when they disagreed on
 * precision the committed fixture no longer matched what a fresh run produced,
 * which is the same class of drift that `serialize.ts` exists to prevent.
 *
 * Sub-second precision would also be a lie: it names when a keystroke happened,
 * not anything about the essay.
 */

/** Pure. The formatter both edges share. */
export function formatStamp(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`
}

/** The clock read lives here, at the edge, never inside the pure core. */
export function nowStamp(): string {
  return formatStamp(new Date())
}
