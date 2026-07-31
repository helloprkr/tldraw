/**
 * Assertions over corpus.ts. Not a test framework — a script that exercises the
 * corpus wall's pure core (BUILD.md §8) in node, proving that the fresh-parse
 * path never classifies anything, that a malformed assembly costs one band and
 * not the wall, that a band's segments are that essay's own proportions, and
 * that recording a judgment leaves the assembly it was given untouched.
 *
 * Run: npx tsx scripts/check-corpus.ts
 */

import {
  assemblyFileName,
  classifyUnit,
  countWords,
  parseAssembly,
  parseEssay,
  slugFromFileName,
  toBands,
} from '../src/lib/corpus.ts'
import type { CorpusAssembly } from '../src/corpus-types.ts'
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

/** Weights are divisions; comparing them at full precision tests the FPU. */
function near(label: string, actual: number, expected: number): void {
  check(label, Number(actual.toFixed(9)), Number(expected.toFixed(9)))
}

function refuses(label: string, run: () => unknown): void {
  let outcome = 'returned'
  try {
    run()
  } catch (error) {
    outcome = error instanceof RangeError ? 'threw' : 'threw the wrong kind of error'
  }
  check(label, outcome, 'threw')
}

function atoms(assembly: CorpusAssembly): unknown[] {
  return assembly.units.map((unit) => unit.atom)
}

function words(assembly: CorpusAssembly): number[] {
  return assembly.units.map((unit) => unit.words)
}

function sumWeights(weights: number[]): number {
  return weights.reduce((total, weight) => total + weight, 0)
}

section('parseEssay — the whole essay, every kind of block')
const ESSAY = [
  '---',
  'title: "It’s so over"',
  'author: another writer',
  '---',
  '',
  '# A heading that is not the title',
  '',
  'The first paragraph runs two lines',
  'and is one unit.',
  '',
  '## II',
  '',
  'The second paragraph—mine—as I said, doesn’t stop.',
  '',
  '> A received position, quoted whole.',
  '> Two lines, one unit.',
  '',
  '- one item',
  '- two items',
  '',
  '```js',
  'const dropped = true',
  '',
  'const stillDropped = true',
  '```',
  '',
  '---',
  '',
  'The last paragraph.',
  '',
].join('\n')

const essay = parseEssay(ESSAY, 'its-so-over')
check('frontmatter title wins over any heading', essay.title, 'It’s so over')
check('the slug is the caller’s, never the file’s guess', essay.slug, 'its-so-over')
check('five prose blocks become five units', essay.units.length, 5)
check('EVERY unit comes back unclassified (§8: never guess)', atoms(essay), [
  null,
  null,
  null,
  null,
  null,
])
check('and not one of them is the string "untyped"', atoms(essay).filter((a) => a !== null), [])
check('word counts, block by block', words(essay), [10, 9, 9, 4, 3])
check('a paragraph keeps its source text for the margin panel', essay.units[0].text, 'The first paragraph runs two lines\nand is one unit.')
check('a blockquote is one unit, markers kept in the text', essay.units[2].text, '> A received position, quoted whole.\n> Two lines, one unit.')
check('a tight list is one unit, not one per item', essay.units[3].text, '- one item\n- two items')
check('the essay ends where the prose does', essay.units[4].text, 'The last paragraph.')
check('no unit came out of the fenced block', essay.units.some((unit) => unit.text?.includes('dropped')), false)
check('a studied essay carries no mine key', 'mine' in essay, false)

section('parseEssay — title derivation')
const h1Titled = parseEssay(['# The Metabolism of Attention', '', 'Opening claim.'].join('\n'), 'metabolism')
check('the opening H1 titles an essay with no frontmatter', h1Titled.title, 'The Metabolism of Attention')
check('and the heading itself is not a unit', h1Titled.units.length, 1)

const proseFirst = parseEssay(['Opening claim.', '', '# A late heading', '', 'And more.'].join('\n'), 'prose-first')
check('prose before the H1 means the essay never named itself', proseFirst.title, 'prose-first')
check('the late heading is still dropped', proseFirst.units.length, 2)
check('so the slug stands in, unaltered — no invented capitals', parseEssay('Just prose.', 'its-so-over').title, 'its-so-over')

const mineEssay = parseEssay(['---', 'mine: true', '---', '', 'My own paragraph.'].join('\n'), 'mine-slug')
check('frontmatter marks the essay as Jordan’s own', mineEssay.mine, true)
check('closed ATX headings lose their trailing hashes', parseEssay('# Titled ##\n\nBody.', 's').title, 'Titled')

