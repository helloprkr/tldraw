/**
 * Visible absence (BUILD.md §9), as pure functions over a .tldr snapshot. No
 * editor, no fs, no clock — DeltaView and the node readout both call these and
 * must agree exactly (supplement §6.2).
 *
 * The three states are computed, never stored. A Received card is unanswered
 * because nothing points at it, so the hole opens and closes as Jordan draws
 * correspondences; nothing has to be marked, and nothing can go stale.
 *
 * Direction (see `deltaState`): a correspondence runs from the card that answers
 * to the card it answers — Mine to Received — because DeltaView's B binds the
 * selection as the arrow's start and the next click as its end, and it is the
 * Mine card that does the answering.
 */

import { MINE_FRAME, RECEIVED_FRAME } from '../delta-types'
import type { DeltaState } from '../delta-types'
import { isRelation } from '../relations'
import type { StoreDocument, TldrRecord } from '../readout-types'
import { pageOrigins } from './topo'

/** Only atoms are cards. A gap sitting in the Received frame is not one. */
const ATOM = 'atom'
const FRAME = 'frame'

/** Which side of the delta a card sits on. The frame names are the contract. */
export type DeltaSide = typeof RECEIVED_FRAME | typeof MINE_FRAME

export interface CorrespondenceEdge {
  /** The card that answers — the arrow's start terminal. */
  answer: string
  /** The card it answers — the arrow's end terminal. */
  answered: string
}

/** Everything the view needs to open a hole exactly where its card stands. */
export interface GapPlacement {
  /** The Received card this stands in for. */
  facingId: string
  /** That card's text, shown greyed inside the hole — quoted, not owned. */
  label: string
  /** Stable id, so map.md can name the gap rather than print a tldraw nanoid (E11). */
  sourceId: string
  /** The card's parent, so the hole is created as its sibling in the same frame. */
  parentId: string
  /** Parent-relative, like the card's own x/y — the frame createShape expects. */
  x: number
  y: number
  w: number
  h: number
  /** Page-space, for a caller placing an overlay rather than a shape. */
  pageX: number
  pageY: number
}

function isCard(record: TldrRecord | undefined): boolean {
  return record?.typeName === 'shape' && record.type === ATOM
}

function terminalOf(record: TldrRecord): 'start' | 'end' | null {
  const terminal = record.props?.terminal
  return terminal === 'start' || terminal === 'end' ? terminal : null
}

function stringProp(record: TldrRecord, key: string): string {
  const value = record.props?.[key]
  return typeof value === 'string' ? value : ''
}

function numberProp(record: TldrRecord, key: string): number {
  const value = record.props?.[key]
  return typeof value === 'number' ? value : 0
}

/** A gap shows one greyed line; a raw newline out of a card would break it. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function byEdge(a: CorrespondenceEdge, b: CorrespondenceEdge): number {
  if (a.answered !== b.answered) return a.answered < b.answered ? -1 : 1
  return a.answer < b.answer ? -1 : a.answer > b.answer ? 1 : 0
}

/**
 * One correspondence per arrow, reconstructed by pairing the arrow's two binding
 * records (supplement §3.2). Same shape of problem as `dependencyEdges`, and the
 * mirror image of its filter: an arrow is a correspondence only when it was
 * stamped one at creation. A legacy arrow carries no stamp and reads as a
 * dependency (src/relations.ts), so it can never close a gap by accident.
 *
 * Two arrows between the same pair say the same thing once, so the result is a
 * set of correspondences rather than a list of arrows.
 */
