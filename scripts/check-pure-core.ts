/**
 * Assertions over the pure core. Not a test framework — a script that exercises
 * frontmatter.ts and spread.ts in node, proving they run outside the browser and
 * that the two spread paths can only ever agree.
 *
 * Run: npx tsx scripts/check-pure-core.ts
 */

import { parseFragments, parseFrontmatter, splitSections } from '../src/lib/frontmatter.ts'
import { planSpread } from '../src/lib/spread.ts'
import type { InputFile } from '../src/types.ts'

// Declared locally: @types/node is not a dependency of this repo, and the exit
// code is what makes this script usable as a gate.
declare const process: { exit(code: number): never }

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

const FULL = `---
atom: claim          # claim | move | figure | stance | untyped (default)
frame: "Ground"      # optional pre-assigned section
id: f-003            # stable id; generated from filename if absent
---

The received view treats attention as a resource to be spent.

It is closer to a digestive capacity.
`

const UNQUOTED_FRAME = `---
atom: 'stance'
frame: The seam
---
Where the writer stands.
`

const NO_FRONTMATTER = `A wall of thinking with no metadata at all.

Second paragraph, blank line preserved.
`

const BAD_ATOM = `---
atom: rhetoric
---
Not one of the four.
`

const NOTES = `---
atom: move
frame: "Notes"
---

First section of the wall.

---

Second section, with an internal blank line.

Still the second section.

---

Third section.
`

section('parseFrontmatter')
const full = parseFrontmatter(FULL)
check('full frontmatter: three keys', full.data, { atom: 'claim', frame: 'Ground', id: 'f-003' })
check(
  'full frontmatter: body trimmed of fences, blank line kept',
  full.body.trim(),
  'The received view treats attention as a resource to be spent.\n\nIt is closer to a digestive capacity.'
)
check('single quotes stripped, bare value kept whole', parseFrontmatter(UNQUOTED_FRAME).data, {
  atom: 'stance',
  frame: 'The seam',
})
const none = parseFrontmatter(NO_FRONTMATTER)
check('no frontmatter: no keys', none.data, {})
check('no frontmatter: all body', none.body, NO_FRONTMATTER)

section('splitSections')
check(
  'notes body splits into three, fences not counted',
  splitSections(parseFrontmatter(NOTES).body).map((s) => s.trim().split('\n')[0]),
  ['First section of the wall.', 'Second section, with an internal blank line.', 'Third section.']
)

section('parseFragments')
const files: InputFile[] = [
  { name: 'notes.md', content: NOTES },
  { name: '002-no-frontmatter.md', content: NO_FRONTMATTER },
  { name: '001-full.md', content: FULL },
  { name: '003-bad-atom.md', content: BAD_ATOM },
  { name: '004-stance.md', content: UNQUOTED_FRAME },
]
const fragments = parseFragments(files)

check(
  'files sorted by name, notes.md last, ids stable',
  fragments.map((f) => f.id),
  ['f-003', '002-no-frontmatter', '003-bad-atom', '004-stance', 'notes-1', 'notes-2', 'notes-3']
)
check(
  'ordinals are 1-based across the essay',
  fragments.map((f) => f.ordinal),
  [1, 2, 3, 4, 5, 6, 7]
)
check(
  'atoms: frontmatter honored, invalid falls back to untyped, absent is untyped',
  fragments.map((f) => f.atom),
  ['claim', 'untyped', 'untyped', 'stance', 'move', 'move', 'move']
)
check(
  'frames: quoted, bare, and absent',
  fragments.map((f) => f.frame),
  ['Ground', null, null, 'The seam', 'Notes', 'Notes', 'Notes']
)
check(
  'all three notes sections inherit the file frontmatter',
  fragments.filter((f) => f.sourceFile === 'notes.md').map((f) => `${f.atom}/${f.frame}`),
  ['move/Notes', 'move/Notes', 'move/Notes']
)
check(
  'notes section two keeps its internal blank line',
  fragments[5].text,
  'Second section, with an internal blank line.\n\nStill the second section.'
)
check(
  're-parse is deterministic',
  parseFragments(files).map((f) => f.id),
  fragments.map((f) => f.id)
)

section('planSpread — fresh canvas')
const twelve: InputFile[] = Array.from({ length: 12 }, (_, i) => ({
  name: `${String(i + 1).padStart(3, '0')}-fragment.md`,
  content: `Fragment number ${i + 1}.\n`,
}))
const grid = planSpread(parseFragments(twelve), [])
check('twelve fragments, twelve placements', grid.length, 12)
check('card 1 at the origin', { x: grid[0].x, y: grid[0].y }, { x: 0, y: 0 })
check('card 5 ends the first row', { x: grid[4].x, y: grid[4].y }, { x: 1472, y: 0 })
check('card 6 wraps to the second row', { x: grid[5].x, y: grid[5].y }, { x: 0, y: 248 })
check(
  'placement order follows ordinal',
  grid.map((p) => p.fragment.ordinal),
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
)

section('planSpread — re-run on an existing canvas')
const existing = ['001-fragment', '002-fragment', '003-fragment', '004-fragment']
const rerun = planSpread(parseFragments(twelve), existing)
check(
  'only fragments absent from the canvas come back',
  rerun.map((p) => p.id),
  [
    '005-fragment',
    '006-fragment',
    '007-fragment',
    '008-fragment',
    '009-fragment',
    '010-fragment',
    '011-fragment',
    '012-fragment',
  ]
)
check('no existing id is returned', rerun.some((p) => existing.includes(p.id)), false)
check('every new card parks in the staging column', [...new Set(rerun.map((p) => p.x))], [-600])
check(
  'staging column stacks downward from zero',
  rerun.map((p) => p.y),
  [0, 248, 496, 744, 992, 1240, 1488, 1736]
)
check('re-run with nothing new returns nothing', planSpread(parseFragments(twelve), twelve.map((f) => f.name.replace('.md', ''))).length, 0)

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
