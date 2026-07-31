/**
 * The corpus wall (BUILD.md §8), as pure functions over text and JSON.
 *
 * Pure (supplement §6.2): no fs, no fetch, no DOM, no editor, no clock, and no
 * serializer — `serialize.ts` alone turns a value into bytes (E8). The browser
 * feeds these functions `/api/corpus`, the CLI feeds them `readFile`, and the
 * two paths must produce the same assembly for the same essay or the M5
 * round-trip (click a segment, press 1-4, write the JSON back) is unprovable.
 *
 * The governing rule of this file is §8's one prohibition: the parse path
 * **never guesses an atom**. Classification is a judgment, not a heuristic, so
 * `parseEssay` returns `atom: null` for every unit it finds, and every path that
 * cannot read a classification leaves a null behind rather than inventing one.
 * An unclassified unit is a hatched segment — the gaps in the analysis are as
 * visible as the analysis, which is the whole point of the wall.
 */

import { isCorpusAssembly } from '../corpus-types'
import type { AssemblyUnit, BandSegment, CorpusAssembly, UnitAtom } from '../corpus-types'
import { isAtomType } from '../types'
import { parseFrontmatter } from './frontmatter'

/** `corpus/<slug>.assembly.json` — the only writable corpus file (supplement §6.1). */
const ASSEMBLY_SUFFIX = '.assembly.json'

/**
 * A word break is whitespace or a dash that joins two words without a space.
 * The brand sets em dashes unspaced and often (`mine—as`), so an em dash has to
 * read as the space it replaces; an en dash between a range reads the same way.
 * A hyphen does not break: `well-known` is one word, as it is when read aloud.
 */
const WORD_BREAK = /[\s—–]+|--+/

/**
 * A token is a word when it contains a letter or a digit anywhere. Apostrophes
 * therefore never split and never disqualify — `don't` and `don’t` are both one
 * word — while a bare dingbat is none: `§ 4` counts 1, the numeral, because `§`
 * carries no letter. Counting the symbol would give a page of marginalia a word
 * count and put a segment on the wall for prose nobody wrote.
 */
const WORD_CONTENT = /[\p{L}\p{N}]/u

