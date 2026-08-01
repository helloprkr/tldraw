/**
 * Assertions over the figure registry (BUILD.md §10, export mechanics 4 and 5).
 * Not a test framework — a script that exercises the pure `figures.ts` in node,
 * proving it runs outside the browser and that a figure's name and number, once
 * issued, are the ones the app and the CLI would both issue.
 *
 * Run: npx tsx scripts/check-figures.ts
 */

import {
  addFigure,
  captionSlug,
  figureFileNames,
  hashSource,
  nextFigureNumber,
  parseRegistry,
} from '../src/lib/figures.ts'
import { emptyRegistry } from '../src/figure-types.ts'
import type { FigureRecord, FigureRegistry } from '../src/figure-types.ts'
import { serializeJson } from '../src/lib/serialize.ts'

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

const ESSAY = 'on-the-metabolism-of-attention'

function record(number: number, caption: string): FigureRecord {
  const slug = captionSlug(caption)
  return {
    number,
    caption,
    slug,
    paragraph: null,
    shapeIds: [`shape:c-${number}`],
    created: '2026-07-30T14:02:11Z',
    sourceHash: hashSource(`canvas ${number}`),
    origin: 'hand',
    files: figureFileNames(number, slug),
  }
}

function registryOf(numbers: number[]): FigureRegistry {
  return { essay: ESSAY, figures: numbers.map((n) => record(n, `Figure ${n}`)) }
}

section('captionSlug — the ordinary cases')
check('a plain caption kebabs', captionSlug('The delta'), 'the-delta')
check('§4 tree name is reproduced', captionSlug('The delta'), 'the-delta')
check('mixed case lowercases', captionSlug('The DELTA Between Received And Mine'), 'the-delta-between-received-and-mine')
check('internal whitespace runs collapse to one hyphen', captionSlug('The   delta \n between'), 'the-delta-between')

section('captionSlug — the brand punctuation (Brand/README.md)')
check(
  'em-dash reads as a word break, curly quotes vanish',
  captionSlug('The delta between “received” and mine—as it stands'),
  'the-delta-between-received-and-mine-as-it-stands'
)
check("a curly apostrophe does not split a word", captionSlug('Jordan’s ground'), 'jordans-ground')
check('a straight apostrophe behaves identically', captionSlug("Jordan's ground"), 'jordans-ground')
check('en-dash and ellipsis are separators', captionSlug('Figure 3–4 … the seam'), 'figure-3-4-the-seam')
check('the dingbats §, ¶ and ❦ are separators, not characters', captionSlug('§ 4 ¶ 26 ❦ the plate'), '4-26-the-plate')

section('captionSlug — the edges')
check('trailing punctuation leaves no trailing hyphen', captionSlug('What holds?'), 'what-holds')
check('leading punctuation leaves no leading hyphen', captionSlug('—and then, the seam.'), 'and-then-the-seam')
check('a punctuation-only caption falls back', captionSlug('—?!“”…'), 'untitled')
check('an empty caption falls back', captionSlug(''), 'untitled')
check('whitespace only falls back', captionSlug('   \n  '), 'untitled')
check('a caption that folds away entirely falls back', captionSlug('τὸ μεταβολικόν'), 'untitled')
check('accents fold to their base letter', captionSlug('Café Métabolisme — ÉTAT du champ'), 'cafe-metabolisme-etat-du-champ')
check('a slug fed back in is unchanged', captionSlug(captionSlug('The delta between “received” and mine—as it stands')), 'the-delta-between-received-and-mine-as-it-stands')
check('the fallback is idempotent too', captionSlug(captionSlug('')), 'untitled')

section('captionSlug — length')
const AT_LIMIT = captionSlug('The delta between “received” and mine—as it stands')
check('exactly at the 48 character limit, nothing is cut', AT_LIMIT.length, 48)
const LONG = captionSlug('The received view treats attention as a resource to be spent')
check('a long caption cuts on a word boundary', LONG, 'the-received-view-treats-attention-as-a-resource')
check('and lands inside the limit', LONG.length <= 48, true)
check('no trailing hyphen survives the cut', /-$/.test(LONG), false)
const ONE_WORD = captionSlug('Antidisestablishmentarianismantidisestablishmentarianism')
check('a single over-long word is hard cut at the limit', ONE_WORD.length, 48)
check('the hard cut is the first 48 characters', ONE_WORD, 'antidisestablishmentarianismantidisestablishment')
check('truncation is idempotent', captionSlug(LONG), LONG)

section('nextFigureNumber')
check('an empty registry starts at 1', nextFigureNumber(emptyRegistry(ESSAY)), 1)
check('a contiguous registry continues', nextFigureNumber(registryOf([1, 2, 3])), 4)
check('a gap is not refilled: numbers only move forward', nextFigureNumber(registryOf([1, 2, 5])), 6)
check('out of order still reads the highest', nextFigureNumber(registryOf([3, 1, 2])), 4)
check('gap and disorder together', nextFigureNumber(registryOf([7, 2, 4])), 8)
check('it is not length + 1', nextFigureNumber(registryOf([1, 2, 5])) !== registryOf([1, 2, 5]).figures.length + 1, true)
check('past 99 it keeps counting', nextFigureNumber(registryOf([99])), 100)