section('parseEssay — the degenerate essays')
const empty = parseEssay('', 'empty')
check('an empty essay has no units', empty.units, [])
check('an empty essay still has a slug and a title', [empty.slug, empty.title], ['empty', 'empty'])
check('frontmatter alone is an empty essay', parseEssay('---\ntitle: Nothing\n---\n', 'nothing').units, [])
check('a heading alone is an empty essay', parseEssay('# Only a heading', 'only').units, [])

const single = parseEssay('One paragraph, nothing else.', 'single')
check('one paragraph is one unit', single.units.length, 1)
check('with its own word count', single.units[0].words, 4)
check('and no classification', single.units[0].atom, null)

const blanks = parseEssay('First.\n\n\n\n   \n\nSecond.', 'blanks')
check('a run of blank lines is one separator', blanks.units.length, 2)

section('countWords — the brand’s punctuation')
check('don’t is one word (curly)', countWords('don’t'), 1)
check("don't is one word (straight)", countWords("don't"), 1)
check('mine—as is two words (unspaced em dash)', countWords('mine—as'), 2)
check('§ 4 is one word: the numeral, not the dingbat', countWords('§ 4'), 1)
check('§4 counts the same', countWords('§4'), 1)
check('a bare § is no words', countWords('§'), 0)
check('an ellipsis is no words', countWords('…'), 0)
check('well-known stays one word (a hyphen does not break)', countWords('well-known'), 1)
check('a double hyphen does break', countWords('well--known'), 2)
check('an en dash breaks a range', countWords('1971–1975'), 2)
check('nothing is nothing', countWords(''), 0)
check('whitespace alone is nothing', countWords('  \n\t '), 0)
check('a full sentence', countWords('The delta is the whole of it.'), 7)

section('parseAssembly — the file path')
const AUTHORED = serializeJson({
  slug: 'its-so-over',
  title: 'It’s so over',
  units: [
    { atom: 'stance', words: 84 },
    { atom: 'move', words: 133 },
  ],
})
const authored = parseAssembly(AUTHORED, 'ignored-slug')
check('§8’s own example parses', authored !== null, true)
check('the file’s slug wins when it has one', authored?.slug, 'its-so-over')
check('its atoms survive', authored ? atoms(authored) : null, ['stance', 'move'])
check('its counts survive', authored ? words(authored) : null, [84, 133])
check('and it is a fixed point through the one serializer', serializeJson(authored), AUTHORED)

const mineFile = parseAssembly('{"slug":"mine","title":"Mine","mine":true,"units":[]}', 'x')
check('mine survives the read', mineFile?.mine, true)
check('mine is written before the units, so the flag stays visible', serializeJson(mineFile), '{\n  "slug": "mine",\n  "title": "Mine",\n  "mine": true,\n  "units": []\n}\n')
check('mine: "true" as a string is not the flag', parseAssembly('{"slug":"a","title":"A","mine":"true","units":[]}', 'x')?.mine, undefined)

section('parseAssembly — malformed input errs toward a missing band, never an invented one')
check('unparseable JSON is no band', parseAssembly('{', 'slug'), null)
check('an empty file is no band', parseAssembly('', 'slug'), null)
check('whitespace is no band', parseAssembly('   \n', 'slug'), null)
check('a JSON array is the wrong shape', parseAssembly('[{"atom":null,"words":10}]', 'slug'), null)
check('a JSON string is the wrong shape', parseAssembly('"its-so-over"', 'slug'), null)
check('a JSON number is the wrong shape', parseAssembly('42', 'slug'), null)
check('JSON null is the wrong shape', parseAssembly('null', 'slug'), null)
check('an object without units is no essay to draw', parseAssembly('{"slug":"a","title":"A"}', 'slug'), null)
check('units of the wrong type is no essay to draw', parseAssembly('{"slug":"a","title":"A","units":{}}', 'slug'), null)

const noSlug = parseAssembly('{"units":[{"atom":"claim","words":12}]}', 'from-the-filename')
check('a missing slug takes the caller’s filename', noSlug?.slug, 'from-the-filename')
check('a missing title takes the slug', noSlug?.title, 'from-the-filename')
check('and the unit is kept', noSlug ? words(noSlug) : null, [12])
check('a non-string title is repaired, not fatal', parseAssembly('{"slug":"a","title":7,"units":[]}', 'x')?.title, 'a')

