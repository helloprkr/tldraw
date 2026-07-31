/**
 * Assertions over delta.ts. Not a test framework — a script that builds .tldr
 * snapshots by hand and exercises visible absence (BUILD.md §9) in node, proving
 * that the three computed states follow the correspondence graph alone, and that
 * a dependency arrow drawn between the same two cards cannot close a gap.
 *
 * Run: npx tsx scripts/check-delta.ts
 */

import { deltaCount, MINE_FRAME, RECEIVED_FRAME } from '../src/delta-types.ts'
import { cardSides, correspondenceEdges, deltaState, gapPlacements } from '../src/lib/delta.ts'
import { dependencyEdges } from '../src/lib/topo.ts'
import type { Relation } from '../src/relations.ts'
import type { StoreDocument, TldrRecord } from '../src/readout-types.ts'

let failures = 0

function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    console.log(`PASS  ${label}`)
  } else {
    failures += 1
    console.log(`FAIL  ${label}`)
    console.log(`      expected ${b}`)
    console.log(`      actual   ${a}`)
  }
}

function section(title: string): void {
  console.log(`\n${title}`)
}

const PAGE = 'page:page'

function docOf(records: TldrRecord[]): StoreDocument {
  const store: Record<string, TldrRecord> = { [PAGE]: { id: PAGE, typeName: 'page' } }
  for (const record of records) store[record.id] = record
  return { store, schema: {} }
}

function shape(
  id: string,
  type: string,
  y: number,
  x: number,
  parentId: string,
  props: Record<string, unknown> = {}
): TldrRecord {
  return { id, typeName: 'shape', type, parentId, x, y, props }
}

/** A card: an atom, with the props a gap has to quote. */
function card(id: string, y: number, parentId: string, text = '', sourceId = ''): TldrRecord {
  return shape(id, 'atom', y, 0, parentId, { w: 320, h: 180, text, sourceId })
}

function frame(id: string, name: string, y: number, x = 0, parentId: string = PAGE): TldrRecord {
  return shape(id, 'frame', y, x, parentId, { w: 800, h: 900, name })
}

function binding(id: string, arrowId: string, toId: string, terminal: 'start' | 'end'): TldrRecord {
  return {
    id,
    typeName: 'binding',
    type: 'arrow',
    fromId: arrowId,
    toId,
    props: { terminal, normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false },
  }
}

/**
 * One arrow plus its two bindings. `relation` undefined leaves the arrow
 * unstamped — a legacy arrow, which src/relations.ts reads as a dependency.
 */
function arrow(arrowId: string, start: string, end: string, relation?: Relation): TldrRecord[] {
  const record = shape(arrowId, 'arrow', 0, 0, PAGE)
  if (relation) record.meta = { relation }
  return [
    record,
    binding(`binding:${arrowId}-s`, arrowId, start, 'start'),
    binding(`binding:${arrowId}-e`, arrowId, end, 'end'),
  ]
}

/** DeltaView's B: the selected Mine card is the start, the Received card the end. */
function answers(arrowId: string, mine: string, received: string): TldrRecord[] {
  return arrow(arrowId, mine, received, 'correspondence')
}

const RECEIVED = 'shape:f-received'
const MINE = 'shape:f-mine'

function frames(): TldrRecord[] {
  return [frame(RECEIVED, RECEIVED_FRAME, 0), frame(MINE, MINE_FRAME, 0, 1200)]
}

section('correspondenceEdges — one arrow, two binding records')
const one = docOf([
  ...frames(),
  card('shape:r1', 0, RECEIVED),
  card('shape:m1', 0, MINE),
  ...answers('shape:ar1', 'shape:m1', 'shape:r1'),
])
check('start terminal answers, end terminal is answered', correspondenceEdges(one), [
  { answer: 'shape:m1', answered: 'shape:r1' },
])

const doubled = docOf([
  ...frames(),
  card('shape:r1', 0, RECEIVED),
  card('shape:m1', 0, MINE),
  ...answers('shape:ar1', 'shape:m1', 'shape:r1'),
  ...answers('shape:ar2', 'shape:m1', 'shape:r1'),
])
check('two arrows between the same pair assert one correspondence', correspondenceEdges(doubled), [
  { answer: 'shape:m1', answered: 'shape:r1' },
])

const halfBound = docOf([
  ...frames(),
  card('shape:r1', 0, RECEIVED),
  card('shape:m1', 0, MINE),
  shape('shape:ar1', 'arrow', 0, 0, PAGE, {}),
  binding('binding:ar1-s', 'shape:ar1', 'shape:m1', 'start'),
])
halfBound.store['shape:ar1'].meta = { relation: 'correspondence' }
check('a correspondence bound at one end only is ignored', correspondenceEdges(halfBound), [])
check('and it answers nothing', deltaState(halfBound).unanswered, ['shape:r1'])

