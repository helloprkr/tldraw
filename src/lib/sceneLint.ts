import type { Scene } from '../scene-types'
import type { Trace } from '../trace-types'
import { checkSpans } from '../trace-types'
import type { StoreDocument, TldrRecord } from '../readout-types'
import { BODY_LINE_H, lineCount } from './measure'
import { citeHeight } from './sceneLayout'

/**
 * Lint (M6_GENERATIVE.md §7): the feedback loop for a model that cannot see
 * the canvas. Deterministic, text out, node ids in every finding so /draw can
 * fix and recompile without rendering anything.
 *
 * Lint is a GATE on export, not a warning. The geometric checks
 * (`lintPageGeometry`) read only the document, so the in-app ⌘E path runs
 * them live against exactly what is about to become a plate; the scene- and
 * trace-aware checks join in the CLI, where the files are.
 */

export interface LintFinding {
  check:
    | 'overlap'
    | 'overflow'
    | 'bounds'
    | 'orphan'
    | 'crossings'
    | 'collision'
    | 'untyped'
    | 'unfounded'
    | 'orphan-gap'
  /** Page name or scene name the finding is about. */
  where: string
  /** Node ids (meta.node when present, else record ids). */
  at: string[]
  message: string
}

interface Box {
  record: TldrRecord
  id: string
  /** meta.node when the compiler minted it; the record id otherwise. */
  node: string
  x: number
  y: number
  w: number
  h: number
}

const CARD_TYPES = new Set(['atom', 'cite', 'ticket'])

/** Cards clamp text at whole lines; these mirror AtomShapeUtil / CiteShapeUtil. */
const ATOM_CHROME = 57 + 36
const ATOM_PAD_X = 32

function shapesOnPage(doc: StoreDocument, pageId: string): TldrRecord[] {
  const byId = new Map(Object.entries(doc.store))
  const out: TldrRecord[] = []
  for (const record of byId.values()) {
    if (record.typeName !== 'shape') continue
    let root = record.parentId
    while (root && root.startsWith('shape:')) root = byId.get(root)?.parentId
    if (root === pageId) out.push(record)
  }
  return out
}

/** Absolute page-space bounds; children of frames store frame-relative x/y. */
function absBox(doc: StoreDocument, record: TldrRecord): Box | null {
  const props = record.props as { w?: number; h?: number } | undefined
  if (typeof props?.w !== 'number' || typeof props?.h !== 'number') return null
  let x = record.x ?? 0
  let y = record.y ?? 0
  let parent = record.parentId
  while (parent && parent.startsWith('shape:')) {
    const p = doc.store[parent]
    if (!p) break
    x += p.x ?? 0
    y += p.y ?? 0
    parent = p.parentId
  }
  const node = typeof record.meta?.node === 'string' ? (record.meta.node as string) : record.id
  return { record, id: record.id, node, x, y, w: props.w, h: props.h }
}

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function isAncestorFrame(doc: StoreDocument, frame: TldrRecord, shape: TldrRecord): boolean {
  let parent = shape.parentId
  while (parent && parent.startsWith('shape:')) {
    if (parent === frame.id) return true
    parent = doc.store[parent]?.parentId
  }
  return false
}

/**
 * The document-only checks: overlap, overflow, bounds, untyped, orphan-gap,
 * collision. `where` is the page's name.
 */