const dirtyUnits = parseAssembly(
  [
    '{"slug":"dirty","title":"Dirty","units":[',
    '{"atom":"preamble","words":40},',
    '{"atom":"untyped","words":10},',
    '{"atom":"claim"},',
    '{"atom":"move","words":"133"},',
    '{"atom":"figure","words":-5},',
    '{"atom":"stance","words":null},',
    'null,',
    '17,',
    '{"atom":"claim","words":20,"text":"kept"}',
    ']}',
  ].join(''),
  'dirty'
)
check('every unit is kept — none is dropped', dirtyUnits?.units.length, 9)
check('an atom outside the four becomes a visible hole, never another judgment', dirtyUnits ? atoms(dirtyUnits) : null, [
  null,
  null,
  'claim',
  'move',
  'figure',
  'stance',
  null,
  null,
  'claim',
])
check('"untyped" is normalized to null, so a hole has one spelling', dirtyUnits?.units[1].atom, null)
check('unreadable counts become zero width, not NaN', dirtyUnits ? words(dirtyUnits) : null, [40, 10, 0, 0, 0, 0, 0, 0, 20])
check('text is preserved where it exists', dirtyUnits?.units[8].text, 'kept')
check('and absent where it does not', 'text' in (dirtyUnits?.units[0] ?? {}), false)

section('the round trip — parse, serialize, reparse')
const reread = parseAssembly(serializeJson(essay), 'its-so-over')
check('a fresh parse survives a write and a read', serializeJson(reread), serializeJson(essay))
check('and its units are still unclassified', reread ? atoms(reread) : null, [null, null, null, null, null])
const classified = classifyUnit(essay, 0, 'stance')
check('a judgment survives the same trip', serializeJson(parseAssembly(serializeJson(classified), 'its-so-over')), serializeJson(classified))

section('toBands — proportions within an essay')
function assemblyOf(slug: string, counts: number[], mine = false): CorpusAssembly {
  const base: CorpusAssembly = {
    slug,
    title: slug,
    units: counts.map((count) => ({ atom: null, words: count })),
  }
  return mine ? { ...base, mine: true } : base
}

const proportional = toBands([assemblyOf('a', [100, 200, 100])])[0]
near('a 200-word unit is twice a 100-word unit', proportional.segments[1].weight, proportional.segments[0].weight * 2)
near('the first unit is a quarter of the essay', proportional.segments[0].weight, 0.25)
near('the weights sum to 1', sumWeights(proportional.segments.map((s) => s.weight)), 1)
check('the band carries the essay total', proportional.words, 400)

const awkward = toBands([assemblyOf('thirds', [1, 1, 1])])[0]
near('thirds still sum to 1', sumWeights(awkward.segments.map((s) => s.weight)), 1)

const withHole = toBands([
  {
    slug: 'h',
    title: 'H',
    units: [
      { atom: 'stance', words: 84 },
      { atom: null, words: 133 },
      { atom: 'untyped', words: 0 },
    ],
  },
])[0]
check('segments keep unit order, so index i is unit i', withHole.segments.map((s) => s.atom), ['stance', null, null])
check('a zero-word unit keeps its place in the sequence', withHole.segments.length, 3)
near('and takes no width', withHole.segments[2].weight, 0)
near('the rest still sum to 1', sumWeights(withHole.segments.map((s) => s.weight)), 1)

section('toBands — the essays that would divide by zero')
const allZero = toBands([assemblyOf('silent', [0, 0, 0, 0])])[0]
check('a zero-word essay yields no NaN', allZero.segments.every((s) => Number.isFinite(s.weight)), true)
near('its units share the band evenly', allZero.segments[0].weight, 0.25)
near('and still sum to 1', sumWeights(allZero.segments.map((s) => s.weight)), 1)
check('the band reports zero words honestly', allZero.words, 0)

const noUnits = toBands([assemblyOf('bare', [])])[0]
check('an essay with no units is an empty band, not a crash', noUnits.segments, [])
check('and weighs nothing', noUnits.words, 0)
check('an empty corpus is an empty wall', toBands([]), [])

section('toBands — Jordan’s own essay is the bottom band (§8)')
const ordered = toBands([
  assemblyOf('studied-one', [10]),
  assemblyOf('my-own', [10], true),
  assemblyOf('studied-two', [10]),
  assemblyOf('studied-three', [10]),
])
check('mine is last however the caller ordered the files', ordered.map((band) => band.slug), [
  'studied-one',
  'studied-two',
  'studied-three',
  'my-own',
])
check('the studied essays keep the caller’s order above it', ordered.slice(0, 3).map((band) => band.mine), [false, false, false])
check('and the last band is the one below the double rule', ordered[3].mine, true)

