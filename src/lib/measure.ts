/**
 * Deterministic text measurement for the compiler and lint (M6).
 *
 * The layout pass runs in node, where there is no browser to wrap text, so line
 * breaks are predicted from a committed table of per-character advance widths —
 * EB Garamond 400 at 17px, measured once in headless Chrome against the same
 * self-hosted face the canvas renders (`garamond-17.json`).
 *
 * The prediction is deliberately conservative. Summing advances ignores kerning
 * and ligatures, both of which only ever shrink a line, so a predicted line is
 * never wider than the browser's — the greedy wrap breaks at or before where
 * the DOM breaks, the predicted line count is >= the real one, and a card sized
 * from it can only have slack, never a clipped line. Lint's `overflow` check
 * measures with the same table, so the two cannot disagree.
 */

import metrics from './garamond-17.json'

const WIDTHS: Record<string, number> = metrics.widths
const FONT_SIZE: number = metrics.size

/** Unmeasured glyphs assume the widest measured advance — conservative, §1. */
const FALLBACK = Math.max(...Object.values(WIDTHS))

export const BODY_SIZE = 17 /* --t-body-sm, AtomShapeUtil */
export const BODY_LEADING = 1.5 /* --lh-normal */
/**
 * `resolveLineHeightPx(17, 1.5)` = `Math.round(25.5)` = 26 — the same
 * whole-pixel snap the canvas and toSvg use (E4), transcribed rather than
 * imported so the pure core stays importable from node without tldraw's types.
 * If BODY_SIZE or BODY_LEADING ever change, re-derive this by hand.
 */
export const BODY_LINE_H = 26

/** Advance width of `text` at the card's body metrics, kerning ignored. */
export function advanceWidth(text: string): number {
  let w = 0
  for (const ch of text) w += WIDTHS[ch] ?? FALLBACK
  return (w * BODY_SIZE) / FONT_SIZE
}

/**
 * Greedy word wrap at `width` px. Returns the wrapped lines; a single word
 * wider than the measure gets its own line rather than a guess at intra-word
 * breaking — lint's `overflow` will name it.
 */
export function wrapText(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter((w) => w !== '')
  if (words.length === 0) return []
  const space = advanceWidth(' ')

  const lines: string[] = []
  let line = ''
  let lineW = 0
  for (const word of words) {
    const wordW = advanceWidth(word)
    if (line === '') {
      line = word
      lineW = wordW
    } else if (lineW + space + wordW <= width) {
      line += ` ${word}`
      lineW += space + wordW
    } else {
      lines.push(line)
      line = word
      lineW = wordW
    }
  }
  lines.push(line)
  return lines
}

export function lineCount(text: string, width: number): number {
  return Math.max(1, wrapText(text, width).length)
}