/** ATX headings, all six levels, with markdown's three-space indent tolerance. */
const HEADING = /^ {0,3}#{1,6}(?:\s|$)/
const H1 = /^ {0,3}#(?:\s|$)/
const FENCE = /^\s*(?:```|~~~)/
const THEMATIC_BREAK = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/
const BLANK = /^\s*$/

/** Stripped before counting, so a bullet or a quote mark is never a word. */
const QUOTE_MARKER = /^\s*>+\s?/
const LIST_MARKER = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/

/** One band, ready to render: §8's title, its `mine` flag, and its segments. */
export interface CorpusBand {
  slug: string
  title: string
  /** §8 sets Jordan's own band below a double rule. Always explicit here. */
  mine: boolean
  /** The essay's total, for a caller that wants to show it. */
  words: number
  /**
   * One segment per unit, in unit order — `segments[i]` is `units[i]`. That
   * correspondence is the click path: §8 classifies by clicking a segment, and
   * the index is what `classifyUnit` writes back. A zero-word unit therefore
   * keeps its place in the sequence rather than being dropped.
   */
  segments: BandSegment[]
}

/**
 * Counts the words in a run of prose. Both edges call this and the assembly on
 * disk is the record of it, so the definition above is the whole contract:
 * whitespace and unspaced dashes break, apostrophes and hyphens do not, and a
 * token with no letter or digit in it is punctuation rather than a word.
 */
export function countWords(text: string): number {
  let count = 0
  for (const token of text.split(WORD_BREAK)) {
    if (WORD_CONTENT.test(token)) count += 1
  }
  return count
}

/** `its-so-over` becomes `its-so-over.assembly.json`. One namer, both edges. */
export function assemblyFileName(slug: string): string {
  return `${slug}${ASSEMBLY_SUFFIX}`
}

/**
 * The inverse, tolerant of a path and of either corpus extension: both
 * `corpus/its-so-over.md` and `its-so-over.assembly.json` name the same essay,
 * and the slug is what joins the fresh-parse path to the file path.
 */
export function slugFromFileName(name: string): string {
  const file = name.split('/').pop() ?? name
  if (file.endsWith(ASSEMBLY_SUFFIX)) return file.slice(0, -ASSEMBLY_SUFFIX.length)
  return file.replace(/\.[^.]+$/, '')
}

/**
 * `null` and `'untyped'` mean the same thing — no judgment has been made — and
 * §8's schema spells it `null`. Collapsing the two here means the wall has one
 * test for "hatched", the file has one spelling, and `0` (§11's untype key)
 * clears a segment instead of writing a second kind of blank. Anything that is
 * not one of the four atom types is a blank, never a guess.
 */
function normalizeAtom(value: unknown): UnitAtom {
  if (!isAtomType(value) || value === 'untyped') return null
  return value
}

/**
 * The one place that decides an assembly's key order, for the same reason
 * `serialize.ts` is the one place that decides indentation (E8): scalars before
 * the unbounded `units` array keeps a hand-edited file readable, and a single
 * canonical shape makes a parse-then-write round-trip idempotent.
 *
 * `mine` is written only when true. §8's schema does not carry the key, so
 * adding `"mine": false` to every studied essay would put a diff in `corpus/`
 * that says nothing.
 */
function assembly(slug: string, title: string, mine: boolean, units: AssemblyUnit[]): CorpusAssembly {
  return mine ? { slug, title, mine, units } : { slug, title, units }
}

interface BodyScan {
  /** The opening H1, when the document has one before any prose. */
  title: string | null
  /** Paragraph units, in document order, trimmed and otherwise verbatim. */
  blocks: string[]
}

/**
 * Blocks are separated by blank lines — markdown's own paragraph rule, and the
 * one Jordan already writes to. Three kinds of line are structure rather than
 * prose and are dropped rather than made units:
 *
 * - **Headings.** There is no atom for a section number. A unit that no judgment
 *   could ever classify would print a permanent hole in the analysis, and §8's
 *   holes are supposed to mean missing analysis, not missing prose.
 * - **Fenced code.** Not prose, and its blank lines must not split the essay.
 * - **Thematic breaks.** A separator, and already a paragraph boundary.
 *
 * Blockquotes and lists *are* prose and become units: a received position quoted
 * whole is exactly the kind of unit §8 wants typed. A tight list is one unit,
 * because it is one block — splitting per item would invent a rhythm the writing
 * does not have.
 *
 * Consequence, stated plainly: word counts cover prose only, so an assembly's
 * total is smaller than a shell `wc -w` of the same file. The wall measures the
 * shape of an argument, not the size of a file.
 */
function scanBody(body: string): BodyScan {
  const blocks: string[] = []
  let current: string[] = []
  let title: string | null = null
  let fenced = false

  const flush = (): void => {
    const text = current.join('\n').trim()
    if (text) blocks.push(text)
    current = []
  }

  for (const line of body.split('\n')) {
    if (fenced) {
      if (FENCE.test(line)) fenced = false
      continue
    }
    if (FENCE.test(line)) {
      flush()
      fenced = true
      continue
    }
    if (HEADING.test(line)) {
      flush()
      // The title is the document's opening H1. A heading further down is a
      // section, and prose before it means the essay never named itself.
      if (title === null && blocks.length === 0 && H1.test(line)) {
        title = line.replace(/^ {0,3}#\s*/, '').replace(/\s+#+\s*$/, '').trim() || null
      }
      continue
    }
    if (THEMATIC_BREAK.test(line) || BLANK.test(line)) {
      flush()
      continue
    }
    current.push(line)
  }
  flush()

  return { title, blocks }
}

/** Markers are notation, not words. Stripped for the count, kept in `text`. */
function proseOf(block: string): string {
  return block
    .split('\n')
    .map((line) => line.replace(QUOTE_MARKER, '').replace(LIST_MARKER, ''))
    .join('\n')
}

function isTrue(value: string | undefined): boolean {
  const flag = value?.trim().toLowerCase()
  return flag === 'true' || flag === 'yes' || flag === '1'
}

/**
 * The fresh-parse path (§8.2): an essay becomes paragraph units with word counts
 * and **no classification whatsoever**. Every unit comes back `atom: null`, with
 * no exception and no inference from the text, ever — that is the rule §8 states
 * outright, and the reason `npm run corpus --parse` is safe to run over material
 * Jordan has already classified by hand only because the caller decides whether
 * to overwrite.
 *
 * Frontmatter is stripped through the same parser the fragments use, never a
 * second one, so an essay and a fragment agree about what a delimiter is.
 *
 * The title, in order: frontmatter `title:`, then the document's opening H1,
 * then the slug verbatim. The slug is a poor title and is meant to look like
 * one — de-slugging `its-so-over` back into `It's so over` would have to invent
 * capitalization and an apostrophe, and a fabricated title in the margin is
 * worse than a visibly unfinished one.
 *
 * `mine: true` in frontmatter marks the essay as Jordan's own, which is the flag
 * §8's double rule reads. §8 never says how an essay declares this; frontmatter
 * is the only channel the parse path has, and the alternative is guessing from
 * the filename.
 *
 * Each unit keeps its source text, so §8's "clicking a segment scrolls the
 * source text into a margin panel" needs nothing but the assembly.
 */
export function parseEssay(markdown: string, slug: string): CorpusAssembly {
  const { data, body } = parseFrontmatter(markdown)
  const scan = scanBody(body)
  const units = scan.blocks.map<AssemblyUnit>((text) => ({
    atom: null,
    words: countWords(proseOf(text)),
    text,
  }))
  return assembly(slug, data.title || scan.title || slug, isTrue(data.mine), units)
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

/**
 * A unit off disk. Repaired, never discarded: dropping one would silently lose a
 * paragraph of the essay's shape, and the wall would show a rhythm the writer
 * does not have.
 *
 * Every unreadable field errs the same way — toward a visible hole. An atom that
 * is not one of the four (a typo, a vocabulary from another tool, a `"maybe"`)
 * becomes `null` and hatches, so a corrupted judgment shows up as an unmade one
 * rather than being read as some other judgment. Word counts that are missing,
 * negative, or not finite become 0, which renders as no width rather than
 * poisoning every other segment's share of the essay.
 */
function repairUnit(row: unknown): AssemblyUnit {
  if (typeof row !== 'object' || row === null) return { atom: null, words: 0 }
  const source = row as Record<string, unknown>
  const words =
    typeof source.words === 'number' && Number.isFinite(source.words) && source.words > 0
      ? source.words
      : 0
  const unit: AssemblyUnit = { atom: normalizeAtom(source.atom), words }
  if (typeof source.text === 'string') unit.text = source.text
  return unit
}

/**
 * The file path (§8.1): `corpus/<slug>.assembly.json` as it came off disk.
 * Never throws — a malformed file must fail as a band that does not appear, not
 * as a wall that does not render.
 *
 * Which way this errs, and why the two failures are treated differently:
 *
 * - **Structural** (unparseable JSON, not an object, `units` not an array):
 *   `null`. There is no essay here to draw. Repairing a payload of the wrong
 *   shape would mean inventing units, and an invented band is a claim about a
 *   writer's rhythm that nobody made.
 * - **Field by field**: repair. A missing `slug` takes the caller's filename —
 *   which is authoritative anyway, since the file's location is what decides
 *   which essay this is — and a missing `title` takes the slug. Units follow
 *   `repairUnit` above.
 *
 * The result is checked against `isCorpusAssembly` before it is handed back, so
 * the type is a fact rather than an assertion, and key order is canonicalized:
 * from the second write on, parse-then-serialize is a fixed point.
 */
export function parseAssembly(raw: string, fallbackSlug: string): CorpusAssembly | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null

  const source = parsed as Record<string, unknown>
  if (!Array.isArray(source.units)) return null

  const slug = asString(source.slug, '') || fallbackSlug
  const candidate = assembly(
    slug,
    asString(source.title, '') || slug,
    source.mine === true,
    source.units.map(repairUnit)
  )
  return isCorpusAssembly(candidate) ? candidate : null
}

function bandOf(source: CorpusAssembly): CorpusBand {
  const counts = source.units.map((unit) =>
    typeof unit.words === 'number' && Number.isFinite(unit.words) && unit.words > 0 ? unit.words : 0
  )
  const words = counts.reduce((sum, count) => sum + count, 0)
  // Every unit weighs the same when none of them weighs anything: with all
  // counts equal, equal widths *is* the proportional answer, and it is the only
  // one that does not divide by zero or collapse the band to nothing clickable.
  const even = counts.length > 0 ? 1 / counts.length : 0

  return {
    slug: source.slug,
    title: source.title,
    mine: source.mine === true,
    words,
    segments: source.units.map<BandSegment>((unit, index) => ({
      atom: normalizeAtom(unit.atom),
      weight: words > 0 ? counts[index] / words : even,
    })),
  }
}

/**
 * Assemblies become bands. A segment's `weight` is its unit's share of that
 * essay's words, so the weights of one band sum to 1 and widths are proportional
 * within an essay but never across essays — §8 normalizes the x-axis to 0→1 per
 * band, which is what makes a short essay and a long one comparable as shapes.
 *
 * Order is the component's meaning, not a detail: §8 puts **Jordan's own essay
 * at the bottom**, below a double rule, "the printer's convention for a chapter
 * break, used here to mark the shift from studied to mine". So the studied
 * essays keep the caller's order — which is the order the files were read in,
 * stable across runs — and the `mine` bands follow, in their own order. A
 * partition rather than a sort, so nothing else about the caller's sequence can
 * be disturbed.
 */
export function toBands(assemblies: CorpusAssembly[]): CorpusBand[] {
  const bands = assemblies.map(bandOf)
  return [...bands.filter((band) => !band.mine), ...bands.filter((band) => band.mine)]
}

/**
 * The round-trip half (§8): a judgment made on the canvas, or by a Claude Code
 * pass over the file, becomes a new assembly for the caller to write back.
 *
 * Returns a new value and mutates nothing. The caller is holding the assembly it
 * read off disk, and a canvas that edits that object in place would make a
 * failed write silently disagree with the file.
 *
 * An index outside the units is refused, loudly. Returning the assembly
 * unchanged would be indistinguishable from success, and the very next thing the
 * caller does is write the file and report that the judgment was recorded.
 */
export function classifyUnit(
  source: CorpusAssembly,
  unitIndex: number,
  atom: UnitAtom
): CorpusAssembly {
  if (!Number.isInteger(unitIndex) || unitIndex < 0 || unitIndex >= source.units.length) {
    throw new RangeError(
      `classifyUnit: no unit ${unitIndex} in ${source.slug} (${source.units.length} units)`
    )
  }
  const next = normalizeAtom(atom)
  const units = source.units.map((unit, index) => (index === unitIndex ? { ...unit, atom: next } : unit))
  return assembly(source.slug, source.title, source.mine === true, units)
}
