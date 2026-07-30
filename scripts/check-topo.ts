/**
 * Assertions over topo.ts. Not a test framework — a script that builds .tldr
 * snapshots by hand and exercises the dependency graph in node, proving the
 * unsupported-claim check (BUILD.md §7 Stage 4) reads page coordinates rather
 * than a card's frame-relative y, and that the sort cannot disagree with itself.
 *
 * Run: npx tsx scripts/check-topo.ts
 */

import {
  cycleShapeIds,
  dependencyEdges,
  pageTops,
  topoSort,
  unsupportedFrom,
  unsupportedShapeIds,
} from '../src/lib/topo.ts'
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

function shape(id: string, type: string, y: number, x: number, parentId: string): TldrRecord {
  return { id, typeName: 'shape', type, parentId, x, y, props: {} }
}

function atom(id: string, y: number, x = 0, parentId: string = PAGE): TldrRecord {
  return shape(id, 'atom', y, x, parentId)
}

function frame(id: string, y: number, x = 0, parentId: string = PAGE): TldrRecord {
  return shape(id, 'frame', y, x, parentId)
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

/** One arrow plus its two bindings: B on a selection, then a click on the target. */
function depends(arrowId: string, dependent: string, dependency: string): TldrRecord[] {
  return [
    shape(arrowId, 'arrow', 0, 0, PAGE),
    binding(`binding:${arrowId}-s`, arrowId, dependent, 'start'),
    binding(`binding:${arrowId}-e`, arrowId, dependency, 'end'),
  ]
}

section('dependencyEdges — one arrow, two binding records')
const simple = docOf([atom('shape:a', 0), atom('shape:b', 400), ...depends('shape:ar1', 'shape:a', 'shape:b')])
check('start terminal is the dependent, end terminal is the dependency', dependencyEdges(simple), [
  { dependent: 'shape:a', dependency: 'shape:b' },
])
check('the arrow shape itself is not a node', topoSort(simple).length, 2)

section('dependencyEdges — arrows that assert nothing')
const halfBound = docOf([
  atom('shape:a', 0),
  atom('shape:b', 400),
  shape('shape:ar1', 'arrow', 0, 0, PAGE),
  binding('binding:ar1-s', 'shape:ar1', 'shape:a', 'start'),
])
check('an arrow bound at one end only is ignored', dependencyEdges(halfBound), [])

const toNonAtom = docOf([
  atom('shape:a', 0),
  shape('shape:t1', 'ticket', 400, 0, PAGE),
  ...depends('shape:ar1', 'shape:a', 'shape:t1'),
])
check('an arrow bound to a non-atom is ignored', dependencyEdges(toNonAtom), [])

const toFrame = docOf([
  atom('shape:a', 0),
  frame('shape:f1', 400),
  ...depends('shape:ar1', 'shape:a', 'shape:f1'),
])
check('an arrow bound to a frame is ignored', dependencyEdges(toFrame), [])

const doubled = docOf([
  atom('shape:a', 0),
  atom('shape:b', 400),
  ...depends('shape:ar1', 'shape:a', 'shape:b'),
  ...depends('shape:ar2', 'shape:a', 'shape:b'),
])
check('two arrows between the same pair assert one dependency', dependencyEdges(doubled), [
  { dependent: 'shape:a', dependency: 'shape:b' },
])

section('unsupportedShapeIds — the acceptance test, one graph, one card moved')
const supported = docOf([atom('shape:a', 500), atom('shape:b', 100), ...depends('shape:ar1', 'shape:a', 'shape:b')])
check('A below the card it depends on: nothing reported', unsupportedShapeIds(supported), [])

const dragged = docOf([atom('shape:a', 0), atom('shape:b', 100), ...depends('shape:ar1', 'shape:a', 'shape:b')])
check('same graph, A dragged above B: A is unsupported', unsupportedShapeIds(dragged), ['shape:a'])
check('the dependency is never the offender', unsupportedShapeIds(dragged).includes('shape:b'), false)

const level = docOf([atom('shape:a', 100), atom('shape:b', 100), ...depends('shape:ar1', 'shape:a', 'shape:b')])
check('level with its dependency is not above it', unsupportedShapeIds(level), [])

// The per-frame path: edges computed once, fresh tops each frame.
const liveEdges = dependencyEdges(supported)
check(
  'unsupportedFrom clears and fires on tops alone',
  [
    unsupportedFrom(liveEdges, new Map([['shape:a', 500], ['shape:b', 100]])),
    unsupportedFrom(liveEdges, new Map([['shape:a', 0], ['shape:b', 100]])),
    unsupportedFrom(liveEdges, new Map([['shape:a', 500], ['shape:b', 100]])),
  ],
  [[], ['shape:a'], []]
)

section('page coordinates — cards in different frames')
// A sits low inside a high frame; B sits high inside a low frame. Comparing the
// raw y values (500 against 100) says A is below B and clears it. In page terms
// A is at 500 and B at 1100, so A is above what it depends on.
const framed = docOf([
  frame('shape:f1', 0),
  frame('shape:f2', 1000),
  atom('shape:a', 500, 0, 'shape:f1'),
  atom('shape:b', 100, 0, 'shape:f2'),
  ...depends('shape:ar1', 'shape:a', 'shape:b'),
])
check('frame-relative y would have compared 500 against 100', [framed.store['shape:a'].y, framed.store['shape:b'].y], [500, 100])
check('page tops resolve the parent frame', [...pageTops(framed).entries()].sort(), [
  ['shape:a', 500],
  ['shape:b', 1100],
])
check('across frames, A is reported unsupported', unsupportedShapeIds(framed), ['shape:a'])

const nested = docOf([
  frame('shape:f1', 1000),
  frame('shape:f2', 200, 0, 'shape:f1'),
  atom('shape:c', 50, 0, 'shape:f2'),
])
check('a nested frame chain composes', pageTops(nested).get('shape:c'), 1250)

section('topoSort')
const chain = docOf([
  atom('shape:a', 0),
  atom('shape:b', 100),
  atom('shape:c', 200),
  ...depends('shape:ar1', 'shape:a', 'shape:b'),
  ...depends('shape:ar2', 'shape:b', 'shape:c'),
])
check('dependencies come before dependents', topoSort(chain), ['shape:c', 'shape:b', 'shape:a'])

const ties = docOf([atom('shape:z', 0, 100), atom('shape:y', 0, 0), atom('shape:x', 300)])
check('unbound cards keep reading order: y, then x', topoSort(ties), ['shape:y', 'shape:z', 'shape:x'])

section('topoSort — cycles')
const cyclic = docOf([
  atom('shape:a', 0),
  atom('shape:d', 50),
  atom('shape:b', 100),
  atom('shape:c', 200),
  ...depends('shape:ar1', 'shape:a', 'shape:b'),
  ...depends('shape:ar2', 'shape:b', 'shape:c'),
  ...depends('shape:ar3', 'shape:c', 'shape:a'),
])
check('terminates, orderable card first, the cycle held to the tail', topoSort(cyclic), [
  'shape:d',
  'shape:a',
  'shape:b',
  'shape:c',
])
check('the cycle is named, not swallowed', cycleShapeIds(cyclic), ['shape:a', 'shape:b', 'shape:c'])
check('an acyclic graph reports no cycle', cycleShapeIds(chain), [])

const selfBound = docOf([atom('shape:a', 0), atom('shape:b', 100), ...depends('shape:ar1', 'shape:a', 'shape:a')])
check('a card bound to itself is a cycle of one', cycleShapeIds(selfBound), ['shape:a'])
check('a card bound to itself is never above itself', unsupportedShapeIds(selfBound), [])
check('the rest of the canvas still sorts', topoSort(selfBound), ['shape:b', 'shape:a'])

section('determinism')
check('same input twice gives an identical array', topoSort(cyclic), topoSort(cyclic))
check('same input twice gives identical edges', dependencyEdges(cyclic), dependencyEdges(cyclic))

// Same graph, records inserted in reverse: object iteration order must not reach
// the output.
const reversed = docOf(
  [
    atom('shape:a', 0),
    atom('shape:d', 50),
    atom('shape:b', 100),
    atom('shape:c', 200),
    ...depends('shape:ar1', 'shape:a', 'shape:b'),
    ...depends('shape:ar2', 'shape:b', 'shape:c'),
    ...depends('shape:ar3', 'shape:c', 'shape:a'),
  ].reverse()
)
check('store insertion order does not reach the sort', topoSort(reversed), topoSort(cyclic))
check('store insertion order does not reach the edges', dependencyEdges(reversed), dependencyEdges(cyclic))

section('empty canvas')
const empty = docOf([])
check('no atoms, no edges', dependencyEdges(empty), [])
check('no atoms, no order', topoSort(empty), [])
check('no atoms, nothing unsupported', unsupportedShapeIds(empty), [])

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
