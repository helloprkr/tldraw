/**
 * Assertions over the read-out (BUILD.md §7 Stage 5). Not a test framework — a
 * script that exercises the pure `readout()` in node, proving it runs outside
 * the browser and that the outline it writes is the one the canvas describes.
 *
 * The snapshots below are hand-built but not invented: their record shape,
 * including frame-relative child coordinates, was read off a real
 * `work/*.tldr` written by the app.
 *
 * Run: npx tsx scripts/check-readout.ts
 */

import { readout } from '../src/lib/readout.ts'
import { serializeJson } from '../src/lib/serialize.ts'
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

/** Same verdict as check(), but a whole markdown document is unreadable escaped. */
function checkText(label: string, actual: string, expected: string): void {
  if (actual === expected) {
    console.log(`PASS  ${label}`)
    return
  }
  failures += 1
  console.log(`FAIL  ${label}`)
  const width = Math.max(actual.split('\n').length, expected.split('\n').length)
  for (let i = 0; i < width; i += 1) {
    const a = actual.split('\n')[i]
    const b = expected.split('\n')[i]
    if (a !== b) console.log(`      line ${i + 1}\n        expected ${JSON.stringify(b)}\n        actual   ${JSON.stringify(a)}`)
  }
}

function section(title: string): void {
  console.log(`\n${title}`)
}

const SLUG = 'on-the-metabolism-of-attention'
const GENERATED = '2026-07-30T14:02:11Z'

function frame(id: string, x: number, y: number, name: string): TldrRecord {
  return { id, typeName: 'shape', type: 'frame', parentId: 'page:page', x, y, props: { w: 1200, h: 760, name } }
}

/** x/y are in the parent's coordinate system, exactly as the app writes them. */
function card(
  id: string,
  parentId: string,
  x: number,
  y: number,
  atom: string,
  sourceId: string,
  text: string
): TldrRecord {
  return {
    id,
    typeName: 'shape',
    type: 'atom',
    parentId,
    x,
    y,
    props: { w: 320, h: 200, atom, text, sourceId, created: '2026-07-30', ordinal: 1 },
  }
}

function document(records: TldrRecord[]): StoreDocument {
  const store: Record<string, TldrRecord> = {}
  for (const record of records) store[record.id] = record
  store['page:page'] = { id: 'page:page', typeName: 'page' }
  store['document:document'] = { id: 'document:document', typeName: 'document' }
  return { store, schema: { schemaVersion: 2 } }
}

const GROUND = 'shape:ground'
const SEAM = 'shape:seam'

// Deliberately out of reading order in the store, and the lower frame first:
// nothing here may depend on insertion order.
const RECORDS: TldrRecord[] = [
  frame(SEAM, 0, 2000, 'The seam'),
  card(
    'shape:c-020',
    'page:page',
    0,
    3000,
    'untyped',
    'f-020',
    'A card can hold several lines.\nThis one holds three,\n\n   and some of them are indented.'
  ),
  card('shape:c-007', GROUND, 700, 400, 'claim', 'f-007', 'It is closer to a digestive capacity.'),
  card('shape:c-011', SEAM, 100, 100, 'move', 'f-011', 'Grant the resource model its strongest case first.'),
  frame(GROUND, 0, 1000, 'Ground'),
  card('shape:c-019', 'page:page', 0, 2900, 'claim', 'f-019', 'Nothing has claimed this one yet.'),
  card('shape:c-009', GROUND, 100, 400, 'figure', 'f-009', 'The digestion diagram.'),
  card(
    'shape:c-003',
    GROUND,
    100,
    100,
    'stance',
    'f-003',
    'The received view treats attention as a resource to be spent.'
  ),
]

const result = readout(document(RECORDS), { slug: SLUG, generated: GENERATED })

const EXPECTED_MAP = `---
essay: on-the-metabolism-of-attention
generated: 2026-07-30T14:02:11Z
source: work/on-the-metabolism-of-attention.tldr
cards: 6
untyped: 1
---

# On the metabolism of attention

## Ground

1. **[stance]** The received view treats attention as a resource to be spent. \`f-003\`
2. **[figure]** The digestion diagram. \`f-009\`
3. **[claim]** It is closer to a digestive capacity. \`f-007\`

## The seam

4. **[move]** Grant the resource model its strongest case first. \`f-011\`

## Unplaced

5. **[claim]** Nothing has claimed this one yet. \`f-019\`
6. **[untyped]** A card can hold several lines. This one holds three, and some of them are indented. \`f-020\`

## Assembly program

stance → figure → claim → move → claim → untyped
`

section('map.md — the whole document')
checkText('map.md renders exactly as §7 Stage 5 specifies', result.mapMd, EXPECTED_MAP)

section('frontmatter')
check(
  'the block is essay, generated, source, cards, untyped, fenced',
  result.mapMd.split('\n').slice(0, 7),
  [
    '---',
    `essay: ${SLUG}`,
    `generated: ${GENERATED}`,
    `source: work/${SLUG}.tldr`,
    'cards: 6',
    'untyped: 1',
    '---',
  ]
)
check('title is the slug in sentence case', result.mapMd.split('\n')[8], '# On the metabolism of attention')
check('document ends with exactly one newline', /[^\n]\n$/.test(result.mapMd), true)