const toNonCard = docOf([
  ...frames(),
  card('shape:m1', 0, MINE),
  shape('shape:t1', 'ticket', 0, 0, RECEIVED, {}),
  ...answers('shape:ar1', 'shape:m1', 'shape:t1'),
])
check('a correspondence bound to a non-card is ignored', correspondenceEdges(toNonCard), [])

section('the relation filter — Jordan 2026-07-31, the two graphs never mix')
const stampedDependency = docOf([
  ...frames(),
  card('shape:r1', 0, RECEIVED),
  card('shape:m1', 0, MINE),
  ...arrow('shape:ar1', 'shape:m1', 'shape:r1', 'dependency'),
])
check('a dependency-stamped arrow is no correspondence', correspondenceEdges(stampedDependency), [])
check(
  'a dependency-stamped arrow does NOT answer the Received card',
  deltaState(stampedDependency).unanswered,
  ['shape:r1']
)
check('nor does it spend the novelty of the Mine card', deltaState(stampedDependency).novel, ['shape:m1'])
check('it is still a dependency to topo.ts', dependencyEdges(stampedDependency), [
  { dependent: 'shape:m1', dependency: 'shape:r1' },
])

const legacy = docOf([
  ...frames(),
  card('shape:r1', 0, RECEIVED),
  card('shape:m1', 0, MINE),
  ...arrow('shape:ar1', 'shape:m1', 'shape:r1'),
])
check('an unstamped legacy arrow carries no correspondence', correspondenceEdges(legacy), [])
check('an unstamped legacy arrow does NOT answer the Received card', deltaState(legacy).unanswered, [
  'shape:r1',
])
check('legacy reads as dependency, so topo.ts still sees it', dependencyEdges(legacy), [
  { dependent: 'shape:m1', dependency: 'shape:r1' },
])

check('and the reverse leak: a correspondence is no dependency', dependencyEdges(one), [])

section('deltaState — the acceptance test from §9')
// Ten Received cards, four Mine cards, four correspondences.
const received = Array.from({ length: 10 }, (_, i) =>
  card(`shape:r${String(i + 1).padStart(2, '0')}`, i * 200, RECEIVED, `received claim ${i + 1}`)
)
const mine = Array.from({ length: 4 }, (_, i) =>
  card(`shape:m${String(i + 1).padStart(2, '0')}`, i * 200, MINE, `my answer ${i + 1}`)
)
const correspondences = mine.flatMap((m, i) =>
  answers(`shape:ac${i + 1}`, m.id, received[i].id)
)
const acceptance = docOf([...frames(), ...received, ...mine, ...correspondences])
const acceptanceState = deltaState(acceptance)
check('ten Received cards, four correspondences: six unanswered', acceptanceState.unanswered.length, 6)
check('the six are the ones nothing points at', acceptanceState.unanswered, [
  'shape:r05',
  'shape:r06',
  'shape:r07',
  'shape:r08',
  'shape:r09',
  'shape:r10',
])
check('the other four are answered', acceptanceState.answered, [
  'shape:r01',
  'shape:r02',
  'shape:r03',
  'shape:r04',
])
check('every Mine card answered something, so none is novel', acceptanceState.novel, [])
check('the counter reads 6', deltaCount(acceptanceState), 6)
check('one gap per unanswered card', gapPlacements(acceptance).length, 6)

section('novel — the asymmetry in the table')
const withNovel = docOf([
  ...frames(),
  card('shape:r1', 0, RECEIVED),
  card('shape:m1', 0, MINE),
  card('shape:m2', 200, MINE),
  ...answers('shape:ar1', 'shape:m1', 'shape:r1'),
])
check('a Mine card with no correspondence is novel', deltaState(withNovel).novel, ['shape:m2'])
check('a Mine card with one is not', deltaState(withNovel).novel.includes('shape:m1'), false)
check('a novel card is an ordinary card, never a gap', gapPlacements(withNovel), [])
check('answering closes the gap', deltaState(withNovel).unanswered, [])

const mineToMine = docOf([
  ...frames(),
  card('shape:r1', 0, RECEIVED),
  card('shape:m1', 0, MINE),
  card('shape:m2', 200, MINE),
  ...answers('shape:ar1', 'shape:m1', 'shape:m2'),
])
check('a correspondence within Mine spends no novelty', deltaState(mineToMine).novel, [
  'shape:m1',
  'shape:m2',
])
check('and answers nothing received', deltaState(mineToMine).unanswered, ['shape:r1'])