export function correspondenceEdges(doc: StoreDocument): CorrespondenceEdge[] {
  const store = doc.store
  const terminals = new Map<string, { start?: string; end?: string }>()

  for (const record of Object.values(store)) {
    if (record.typeName !== 'binding' || record.type !== 'arrow') continue
    const terminal = terminalOf(record)
    if (!terminal || !record.fromId || !record.toId) continue
    if (!isCard(store[record.toId])) continue
    const pair = terminals.get(record.fromId) ?? {}
    pair[terminal] = record.toId
    terminals.set(record.fromId, pair)
  }

  const seen = new Set<string>()
  const edges: CorrespondenceEdge[] = []
  for (const [arrowId, pair] of terminals) {
    // An arrow bound at one end only is still being drawn and answers nothing.
    if (!pair.start || !pair.end) continue
    if (!isRelation(store[arrowId]?.meta, 'correspondence')) continue
    const key = `${pair.start} ${pair.end}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push({ answer: pair.start, answered: pair.end })
  }
  return edges.sort(byEdge)
}

function frameName(record: TldrRecord): string {
  return oneLine(stringProp(record, 'name'))
}

function sideOfName(name: string): DeltaSide | null {
  if (name === RECEIVED_FRAME) return RECEIVED_FRAME
  if (name === MINE_FRAME) return MINE_FRAME
  return null
}

/**
 * Membership is whichever named frame a card's parent chain reaches, so a card
 * grouped or nested one frame deeper inside Received is still Received. The
 * nearest named ancestor wins. A card in neither frame — on Compose, or dropped
 * beside them — belongs to no side and appears in no state.
 */
export function cardSides(doc: StoreDocument): Map<string, DeltaSide> {
  const store = doc.store
  const sides = new Map<string, DeltaSide>()

  for (const record of Object.values(store)) {
    if (!isCard(record)) continue
    const guard = new Set<string>([record.id])
    let node: TldrRecord | undefined = store[record.parentId ?? '']
    while (node && node.typeName === 'shape' && !guard.has(node.id)) {
      guard.add(node.id)
      if (node.type === FRAME) {
        const side = sideOfName(frameName(node))
        if (side) {
          sides.set(record.id, side)
          break
        }
      }
      node = store[node.parentId ?? '']
    }
  }
  return sides
}

/**
 * §9's three computed states.
 *
 * The table in §9 reads "Received card has an outbound binding", which taken
 * literally would have the arrow leaving the Received card. That contradicts the
 * same section's own gloss of the relation — "this answers that" — and the
 * binding order DeltaView's B produces, where the selected Mine card is the
 * start terminal. The gloss wins: a Received card is answered when it is the
 * *target* of a correspondence from a Mine card.
 *
 * Only correspondences across the gap count. A Mine card answering another Mine
 * card asserts nothing about the received position, and so does not spend its
 * novelty.
 */
export function deltaState(doc: StoreDocument): DeltaState {
  const sides = cardSides(doc)
  const answeredIds = new Set<string>()
  const answeringIds = new Set<string>()

  for (const edge of correspondenceEdges(doc)) {
    if (sides.get(edge.answer) !== MINE_FRAME) continue
    if (sides.get(edge.answered) !== RECEIVED_FRAME) continue
    answeredIds.add(edge.answered)
    answeringIds.add(edge.answer)
  }

  const answered: string[] = []
  const unanswered: string[] = []
  const novel: string[] = []

  for (const [id, side] of sides) {
    if (side === RECEIVED_FRAME) {
      if (answeredIds.has(id)) answered.push(id)
      else unanswered.push(id)
    } else if (!answeringIds.has(id)) {
      novel.push(id)
    }
  }

  return { answered: answered.sort(), unanswered: unanswered.sort(), novel: novel.sort() }
}

/**
 * The id is what lets a gap in map.md be traced back to the card it stands for.
 * A fragment id `f-002` becomes `g-002` — §7's example prints exactly that pair
 * of forms — and a card without an authored id falls back to its record id,
 * which is stable but not human-authored.
 */
function gapSourceId(record: TldrRecord): string {
  const stable = stringProp(record, 'sourceId') || record.id.replace(/^shape:/, '')
  return `g-${stable.replace(/^f-/, '')}`
}

function byReadingOrder(a: GapPlacement, b: GapPlacement): number {
  if (a.pageY !== b.pageY) return a.pageY - b.pageY
  if (a.pageX !== b.pageX) return a.pageX - b.pageX
  return a.facingId < b.facingId ? -1 : a.facingId > b.facingId ? 1 : 0
}

/**
 * One hole per unanswered Received card, in the card's own place. The card is
 * not consulted for anything but its position, size, and words: the gap quotes
 * it, and nothing about the arrangement Jordan made is rewritten (§16).
 */
export function gapPlacements(doc: StoreDocument): GapPlacement[] {
  const store = doc.store
  const origins = pageOrigins(doc)
  const placements: GapPlacement[] = []

  for (const facingId of deltaState(doc).unanswered) {
    const card = store[facingId]
    if (!card) continue
    const origin = origins.get(facingId) ?? { x: card.x ?? 0, y: card.y ?? 0 }
    placements.push({
      facingId,
      label: oneLine(stringProp(card, 'text')),
      sourceId: gapSourceId(card),
      parentId: card.parentId ?? '',
      x: card.x ?? 0,
      y: card.y ?? 0,
      w: numberProp(card, 'w'),
      h: numberProp(card, 'h'),
      pageX: origin.x,
      pageY: origin.y,
    })
  }

  return placements.sort(byReadingOrder)
}