const twoMine = toBands([
  assemblyOf('mine-b', [10], true),
  assemblyOf('studied', [10]),
  assemblyOf('mine-a', [10], true),
])
check('two of his own stay in their own order, both below', twoMine.map((band) => band.slug), [
  'studied',
  'mine-b',
  'mine-a',
])
check('mine is always explicit on a band', toBands([assemblyOf('s', [1])])[0].mine, false)

section('classifyUnit — the judgment, without touching what it was given')
const before = assemblyOf('subject', [84, 133])
const snapshot = serializeJson(before)
const set = classifyUnit(before, 1, 'move')
check('the atom is recorded', atoms(set), [null, 'move'])
check('the input is byte-identical afterwards', serializeJson(before), snapshot)
check('and its unit objects were not shared', before.units[1].atom, null)
check('nothing else about the unit moves', set.units[1].words, 133)
check('nor about the assembly', [set.slug, set.title], ['subject', 'subject'])

const cleared = classifyUnit(set, 1, null)
check('a judgment can be withdrawn to null', atoms(cleared), [null, null])
check('and "untyped" clears it too — §11’s 0 key writes one kind of blank', atoms(classifyUnit(set, 1, 'untyped')), [null, null])
check('the classified assembly is itself untouched by the withdrawal', atoms(set), [null, 'move'])

const mineSubject = classifyUnit(assemblyOf('mine-subject', [10], true), 0, 'figure')
check('mine survives a classification', mineSubject.mine, true)
check('and the key order still puts it before the units', serializeJson(mineSubject), '{\n  "slug": "mine-subject",\n  "title": "mine-subject",\n  "mine": true,\n  "units": [\n    {\n      "atom": "figure",\n      "words": 10\n    }\n  ]\n}\n')

const withText = classifyUnit(parseAssembly('{"slug":"t","title":"T","units":[{"atom":null,"words":3,"text":"kept"}]}', 't') as CorpusAssembly, 0, 'claim')
check('classifying does not drop the source text', withText.units[0].text, 'kept')

section('classifyUnit — an index outside the essay is refused, not ignored')
refuses('one past the end', () => classifyUnit(before, 2, 'claim'))
refuses('a negative index', () => classifyUnit(before, -1, 'claim'))
refuses('a fractional index', () => classifyUnit(before, 1.5, 'claim'))
refuses('NaN', () => classifyUnit(before, Number.NaN, 'claim'))
refuses('any index at all into an essay with no units', () => classifyUnit(assemblyOf('bare', []), 0, 'claim'))
check('the first and last real indices are accepted', [
  atoms(classifyUnit(before, 0, 'claim'))[0],
  atoms(classifyUnit(before, 1, 'claim'))[1],
], ['claim', 'claim'])

section('file names — one namer for both edges')
check('a slug becomes its assembly file', assemblyFileName('its-so-over'), 'its-so-over.assembly.json')
check('an assembly file gives back its slug', slugFromFileName('its-so-over.assembly.json'), 'its-so-over')
check('so does the markdown beside it', slugFromFileName('its-so-over.md'), 'its-so-over')
check('and a path is not a slug', slugFromFileName('corpus/its-so-over.assembly.json'), 'its-so-over')
check('a dotted slug keeps its dots', slugFromFileName('corpus/part.two.assembly.json'), 'part.two')

section('determinism — the two paths cannot disagree')
check('parseEssay twice is the same essay', serializeJson(parseEssay(ESSAY, 'its-so-over')), serializeJson(essay))
check('parseAssembly twice is the same assembly', serializeJson(parseAssembly(AUTHORED, 'x')), serializeJson(parseAssembly(AUTHORED, 'x')))
check('toBands twice is the same wall', JSON.stringify(toBands([essay, assemblyOf('m', [3], true)])), JSON.stringify(toBands([essay, assemblyOf('m', [3], true)])))
check('classifyUnit twice is the same judgment', serializeJson(classifyUnit(before, 0, 'stance')), serializeJson(classifyUnit(before, 0, 'stance')))
check('carriage returns do not change the parse', serializeJson(parseEssay(ESSAY.replace(/\n/g, '\r\n'), 'its-so-over')), serializeJson(essay))

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