section('direction — the arrow runs from the answer to the answered')
const backwards = docOf([
  ...frames(),
  card('shape:r1', 0, RECEIVED),
  card('shape:m1', 0, MINE),
  ...answers('shape:ar1', 'shape:r1', 'shape:m1'),
])
check('an edge is still read off the arrow', correspondenceEdges(backwards), [
  { answer: 'shape:r1', answered: 'shape:m1' },
])
check('drawn Received to Mine, the Received card stays unanswered', deltaState(backwards).unanswered, [
  'shape:r1',
])
check('and the Mine card stays novel', deltaState(backwards).novel, ['shape:m1'])

section('membership — which frame the parent chain reaches')
const outside = docOf([
  ...frames(),
  card('shape:r1', 0, RECEIVED),
  card('shape:m1', 0, MINE),
  card('shape:x1', 400, PAGE, 'a card on no side'),
  frame('shape:f-other', 'Ground', 2000),
  card('shape:x2', 0, 'shape:f-other', 'a card in another frame'),
])
const outsideState = deltaState(outside)
check('a card in neither frame is in no set', [
  outsideState.answered.includes('shape:x1'),
  outsideState.unanswered.includes('shape:x1'),
  outsideState.novel.includes('shape:x1'),
], [false, false, false])
check('nor is a card in a differently named frame', [
  outsideState.answered.includes('shape:x2'),
  outsideState.unanswered.includes('shape:x2'),
  outsideState.novel.includes('shape:x2'),
], [false, false, false])
check('only the two frames have sides', [...cardSides(outside).entries()].sort(), [
  ['shape:m1', MINE_FRAME],
  ['shape:r1', RECEIVED_FRAME],
])

const nested = docOf([
  ...frames(),
  frame('shape:f-inner', 'Satiety', 300, 40, RECEIVED),
  card('shape:r1', 60, 'shape:f-inner'),
  card('shape:m1', 0, MINE),
])
check('a card in a nested frame inside Received is still Received', cardSides(nested).get('shape:r1'), RECEIVED_FRAME)
check('and it becomes a gap like any other', deltaState(nested).unanswered, ['shape:r1'])

section('gapPlacements — the hole stands where its card stands')
const placed = docOf([
  frame(RECEIVED, RECEIVED_FRAME, 1000),
  frame(MINE, MINE_FRAME, 1000, 1200),
  card('shape:r1', 500, RECEIVED, '  the received view of\n  satiety  ', 'f-002'),
  card('shape:m1', 0, MINE),
])
check('one placement per unanswered card', gapPlacements(placed).length, 1)
check('it faces its card and quotes it on one line', gapPlacements(placed)[0].label, 'the received view of satiety')
check('facing id is the card', gapPlacements(placed)[0].facingId, 'shape:r1')
check('the gap is a sibling of the card, at the same x/y', [
  gapPlacements(placed)[0].parentId,
  gapPlacements(placed)[0].x,
  gapPlacements(placed)[0].y,
], [RECEIVED, 0, 500])
check('page coordinates resolve through the frame', [
  gapPlacements(placed)[0].pageX,
  gapPlacements(placed)[0].pageY,
], [0, 1500])
check('it takes the measure of the card', [gapPlacements(placed)[0].w, gapPlacements(placed)[0].h], [320, 180])
check('f-002 becomes g-002 (E11)', gapPlacements(placed)[0].sourceId, 'g-002')

const unnamedSource = docOf([
  ...frames(),
  card('shape:r1', 0, RECEIVED),
])
check('a card with no authored id falls back to its record id', gapPlacements(unnamedSource)[0].sourceId, 'g-r1')

section('determinism')
check('same input twice gives an identical state', deltaState(acceptance), deltaState(acceptance))
check('same input twice gives identical edges', correspondenceEdges(acceptance), correspondenceEdges(acceptance))
check('same input twice gives identical placements', gapPlacements(acceptance), gapPlacements(acceptance))

const reversed = docOf([...frames(), ...received, ...mine, ...correspondences].reverse())
check('store insertion order does not reach the state', deltaState(reversed), deltaState(acceptance))
check('store insertion order does not reach the edges', correspondenceEdges(reversed), correspondenceEdges(acceptance))
check('store insertion order does not reach the placements', gapPlacements(reversed), gapPlacements(acceptance))

section('empty canvas')
const empty = docOf([])
check('no cards, no edges', correspondenceEdges(empty), [])
check('no cards, no states', deltaState(empty), { answered: [], unanswered: [], novel: [] })
check('no cards, no gaps', gapPlacements(empty), [])
check('no cards, delta zero', deltaCount(deltaState(empty)), 0)

const framesOnly = docOf(frames())
check('two empty frames are still an empty delta', deltaState(framesOnly), {
  answered: [],
  unanswered: [],
  novel: [],
})

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
