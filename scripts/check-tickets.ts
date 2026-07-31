/**
 * Assertions over ticket id allocation (BUILD.md §7 Stage 6, E11). Not a test
 * framework — a script that drives `nextTicketId` against a hand-built editor
 * whose shapes are spread over more than one page, proving an id is allocated
 * against the whole store rather than against the page in front of Jordan.
 *
 * The bug this exists to catch: allocation scoped to the current page handed out
 * `t-001` twice — once on Compose, once on the delta page, because the scan
 * never saw across — and `map.md` then carried two `## Open tickets` lines under
 * one id. Tickets are collected from every page by `readout.ts` (E20) and
 * counted from every page by the margin counter (E28); allocation is the third
 * place that has to agree, and it was the one that did not.
 *
 * This is its own suite rather than a case in check-readout.ts because
 * `src/lib/tickets.ts` is editor-facing. The other suites exercise the pure core
 * and their stated worth is that they prove their subjects run outside the
 * browser (supplement §6.2); putting a tldraw import inside one of them would
 * spend that proof to save a file.
 *
 * Run: npx tsx scripts/check-tickets.ts
 */

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

interface FakeShape {
  id: string
  type: string
  props: Record<string, unknown>
}

interface FakePage {
  name: string
  shapes: FakeShape[]
}

/**
 * The slice of the editor allocation touches, hand-built so a store can hold
 * more than one page without a browser.
 *
 * It answers `getCurrentPageShapes` as well, which the fixed allocator never
 * calls. That is deliberate: if the walk is ever narrowed back to the current
 * page, this check fails on a duplicate id — the thing that actually broke —
 * rather than on a missing method, which would read as a broken fixture.
 */
function editorOf(pages: FakePage[], current = 0) {
  const byId = new Map<string, FakeShape>()
  for (const page of pages) for (const shape of page.shapes) byId.set(shape.id, shape)
  return {
    getPages: () => pages.map((page, i) => ({ id: `page:p${i}`, name: page.name })),
    getPageShapeIds: (pageId: string) =>
      new Set((pages[Number(pageId.replace('page:p', ''))]?.shapes ?? []).map((s) => s.id)),
    getShape: (id: string) => byId.get(id),
    getCurrentPageShapes: () => pages[current].shapes,
  }
}

type FakeEditor = ReturnType<typeof editorOf>

/**
 * Imported through a computed specifier rather than a literal one.
 * `tickets.ts` reaches tldraw's types, and tsconfig.scripts.json compiles
 * without the DOM lib and without `skipLibCheck`, so a literal import would put
 * several hundred node_modules errors into `npm run build`. A non-literal
 * specifier is opaque to tsc and resolved normally at runtime, which is the
 * whole of what this check needs.
 */
const TICKETS = '../src/lib/tickets.ts'
const { nextTicketId } = (await import(TICKETS)) as {
  nextTicketId: (editor: FakeEditor) => string
}

const COMPOSE = 'Page 1'
const DELTA = 'Delta'

function ticket(sourceId: string): FakeShape {
  return { id: `shape:tk-${sourceId || 'blank'}`, type: 'ticket', props: { sourceId } }
}

function card(sourceId: string): FakeShape {
  return { id: `shape:c-${sourceId}`, type: 'atom', props: { sourceId } }
}

function gap(sourceId: string): FakeShape {
  return { id: `shape:gp-${sourceId}`, type: 'gap', props: { sourceId } }
}

section('the repro — a ticket on another page has already taken its id')
const composeHasOne = [
  { name: COMPOSE, shapes: [ticket('t-001')] },
  { name: DELTA, shapes: [] },
]
check(
  'standing on the delta page, the Compose ticket is still seen',
  nextTicketId(editorOf(composeHasOne, 1)),
  't-002'
)
check(
  'and the mirror: standing on Compose, the delta ticket is seen',
  nextTicketId(
    editorOf(
      [
        { name: COMPOSE, shapes: [] },
        { name: DELTA, shapes: [ticket('t-001')] },
      ],
      0
    )
  ),
  't-002'
)
check(
  'a third page counts like the other two',
  nextTicketId(
    editorOf(
      [
        { name: COMPOSE, shapes: [ticket('t-001')] },
        { name: DELTA, shapes: [ticket('t-002')] },
        { name: 'Scratch', shapes: [] },
      ],
      2
    )
  ),
  't-003'
)

section('the sequence that broke map.md — three T presses, alternating pages')
// Exactly BUILD.md §7 Stage 6's gesture, driven the way the canvas drives it:
// allocate, then add the shape, then move to the other page and allocate again.
const pages: FakePage[] = [
  { name: COMPOSE, shapes: [] },
  { name: DELTA, shapes: [] },
]
const allocated: string[] = []
for (const page of [0, 1, 0]) {
  const id = nextTicketId(editorOf(pages, page))
  allocated.push(id)
  pages[page].shapes.push(ticket(id))
}
check('three presses, three ids in order', allocated, ['t-001', 't-002', 't-003'])
check('and no id was handed out twice', new Set(allocated).size, 3)

section('the properties the allocator had before, unchanged')
check('a fresh canvas starts at t-001', nextTicketId(editorOf([{ name: COMPOSE, shapes: [] }])), 't-001')
check(
  'one page on its own still allocates',
  nextTicketId(editorOf([{ name: COMPOSE, shapes: [ticket('t-001'), ticket('t-002')] }])),
  't-003'
)
check(
  'a deleted ticket leaves a hole, and the hole is filled first (E23)',
  nextTicketId(
    editorOf([
      { name: COMPOSE, shapes: [ticket('t-001')] },
      { name: DELTA, shapes: [ticket('t-003')] },
    ])
  ),
  't-002'
)
check(
  'only tickets spend ticket ids: cards and gaps do not',
  nextTicketId(
    editorOf([
      { name: COMPOSE, shapes: [card('f-001'), card('f-002')] },
      { name: DELTA, shapes: [gap('g-002')] },
    ])
  ),
  't-001'
)
check(
  'a ticket carrying no authored id spends nothing',
  nextTicketId(editorOf([{ name: COMPOSE, shapes: [ticket('')] }])),
  't-001'
)

section('allocation reads, it never writes')
const settled = editorOf(composeHasOne, 1)
check('the same store twice gives the same id', [nextTicketId(settled), nextTicketId(settled)], [
  't-002',
  't-002',
])

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