export function lintPageGeometry(doc: StoreDocument, pageId: string): LintFinding[] {
  const findings: LintFinding[] = []
  const page = doc.store[pageId]
  const where = (page as unknown as { name?: string })?.name ?? pageId
  const shapes = shapesOnPage(doc, pageId)
  const boxes = shapes.map((s) => absBox(doc, s)).filter((b): b is Box => b !== null)

  const cards = boxes.filter((b) => CARD_TYPES.has(b.record.type ?? ''))
  const frames = boxes.filter((b) => b.record.type === 'frame')
  const gaps = boxes.filter((b) => b.record.type === 'gap')

  // overlap — cards against cards, and cards against frames they are not in.
  // A card overhanging its own frame is information (E36); a gap covering its
  // facing card is the mechanism (E19); those are exempt by construction.
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (intersects(cards[i], cards[j])) {
        findings.push({
          check: 'overlap',
          where,
          at: [cards[i].node, cards[j].node],
          message: `${cards[i].node} and ${cards[j].node} intersect at (${Math.round(Math.max(cards[i].x, cards[j].x))}, ${Math.round(Math.max(cards[i].y, cards[j].y))})`,
        })
      }
    }
    for (const frame of frames) {
      if (isAncestorFrame(doc, frame.record, cards[i].record)) continue
      if (intersects(cards[i], frame)) {
        findings.push({
          check: 'overlap',
          where,
          at: [cards[i].node, frame.node],
          message: `${cards[i].node} intersects frame "${(frame.record.props as { name?: string })?.name ?? frame.node}" it does not belong to`,
        })
      }
    }
  }

  // overflow — a generated card whose text no longer fits its box at the
  // house font metrics. Hand cards clamp by design and are not judged here.
  for (const card of cards) {
    if (card.record.meta?.origin !== 'generated') continue
    const text = (card.record.props as { text?: string })?.text ?? ''
    const need =
      card.record.type === 'cite'
        ? citeHeight(text, card.w)
        : ATOM_CHROME + lineCount(text, card.w - ATOM_PAD_X) * BODY_LINE_H
    if (need > card.h + 0.5) {
      findings.push({
        check: 'overflow',
        where,
        at: [card.node],
        message: `${card.node} needs ${need}px for its text at ${card.w}px wide but stands ${card.h}px`,
      })
    }
  }

  // bounds — a shape that fell off the scene: nothing else within 2400px on
  // either axis. Catches the flung card without dictating an extent.
  if (boxes.length > 1) {
    for (const box of boxes) {
      let nearest = Infinity
      for (const other of boxes) {
        if (other === box) continue
        const dx = Math.max(0, Math.max(box.x - (other.x + other.w), other.x - (box.x + box.w)))
        const dy = Math.max(0, Math.max(box.y - (other.y + other.h), other.y - (box.y + box.h)))
        nearest = Math.min(nearest, Math.max(dx, dy))
      }
      if (nearest > 2400) {
        findings.push({
          check: 'bounds',
          where,
          at: [box.node],
          message: `${box.node} sits ${Math.round(nearest)}px from anything else — outside the scene`,
        })
      }
    }
  }

  // untyped — a generated atom without a type is a compiler fault, and a
  // plate must not carry it.
  for (const card of cards) {
    if (card.record.type !== 'atom' || card.record.meta?.origin !== 'generated') continue
    const atom = (card.record.props as { atom?: string })?.atom
    if (atom === 'untyped' || atom === undefined) {
      findings.push({ check: 'untyped', where, at: [card.node], message: `${card.node} carries no atom type` })
    }
  }

  // orphan-gap — a hole facing a card that no longer exists anywhere.
  for (const gap of gaps) {
    const facing = (gap.record.props as { facingId?: string | null })?.facingId
    if (facing && !doc.store[facing]) {
      findings.push({ check: 'orphan-gap', where, at: [gap.node], message: `gap faces ${facing}, which does not exist` })
    }
  }

  // collision — edge labels against shapes. No M6 form renders labels
  // (E41.9), so any label found on an arrow is itself the finding.
  const arrows = shapes.filter((s) => s.type === 'arrow')
  for (const arrow of arrows) {
    const rich = (arrow.props as { richText?: { content?: { content?: unknown[] }[] } })?.richText
    const hasLabel = (rich?.content ?? []).some((p) => Array.isArray(p.content) && p.content.length > 0)
    if (!hasLabel) continue
    findings.push({
      check: 'collision',
      where,
      at: [typeof arrow.meta?.node === 'string' ? (arrow.meta.node as string) : arrow.id],
      message: `arrow carries a label; M6 renders none (E41.9) — remove it or extend the collision check first`,
    })
  }

  return findings
}

