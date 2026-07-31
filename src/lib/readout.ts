/**
 * Stage 5 read-out (BUILD.md §7): the store snapshot becomes an outline.
 *
 * Pure: no fs, no fetch, no DOM, no editor, no clock (supplement §6.2, E8). The
 * `generated` stamp arrives in `opts` precisely so that ⌘R and
 * `npm run readout` can be diffed byte for byte — a clock read in here would
 * make the M2 gate unprovable. Both write edges serialize through
 * `serialize.ts`; nothing in this file turns a value into bytes except
 * `serializeMarkdown`.
 *
 * The thesis (§1) is the whole algorithm: y is reading order, so the map is
 * what the canvas already says, transcribed.
 */

import { serializeMarkdown } from './serialize'
import { DELTA_PAGE } from '../delta-types'
import { titleFromSlug } from '../readout-types'
import type {
  Assembly,
  AssemblyTicket,
  AssemblyUnit,
  ReadoutOptions,
  ReadoutResult,
  StoreDocument,
  TldrRecord,
} from '../readout-types'
import { isAtomType } from '../types'
import type { AtomType } from '../types'

/** tldraw labels a nameless frame "Frame"; the map says what the canvas says. */
const UNNAMED_FRAME = 'Frame'
const UNPLACED = 'Unplaced'
const PROGRAM_JOIN = ' → '

/** A shape resolved out of its parent's coordinate system onto the page. */
interface Placed {
  record: TldrRecord
  x: number
  y: number
}

interface Section {
  /** null is the unframed pile; it prints as `## Unplaced`. */
  name: string | null
  cards: Placed[]
}

/** The same sections once their cards are numbered, ready to print. */
interface Outline {
  name: string | null
  units: AssemblyUnit[]
}

function collectShapes(doc: StoreDocument): Map<string, TldrRecord> {
  const shapes = new Map<string, TldrRecord>()
  for (const record of Object.values(doc.store ?? {})) {
    if (record && record.typeName === 'shape') shapes.set(record.id, record)
  }
  return shapes
}

/**
 * The delta page is a second reading of the material, not part of the essay, so
 * its Received and Mine cards must not become sections of the outline (§9 asks
 * only that its *gaps* reach the map, as open tickets). Everything else on the
 * canvas is the essay.
 */
function deltaPageId(doc: StoreDocument): string | null {
  for (const record of Object.values(doc.store ?? {})) {
    if (record?.typeName === 'page' && stringProp(record, 'name') === DELTA_PAGE) return record.id
    // Page records carry `name` at the top level rather than under props.
    const named = (record as unknown as { typeName?: string; name?: string })
    if (named?.typeName === 'page' && named.name === DELTA_PAGE) return record.id
  }
  return null
}

/** Walks to the page the shape ultimately sits on. */
function pageOf(record: TldrRecord, shapes: Map<string, TldrRecord>): string | null {
  const seen = new Set<string>()
  let current: TldrRecord | undefined = record
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    const parentId = current.parentId ?? ''
    const parent = shapes.get(parentId)
    if (!parent) return parentId || null
    current = parent
  }
  return null
}

/**
 * A child shape's x/y are relative to its parent, not the page — verified
 * against a real snapshot, where a card dropped at page y 1400 inside a frame at
 * page y 1000 stores y 400. Sorting the raw values would rank every framed card
 * against the wrong origin, which is exactly the ordering the map is for.
 *
 * Rotation is not composed in: nothing in this app rotates a frame, and a
 * rotated section would make "y is reading order" meaningless anyway.
 */
function pagePoint(record: TldrRecord, shapes: Map<string, TldrRecord>): Placed {
  const seen = new Set<string>()
  let current: TldrRecord | undefined = record
  let x = 0
  let y = 0
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    x += current.x ?? 0
    y += current.y ?? 0
    current = shapes.get(current.parentId ?? '')
  }
  return { record, x, y }
}

/** Nearest frame ancestor, so a card inside a group inside a frame still lands. */
function enclosingFrame(record: TldrRecord, shapes: Map<string, TldrRecord>): TldrRecord | null {
  const seen = new Set<string>()
  let parent = shapes.get(record.parentId ?? '')
  while (parent && !seen.has(parent.id)) {
    if (parent.type === 'frame') return parent
    seen.add(parent.id)
    parent = shapes.get(parent.parentId ?? '')
  }
  return null
}

/** y then x, per §7 Stage 5. Id breaks the remaining tie so runs cannot diverge. */
function byPosition(a: Placed, b: Placed): number {
  if (a.y !== b.y) return a.y - b.y
  if (a.x !== b.x) return a.x - b.x
  return a.record.id < b.record.id ? -1 : a.record.id > b.record.id ? 1 : 0
}

function stringProp(record: TldrRecord, key: string): string {
  const value = record.props?.[key]
  return typeof value === 'string' ? value : ''
}