section('figureFileNames')
check(
  'the §4 tree pair, exactly',
  figureFileNames(1, 'the-delta'),
  { svg: 'fig-01-the-delta.svg', png: 'fig-01-the-delta@2x.png' }
)
check('single digits are zero padded', figureFileNames(9, 'the-seam').svg, 'fig-09-the-seam.svg')
check('two digits are not padded further', figureFileNames(10, 'the-seam').svg, 'fig-10-the-seam.svg')
check('99 is the last two digit number', figureFileNames(99, 'the-seam').svg, 'fig-99-the-seam.svg')
check('past 99 the number widens rather than truncating', figureFileNames(100, 'the-seam').svg, 'fig-100-the-seam.svg')
check('and the png widens with it', figureFileNames(100, 'the-seam').png, 'fig-100-the-seam@2x.png')
check('an unslugged caption is slugged on the way in', figureFileNames(3, 'The Delta—as it stands').svg, 'fig-03-the-delta-as-it-stands.svg')
check('an empty slug never yields fig-03-.svg', figureFileNames(3, '').svg, 'fig-03-untitled.svg')
check('a number below 1 falls back to 1', figureFileNames(0, 'the-seam').svg, 'fig-01-the-seam.svg')
check('a non-number never writes NaN into a filename', figureFileNames(Number.NaN, 'the-seam').svg, 'fig-01-the-seam.svg')
check('svg and png share one stem', (() => {
  const names = figureFileNames(12, 'the-delta')
  return names.png === names.svg.replace(/\.svg$/, '@2x.png')
})(), true)

section('addFigure does not mutate')
const before = registryOf([1, 2])
const beforeBytes = serializeJson(before)
const after = addFigure(before, record(3, 'The seam'))
check('the input still has two figures', before.figures.length, 2)
check('the input is byte for byte what it was', serializeJson(before), beforeBytes)
check('the result has three', after.figures.length, 3)
check('the result is a different object', after === before, false)
check('the figures array is a different array', after.figures === before.figures, false)
check('the essay carries over', after.essay, ESSAY)
check('the appended row is last', after.figures[2].number, 3)
check('the existing rows are the same records', after.figures[0] === before.figures[0], true)
check('the new number follows from the new registry', nextFigureNumber(after), 4)

section('parseRegistry — nothing to read')
check('a missing file is a fresh registry', parseRegistry(null, ESSAY), emptyRegistry(ESSAY))
check('an empty file is a fresh registry', parseRegistry('', ESSAY), emptyRegistry(ESSAY))
check('a whitespace file is a fresh registry', parseRegistry('\n  \n', ESSAY), emptyRegistry(ESSAY))
check('malformed JSON does not throw', parseRegistry('{"essay": "x", "figures": [', ESSAY), emptyRegistry(ESSAY))
check('a truncated file does not throw', parseRegistry('{"essay', ESSAY), emptyRegistry(ESSAY))
check('numbering restarts after a structural loss', nextFigureNumber(parseRegistry('not json at all', ESSAY)), 1)

section('parseRegistry — valid')
const VALID = serializeJson(registryOf([1, 2, 3]))
check('a round trip through bytes is lossless', serializeJson(parseRegistry(VALID, ESSAY)), VALID)
check('numbering continues from the file', nextFigureNumber(parseRegistry(VALID, ESSAY)), 4)
check(
  'the essay comes from the caller, not the file',
  parseRegistry('{"essay": "some-other-essay", "figures": []}', ESSAY).essay,
  ESSAY
)

section('parseRegistry — valid JSON, wrong shape')
check('an object with no figures key', parseRegistry('{"essay": "x"}', ESSAY), emptyRegistry(ESSAY))
check('figures is a string', parseRegistry('{"figures": "nope"}', ESSAY), emptyRegistry(ESSAY))
check('the whole payload is a string', parseRegistry('"nope"', ESSAY), emptyRegistry(ESSAY))
check('the whole payload is a number', parseRegistry('42', ESSAY), emptyRegistry(ESSAY))
check('the whole payload is null', parseRegistry('null', ESSAY), emptyRegistry(ESSAY))
check(
  'a bare array is read as the figures list',
  parseRegistry('[{"number": 4, "caption": "The seam"}]', ESSAY).figures.map((f) => f.number),
  [4]
)