function segmentsCross(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number }
): boolean {
  const d = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const d1 = d(b1, b2, a1)
  const d2 = d(b1, b2, a2)
  const d3 = d(a1, a2, b1)
  const d4 = d(a1, a2, b2)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/**
 * The full pass: geometry per scene page, plus the checks that need the scene
 * and the trace — orphan, crossings, unfounded.
 */
export function lintScenes(
  doc: StoreDocument,
  scenes: { name: string; scene: Scene }[],
  trace: Trace,
  contextFiles: ReadonlyMap<string, string>
): LintFinding[] {
  const findings: LintFinding[] = []

  const pageOf = new Map<string, string>()
  for (const record of Object.values(doc.store)) {
    if (record.typeName === 'page' && typeof record.meta?.scene === 'string') {
      pageOf.set(record.meta.scene as string, record.id)
    }
  }

  for (const { name, scene } of scenes) {
    const pageId = pageOf.get(name)
    if (!pageId) continue
    findings.push(...lintPageGeometry(doc, pageId))

    // orphan — in a form whose meaning is its connections, an unconnected,
    // ungrouped node is dead weight (§7). Spine order and field position carry
    // meaning on their own; delta absence is the point.
    if (scene.form === 'genealogy' || scene.form === 'mechanism') {
      const touched = new Set<string>()
      for (const e of scene.edges) {
        touched.add(e.from)
        touched.add(e.to)
      }
      for (const g of scene.groups) for (const id of g.nodes) touched.add(id)
      for (const node of scene.nodes) {
        if (!touched.has(node.id)) {
          findings.push({
            check: 'orphan',
            where: name,
            at: [node.id],
            message: `${node.id} has no edge and no group in a ${scene.form}`,
          })
        }
      }
    }

    // crossings — straight chords between card centers, feedback arcs exempt
    // (they route below the line on purpose). Threshold scales with density.
    const centers = new Map<string, { x: number; y: number }>()
    for (const record of Object.values(doc.store)) {
      if (record.typeName !== 'shape' || record.meta?.scene !== name) continue
      const box = absBox(doc, record)
      if (box && typeof record.meta?.node === 'string' && !String(record.meta.node).startsWith('e:')) {
        centers.set(record.meta.node as string, { x: box.x + box.w / 2, y: box.y + box.h / 2 })
      }
    }
    const chords = scene.edges
      .filter((e) => !e.feedback)
      .map((e) => ({ e, a: centers.get(e.from), b: centers.get(e.to) }))
      .filter((c): c is { e: (typeof scene.edges)[number]; a: { x: number; y: number }; b: { x: number; y: number } } => !!c.a && !!c.b)
    let crossings = 0
    const pairs: string[] = []
    for (let i = 0; i < chords.length; i++) {
      for (let j = i + 1; j < chords.length; j++) {
        if (segmentsCross(chords[i].a, chords[i].b, chords[j].a, chords[j].b)) {
          crossings += 1
          pairs.push(`${chords[i].e.from}→${chords[i].e.to} × ${chords[j].e.from}→${chords[j].e.to}`)
        }
      }
    }
    const threshold = Math.max(1, Math.floor(scene.nodes.length / 4))
    if (crossings > threshold) {
      findings.push({
        check: 'crossings',
        where: name,
        at: pairs.slice(0, 6),
        message: `${crossings} edge crossings against a threshold of ${threshold} for ${scene.nodes.length} nodes`,
      })
    }

    // unfounded — §9's floor, re-checked at the last gate before a plate:
    // every unit this scene draws still spans back to real characters.
    const drawn = new Set(scene.nodes.map((n) => n.unit).filter((u): u is string => u !== null))
    const scoped: Trace = { ...trace, units: trace.units.filter((u) => drawn.has(u.id)) }
    for (const issueFound of checkSpans(scoped, contextFiles)) {
      findings.push({
        check: 'unfounded',
        where: name,
        at: [issueFound.at ?? '-'],
        message: issueFound.message,
      })
    }
  }

  return findings
}