/** A markdown list item is one line; a raw newline out of a card would end it. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function frameName(record: TldrRecord): string {
  return oneLine(stringProp(record, 'name')) || UNNAMED_FRAME
}

function atomType(record: TldrRecord): AtomType {
  const value = record.props?.atom
  return isAtomType(value) ? value : 'untyped'
}

/**
 * The id is what lets a line in the map be traced back to the canvas and on to
 * `inputs/` (§7). Atoms carry it as `sourceId`; a shape without one falls back to
 * its record id, which is stable but not human-authored.
 */
function stableId(record: TldrRecord): string {
  return stringProp(record, 'sourceId') || record.id.replace(/^shape:/, '')
}

/** §9: a gap writes itself into the map as a to-do, so absence needs no transcribing. */
function ticketText(record: TldrRecord): string {
  if (record.type === 'gap') return oneLine(`UNANSWERED — ${stringProp(record, 'label')}`)
  return oneLine(stringProp(record, 'text'))
}

function sectionsOf(atoms: Placed[], frames: Placed[], shapes: Map<string, TldrRecord>): Section[] {
  const framed = new Map<string, Placed[]>()
  const unplaced: Placed[] = []

  for (const atom of atoms) {
    const frame = enclosingFrame(atom.record, shapes)
    if (!frame) {
      unplaced.push(atom)
      continue
    }
    const bucket = framed.get(frame.id)
    if (bucket) bucket.push(atom)
    else framed.set(frame.id, [atom])
  }

  // An empty frame still prints its heading: Jordan named a section, and a
  // section with nothing under it is a hole he should be able to see.
  const sections: Section[] = frames.map((frame) => ({
    name: frameName(frame.record),
    cards: (framed.get(frame.record.id) ?? []).sort(byPosition),
  }))

  if (unplaced.length > 0) sections.push({ name: null, cards: unplaced.sort(byPosition) })
  return sections
}

export function readout(doc: StoreDocument, opts: ReadoutOptions): ReadoutResult {
  const shapes = collectShapes(doc)
  const placed = [...shapes.values()].map((record) => pagePoint(record, shapes))

  // Tickets and gaps count wherever they are; cards and sections are the essay,
  // and the essay is not on the delta page.
  const delta = deltaPageId(doc)
  const isEssay = (p: Placed) => delta === null || pageOf(p.record, shapes) !== delta

  const frames = placed.filter((p) => p.record.type === 'frame').filter(isEssay).sort(byPosition)
  const atoms = placed.filter((p) => p.record.type === 'atom').filter(isEssay)
  const openItems = placed
    .filter((p) => p.record.type === 'ticket' || p.record.type === 'gap')
    .sort(byPosition)

  const sections = sectionsOf(atoms, frames, shapes)

  // Numbering runs continuously across sections (§7's example: Ground ends at 2,
  // The seam opens at 3) because the number is the card's place in the essay,
  // not its place in a section.
  const units: AssemblyUnit[] = []
  const outline: Outline[] = sections.map((section) => ({
    name: section.name,
    units: section.cards.map((card) => {
      const unit: AssemblyUnit = {
        id: stableId(card.record),
        atom: atomType(card.record),
        text: oneLine(stringProp(card.record, 'text')),
        section: section.name,
        position: units.length + 1,
      }
      units.push(unit)
      return unit
    }),
  }))

  const tickets: AssemblyTicket[] = openItems.map((item) => ({
    id: stableId(item.record),
    text: ticketText(item.record),
    kind: item.record.type === 'gap' ? 'gap' : 'ticket',
  }))

  const assembly: Assembly = {
    essay: opts.slug,
    title: titleFromSlug(opts.slug),
    generated: opts.generated,
    source: `work/${opts.slug}.tldr`,
    cards: units.length,
    untyped: units.filter((unit) => unit.atom === 'untyped').length,
    sections: frames.map((frame) => frameName(frame.record)),
    units,
    tickets,
    program: units.map((unit) => unit.atom),
  }

  return { mapMd: renderMap(assembly, outline), assembly }
}

/**
 * Blocks joined by one blank line. Building the document as blocks rather than
 * appending lines is what keeps spacing uniform when a section turns out empty.
 */
function renderMap(assembly: Assembly, outline: Outline[]): string {
  const blocks: string[] = [
    [
      '---',
      `essay: ${assembly.essay}`,
      `generated: ${assembly.generated}`,
      `source: ${assembly.source}`,
      `cards: ${assembly.cards}`,
      `untyped: ${assembly.untyped}`,
      '---',
    ].join('\n'),
    `# ${assembly.title}`,
  ]

  for (const section of outline) {
    const lines = section.units.map(
      (unit) => `${unit.position}. **[${unit.atom}]** ${unit.text} \`${unit.id}\``
    )
    blocks.push([`## ${section.name ?? UNPLACED}`, ...(lines.length > 0 ? ['', ...lines] : [])].join('\n'))
  }

  if (assembly.tickets.length > 0) {
    blocks.push(
      ['## Open tickets', '', ...assembly.tickets.map((t) => `- [ ] ${t.text} \`${t.id}\``)].join('\n')
    )
  }

  if (assembly.program.length > 0) {
    blocks.push(['## Assembly program', '', assembly.program.join(PROGRAM_JOIN)].join('\n'))
  }

  return serializeMarkdown(blocks.join('\n\n'))
}