section('order')
check(
  'frames are ordered by page y, not by store order',
  result.mapMd.split('\n').filter((line) => line.startsWith('## ')),
  ['## Ground', '## The seam', '## Unplaced', '## Assembly program']
)
check('sections in the assembly match, unplaced excluded', result.assembly.sections, ['Ground', 'The seam'])
check(
  'cards within a frame go by y, then x on a tie',
  result.assembly.units.filter((u) => u.section === 'Ground').map((u) => u.id),
  ['f-003', 'f-009', 'f-007']
)
check(
  'numbering is continuous across sections',
  result.assembly.units.map((u) => u.position),
  [1, 2, 3, 4, 5, 6]
)
check(
  'The seam continues where Ground left off',
  result.assembly.units.find((u) => u.id === 'f-011')?.position,
  4
)
check(
  'unframed cards land under Unplaced, last, in y order',
  result.assembly.units.filter((u) => u.section === null).map((u) => u.id),
  ['f-019', 'f-020']
)

section('multi-line card text')
const multiline = result.mapMd.split('\n').filter((line) => line.includes('`f-020`'))
check('one list item, not three', multiline.length, 1)
check(
  'internal whitespace collapses to single spaces',
  multiline[0],
  '6. **[untyped]** A card can hold several lines. This one holds three, and some of them are indented. `f-020`'
)

section('assembly.json mirrors the map')
check('essay and source', [result.assembly.essay, result.assembly.source], [SLUG, `work/${SLUG}.tldr`])
check('generated is the injected stamp, never a clock', result.assembly.generated, GENERATED)
check('counts agree with the frontmatter', [result.assembly.cards, result.assembly.untyped], [6, 1])
check('every unit id appears in the map', result.assembly.units.every((u) => result.mapMd.includes(`\`${u.id}\``)), true)
check(
  'every unit line reads exactly as the map does',
  result.assembly.units.every((u) =>
    result.mapMd.includes(`${u.position}. **[${u.atom}]** ${u.text} \`${u.id}\``)
  ),
  true
)
check(
  'the program is the atom sequence in reading order',
  result.assembly.program,
  ['stance', 'figure', 'claim', 'move', 'claim', 'untyped']
)
check(
  'the program line in the map is the same sequence',
  result.mapMd.trimEnd().split('\n').pop(),
  result.assembly.program.join(' → ')
)
check('no tickets, so no ticket section', result.mapMd.includes('## Open tickets'), false)
check('tickets are empty rather than absent in the JSON', result.assembly.tickets, [])

section('store order is irrelevant')
const reversed = readout(document([...RECORDS].reverse()), { slug: SLUG, generated: GENERATED })
checkText('reversing the store changes nothing', reversed.mapMd, result.mapMd)

section('tickets and gaps (M4 shapes, rendered when present)')
const withTickets = readout(
  document([
    frame(GROUND, 0, 1000, 'Ground'),
    card('shape:c-003', GROUND, 100, 100, 'stance', 'f-003', 'The received view.'),
    {
      id: 'shape:g-002',
      typeName: 'shape',
      type: 'gap',
      parentId: 'page:page',
      x: 0,
      y: 600,
      props: { w: 320, h: 200, label: "the received view's account\nof satiety", facingId: null, sourceId: 'g-002' },
    },
    {
      id: 'shape:t-001',
      typeName: 'shape',
      type: 'ticket',
      parentId: 'page:page',
      x: 0,
      y: 400,
      props: { w: 320, h: 200, text: 'What does "metabolize" cost us?', kind: 'grill', sourceId: 't-001' },
    },
  ]),
  { slug: SLUG, generated: GENERATED }
)
check(
  'open tickets print after the sections, in y order, gaps worded per §9',
  withTickets.mapMd.split('\n').filter((line) => line.startsWith('- [ ]')),
  [
    '- [ ] What does "metabolize" cost us? `t-001`',
    "- [ ] UNANSWERED — the received view's account of satiety `g-002`",
  ]
)
check(
  'each is kinded in the assembly',
  withTickets.assembly.tickets.map((t) => `${t.kind}/${t.id}`),
  ['ticket/t-001', 'gap/g-002']
)
check('a frame with cards but no unplaced pile has no Unplaced heading', withTickets.mapMd.includes('## Unplaced'), false)

section('degenerate canvases')
const empty = readout(document([]), { slug: SLUG, generated: GENERATED })
checkText(
  'an empty canvas is frontmatter and a title, nothing else',
  empty.mapMd,
  `---\nessay: ${SLUG}\ngenerated: ${GENERATED}\nsource: work/${SLUG}.tldr\ncards: 0\nuntyped: 0\n---\n\n# On the metabolism of attention\n`
)
const nameless = readout(
  document([frame('shape:nameless', 0, 0, ''), card('shape:c-1', 'shape:nameless', 10, 10, 'claim', 'f-001', 'One.')]),
  { slug: SLUG, generated: GENERATED }
)
check('a frame with no name reads as tldraw labels it', nameless.assembly.sections, ['Frame'])
check('an empty frame still prints its heading', readout(document([frame('shape:e', 0, 0, 'Hollow')]), { slug: SLUG, generated: GENERATED }).mapMd.includes('## Hollow'), true)

section('determinism')
const first = readout(document(RECORDS), { slug: SLUG, generated: GENERATED })
const second = readout(document(RECORDS), { slug: SLUG, generated: GENERATED })
check('two runs produce identical map.md', first.mapMd === second.mapMd, true)
check('two runs produce identical assembly.json bytes', serializeJson(first.assembly) === serializeJson(second.assembly), true)

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