section('parseRegistry — damaged rows are repaired, not dropped')
const DAMAGED = `{
  "essay": "${ESSAY}",
  "figures": [
    { "number": 1, "caption": "The delta", "slug": "the-delta", "paragraph": "26",
      "shapeIds": ["shape:c-1"], "created": "2026-07-30T14:02:11Z",
      "sourceHash": "abc", "files": { "svg": "fig-01-the-delta.svg", "png": "fig-01-the-delta@2x.png" } },
    { "number": 2 },
    { "number": 3, "caption": "The seam", "shapeIds": "not an array", "paragraph": 26, "files": {} },
    { "caption": "no number at all" },
    "not an object",
    null,
    { "number": 4.5, "caption": "not an integer" },
    { "number": 7, "caption": "The last one", "files": { "svg": "fig-07-hand-renamed.svg" } }
  ]
}`
const repaired = parseRegistry(DAMAGED, ESSAY)
check('rows with a readable number survive', repaired.figures.map((f) => f.number), [1, 2, 3, 7])
check('the intact row is untouched', repaired.figures[0].caption, 'The delta')
check('a row with only a number keeps its number', repaired.figures[1].number, 2)
check('and gets filenames rebuilt from what is known', repaired.figures[1].files, {
  svg: 'fig-02-untitled.svg',
  png: 'fig-02-untitled@2x.png',
})
check('a missing slug is derived from the caption', repaired.figures[2].slug, 'the-seam')
check('a non-array shapeIds becomes empty, not a crash', repaired.figures[2].shapeIds, [])
check('a non-string paragraph becomes null', repaired.figures[2].paragraph, null)
check('an empty files object is rebuilt', repaired.figures[2].files, {
  svg: 'fig-03-the-seam.svg',
  png: 'fig-03-the-seam@2x.png',
})
check('a hand-renamed svg is kept as written', repaired.figures[3].files.svg, 'fig-07-hand-renamed.svg')
check('and only the missing half is rebuilt', repaired.figures[3].files.png, 'fig-07-the-last-one@2x.png')
check('an unnumbered row is dropped, it protects nothing', repaired.figures.some((f) => f.caption === 'no number at all'), false)
check('a fractional number is dropped', repaired.figures.some((f) => f.caption === 'not an integer'), false)
check('the salvaged high number governs the next figure', nextFigureNumber(repaired), 8)
check('every repaired row is a complete record', repaired.figures.every((f) =>
  typeof f.number === 'number' &&
  typeof f.caption === 'string' &&
  typeof f.slug === 'string' &&
  Array.isArray(f.shapeIds) &&
  typeof f.created === 'string' &&
  typeof f.sourceHash === 'string' &&
  typeof f.files.svg === 'string' &&
  typeof f.files.png === 'string'
), true)
check('a repaired registry re-parses to itself', serializeJson(parseRegistry(serializeJson(repaired), ESSAY)), serializeJson(repaired))

section('hashSource')
const TLDR = '{"store":{"shape:c-003":{"type":"atom"}},"schema":{"schemaVersion":2}}'
check('stable across calls', hashSource(TLDR), hashSource(TLDR))
check('deterministic from a freshly built identical string', hashSource(TLDR), hashSource(`${TLDR.slice(0, 10)}${TLDR.slice(10)}`))
check('sixteen hex characters', /^[0-9a-f]{16}$/.test(hashSource(TLDR)), true)
check('a one character change changes the digest', hashSource(TLDR) === hashSource(TLDR.replace('003', '004')), false)
check('a one character append changes the digest', hashSource(TLDR) === hashSource(`${TLDR} `), false)
check('transposition is not invisible', hashSource('ab') === hashSource('ba'), false)
check('the empty string hashes to a fixed value', hashSource(''), hashSource(''))
check('the empty string is still sixteen characters', hashSource('').length, 16)
check('an empty canvas and a real one differ', hashSource('') === hashSource(TLDR), false)
const spread = new Set(Array.from({ length: 2000 }, (_, i) => hashSource(`shape:c-${i}`)))
check('two thousand near-identical inputs, no collision', spread.size, 2000)

section('the whole step 4 and 5 sequence')
const disk = parseRegistry(null, ESSAY)
const n = nextFigureNumber(disk)
const caption = 'The delta between “received” and mine'
const slug = captionSlug(caption)
const files = figureFileNames(n, slug)
const row: FigureRecord = {
  number: n,
  caption,
  slug,
  paragraph: '26',
  shapeIds: ['shape:c-003', 'shape:c-007'],
  created: '2026-07-30T14:02:11Z',
  sourceHash: hashSource(TLDR),
  origin: 'hand',
  files,
}
const written = serializeJson(addFigure(disk, row))
check('the first export is fig-01', files, {
  svg: 'fig-01-the-delta-between-received-and-mine.svg',
  png: 'fig-01-the-delta-between-received-and-mine@2x.png',
})
check('the ledger reads back as it was written', serializeJson(parseRegistry(written, ESSAY)), written)
const second = addFigure(parseRegistry(written, ESSAY), record(nextFigureNumber(parseRegistry(written, ESSAY)), 'The seam'))
check('the second export is fig-02', second.figures[1].files.svg, 'fig-02-the-seam.svg')
check('and the first is still intact', second.figures[0].files.svg, 'fig-01-the-delta-between-received-and-mine.svg')

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
