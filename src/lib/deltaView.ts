import { EASINGS, createShapeId, getSnapshot } from 'tldraw'
import type { Editor, TLPageId, TLParentId, TLShape, TLShapeId } from 'tldraw'
import { cardSides, deltaState, gapPlacements } from './delta'
import { DELTA_PAGE, GAP_LABEL, MINE_FRAME, RECEIVED_FRAME } from '../delta-types'
import { CARD_H, CARD_W, GUTTER } from '../types'
import type { StoreDocument } from '../readout-types'

/**
 * Visible absence, as a route (BUILD.md §9).
 *
 * DeltaView is its own page rather than a mode over the compose canvas. Jordan's
 * arrangement on Compose is the essay; the delta is a second, differently
 * arranged reading of the same material, and the two must not fight over
 * position. Pages are invisible in this build (PageMenu is null), so the page is
 * reached only by the keyboard.
 *
 * Gaps are materialised as real shapes rather than drawn as an overlay: §6.2
 * makes GapShape a shape with a toSvg, a delta figure is exactly what §10's
 * plate exists for, and readout walks the store, so a gap has to be in the store
 * to become a ticket in map.md.
 */

const CAMERA = { animation: { duration: 420, easing: EASINGS.easeOutCubic } }

/** Two fixed frames, side by side, with the gap between them left to read across. */
const FRAME_W = CARD_W * 2 + GUTTER * 3
const FRAME_H = CARD_H * 4 + GUTTER * 5
const FRAME_GAP = GUTTER * 4

function findPage(editor: Editor, name: string): TLPageId | null {
  return editor.getPages().find((page) => page.name === name)?.id ?? null
}

function framesOnPage(editor: Editor): Map<string, TLShape> {
  const byName = new Map<string, TLShape>()
  for (const shape of editor.getCurrentPageShapes()) {
    if (shape.type !== 'frame') continue
    const name = (shape.props as { name?: string }).name
    if (name) byName.set(name, shape)
  }
  return byName
}

/** The two frames are fixed furniture: created once, never moved by the app again. */
function ensureFrames(editor: Editor): void {
  const frames = framesOnPage(editor)

  if (!frames.has(RECEIVED_FRAME)) {
    editor.createShape({
      type: 'frame',
      x: 0,
      y: 0,
      props: { w: FRAME_W, h: FRAME_H, name: RECEIVED_FRAME },
    })
  }
  if (!frames.has(MINE_FRAME)) {
    editor.createShape({
      type: 'frame',
      x: FRAME_W + FRAME_GAP,
      y: 0,
      props: { w: FRAME_W, h: FRAME_H, name: MINE_FRAME },
    })
  }
}

function snapshotOf(editor: Editor): StoreDocument {
  const { document } = getSnapshot(editor.store)
  return document as unknown as StoreDocument
}

function isGap(shape: TLShape): boolean {
  return shape.type === 'gap'
}

/**
 * Brings the gaps on the page into agreement with the correspondence graph.
 *
 * A gap stands *in place of* its Received card: the hole is created as the
 * card's sibling at the card's own coordinates, and the card is hidden rather
 * than moved or deleted (see shapeVisibility). Nothing Jordan placed is
 * disturbed by a computed state.
 *
 * Runs with history ignored: reconciliation is a consequence of a binding, and
 * undo should step over the binding, not over the bookkeeping it caused.
 */
export function reconcileGaps(editor: Editor): {
  created: number
  removed: number
  marked: number
} {
  const doc = snapshotOf(editor)
  const placements = gapPlacements(doc)
  const wanted = new Map(placements.map((p) => [p.facingId, p]))

  const existing = new Map<string, TLShape>()
  for (const shape of editor.getCurrentPageShapes()) {
    if (!isGap(shape)) continue
    const facingId = (shape.props as { facingId?: string | null }).facingId
    if (facingId) existing.set(facingId, shape)
  }

  const stale = [...existing.entries()].filter(([facingId]) => !wanted.has(facingId))
  const missing = placements.filter((p) => !existing.has(p.facingId))

  // §9's third state. Novelty is a fact about the correspondence graph, so it is
  // recomputed here alongside the holes rather than stored by hand — but it has
  // to land on the card's record, because the eyebrow that carries it is drawn
  // by both `component()` and `toSvg()` and E10 rules that anything appearing in
  // an exported figure must be reachable from the shape itself.
  const novel = new Set(deltaState(doc).novel)
  const sides = cardSides(doc)
  const remarks: { id: TLShapeId; novel: boolean }[] = []
  for (const shape of editor.getCurrentPageShapes()) {
    if (shape.type !== 'atom') continue
    if (sides.get(shape.id) !== MINE_FRAME) continue
    const should = novel.has(shape.id)
    if ((shape.meta.novel === true) !== should) remarks.push({ id: shape.id, novel: should })
  }

  if (stale.length === 0 && missing.length === 0 && remarks.length === 0) {
    return { created: 0, removed: 0, marked: 0 }
  }

  editor.run(
    () => {
      // An answered card simply has its hole removed; it never moved.
      for (const [, gap] of stale) editor.deleteShapes([gap.id])

      for (const remark of remarks) {
        editor.updateShape({
          id: remark.id,
          type: 'atom',
          meta: { novel: remark.novel },
        })
      }

      for (const placement of missing) {
        editor.createShape({
          id: createShapeId(),
          type: 'gap',
          x: placement.x,
          y: placement.y,
          parentId: placement.parentId as TLParentId,
          props: {
            w: placement.w,
            h: placement.h,
            label: placement.label,
            facingId: placement.facingId,
            sourceId: placement.sourceId,
          },
        })
      }
    },
    { history: 'ignore' }
  )

  return { created: missing.length, removed: stale.length, marked: remarks.length }
}

/** `⌘D`. Creates the page and its furniture on first use, then just returns to it. */
export function openDeltaView(editor: Editor): void {
  const existing = findPage(editor, DELTA_PAGE)

  if (existing) {
    editor.setCurrentPage(existing)
  } else {
    editor.createPage({ name: DELTA_PAGE })
    const created = findPage(editor, DELTA_PAGE)
    if (!created) return
    editor.setCurrentPage(created)
  }

  ensureFrames(editor)
  reconcileGaps(editor)
  editor.zoomToFit(CAMERA)
}

export function isDeltaPage(editor: Editor): boolean {
  return editor.getPages().find((p) => p.id === editor.getCurrentPageId())?.name === DELTA_PAGE
}

/** The label a gap shows is the facing card's text, quoted rather than owned. */
export function gapLabelFor(text: string): string {
  return text.trim() === '' ? GAP_LABEL : text
}

/**
 * A card standing behind a hole is hidden, never moved. §16 is explicit that the
 * canvas must never move a card Jordan placed, and a computed state has no
 * business rewriting his arrangement — so the gap covers the card and the card
 * stays exactly where he put it. Binding an answer deletes the hole and the card
 * reappears in place.
 *
 * Derived from the gaps already on the page, so nothing is stored on the card.
 */
export function shapeVisibility(shape: TLShape, editor: Editor): 'hidden' | 'inherit' {
  if (shape.type !== 'atom') return 'inherit'

  for (const other of editor.getCurrentPageShapes()) {
    if (!isGap(other)) continue
    if ((other.props as { facingId?: string | null }).facingId === shape.id) return 'hidden'
  }
  return 'inherit'
}
