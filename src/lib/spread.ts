/**
 * Stage 1 layout, as a pure function: fragments plus what is already on the
 * canvas, out come the placements to create. No editor, no fs — the in-app
 * spread and the node path must agree exactly (supplement §6.2).
 */

import { CARD_W, CARD_H, GUTTER, GRID_COLUMNS, STAGING_X } from '../types'
import type { Fragment } from '../types'

const PITCH_X = CARD_W + GUTTER
const PITCH_Y = CARD_H + GUTTER

export interface Placement {
  id: string
  x: number
  y: number
  fragment: Fragment
}

function byOrdinal(a: Fragment, b: Fragment): number {
  return a.ordinal - b.ordinal
}

/**
 * Nothing here reads, moves, or deletes an existing card: `existingIds` is used
 * only to decide what is new. Jordan's arrangement is sacred, so on a re-run the
 * one and only output is new fragments parked in the staging column, clear of the
 * grid. The fresh-canvas grid is therefore unreachable once anything exists.
 */
export function planSpread(fragments: Fragment[], existingIds: string[]): Placement[] {
  const ordered = [...fragments].sort(byOrdinal)

  if (existingIds.length === 0) {
    return ordered.map((fragment, i) => ({
      id: fragment.id,
      x: (i % GRID_COLUMNS) * PITCH_X,
      y: Math.floor(i / GRID_COLUMNS) * PITCH_Y,
      fragment,
    }))
  }

  const present = new Set(existingIds)
  return ordered
    .filter((fragment) => !present.has(fragment.id))
    .map((fragment, i) => ({
      id: fragment.id,
      x: STAGING_X,
      y: i * PITCH_Y,
      fragment,
    }))
}
