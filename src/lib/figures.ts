/**
 * Figure naming, numbering, and the registry (BUILD.md §10, export mechanics
 * steps 4 and 5).
 *
 * Pure (supplement §6.2): data in, data out. No fs, no fetch, no editor, no
 * clock, and no serializer — `exportFigure.ts` reads the disk, stamps the row
 * through `stamp.ts` (E13), and writes it through `serialize.ts` (E8). Every
 * decision that could drift between the two edges is made here, once.
 *
 * A figure's filename is permanent the moment it is published: it is pasted
 * into Substack and posted to X. So every function below is written to be
 * boring and repeatable rather than clever, and none of them may ever hand back
 * a name that a filesystem, a URL, or a markdown link would have to escape.
 */

import { emptyRegistry } from '../figure-types'
import type { FigureRecord, FigureRegistry } from '../figure-types'

const SEPARATOR = '-'

/**
 * Long enough for a real caption to survive recognizably, short enough that
 * `fig-01-<slug>@2x.png` stays a comfortable terminal column and a legible
 * link. Captions are prose; the filename only has to identify.
 */
const MAX_SLUG_LENGTH = 48

/** Never an empty filename fragment: `fig-01-.svg` is unnameable and unsortable. */
const FALLBACK_SLUG = 'untitled'

/**
 * Quote marks vanish rather than break a word. The brand sets curly quotes and
 * apostrophes throughout (Brand/README.md), so `Jordan's` must read `jordans`,
 * not `jordan-s`. Primes and the two spacing accents are here because they are
 * what a keyboard produces when an apostrophe was meant.
 */
const ELIDED = /['"‘’‚‛“”„‟′″ʼ´`]/g

/** NFKD splits an accented letter into letter plus mark; the mark is dropped. */
const COMBINING_MARKS = /\p{M}/gu

/**
 * Everything else that is not [a-z0-9] is a separator, and a run of them is one
 * separator. This is the em-dash rule too: the brand uses `—` unspaced and
 * frequently, and it reads as a word break, not as a character to delete.
 */
const NON_ALPHANUMERIC = /[^a-z0-9]+/g

const EDGE_SEPARATORS = /^-+|-+$/g

/**
 * A caption becomes a kebab filename fragment. Idempotent: feeding a slug back
 * in returns it unchanged, which is what lets `figureFileNames` re-run it
 * defensively.
 *
 * Lowercased; accents folded to their base letter (`Café` reads `cafe`);
 * quotes elided; every other non-alphanumeric run collapsed to one hyphen;
 * leading and trailing hyphens trimmed; truncated at a word boundary.
 *
 * A caption written entirely in a script that does not fold to ASCII — Greek,
 * CJK — will empty out and take the fallback. That is a deliberate trade: a
 * transliteration table is a large surface to maintain for a body of work
 * written in English, and `fig-07-untitled.svg` is honest rather than broken.
 */
export function captionSlug(caption: string): string {
  const folded = caption.normalize('NFKD').replace(COMBINING_MARKS, '').toLowerCase()
  const kebab = folded
    .replace(ELIDED, '')
    .replace(NON_ALPHANUMERIC, SEPARATOR)
    .replace(EDGE_SEPARATORS, '')
  return truncate(kebab) || FALLBACK_SLUG
}

/** Cuts on a word boundary when there is one, so the fragment stays readable. */
function truncate(slug: string): string {
  if (slug.length <= MAX_SLUG_LENGTH) return slug
  // One past the limit, so a separator sitting exactly on it is a clean break.
  const head = slug.slice(0, MAX_SLUG_LENGTH + 1)
  const lastBreak = head.lastIndexOf(SEPARATOR)
  const cut = lastBreak > 0 ? head.slice(0, lastBreak) : slug.slice(0, MAX_SLUG_LENGTH)
  return cut.replace(EDGE_SEPARATORS, '')
}

/**
 * §10: "Figure number auto-increments per essay." One above the highest number
 * on record — never `length + 1`, and never the lowest free number.
 *
 * Filling a gap would be the tidier ledger and the wrong answer: a gap means a
 * figure was deleted from the registry, not from the internet. Reusing its
 * number reissues a name that may already be published, and the second export
 * would overwrite the first on disk. Numbering only ever moves forward.
 */
export function nextFigureNumber(registry: FigureRegistry): number {
  let highest = 0
  for (const figure of registry.figures) {
    if (Number.isInteger(figure.number) && figure.number > highest) highest = figure.number
  }
  return highest + 1
}

/**
 * The pair §4's tree shows: `fig-01-the-delta.svg` and `fig-01-the-delta@2x.png`.
 * Both are always emitted (§10 step 3), so both names are always issued together.
 *
 * The slug is re-slugged rather than trusted: a filename must be safe no matter
 * who called this.
 */
export function figureFileNames(number: number, slug: string): { svg: string; png: string } {
  const stem = `fig-${padNumber(number)}-${captionSlug(slug)}`
  return { svg: `${stem}.svg`, png: `${stem}@2x.png` }
}

/**
 * Two digits is a minimum, not a width. Past 99 the number widens —
 * `fig-100-...` — rather than truncating or rolling over; a lost figure number
 * is a collision, and lexical order is preserved up to 999, which is more
 * essays than this practice will produce. Anything unusable as a number falls
 * back to 1 rather than writing `fig-NaN-`.
 */
function padNumber(number: number): string {
  const whole = Number.isFinite(number) ? Math.max(1, Math.trunc(number)) : 1
  return String(whole).padStart(2, '0')
}

/** Appends without mutating: the caller's registry is still the file on disk. */
export function addFigure(registry: FigureRegistry, record: FigureRecord): FigureRegistry {
  return { essay: registry.essay, figures: [...registry.figures, record] }
}

/**
 * `figures.json` as it came off disk, or its absence, becomes a usable registry.
 * Never throws — an unreadable ledger must not be what stops a figure exporting.
 *
 * Two different failures, two different rulings:
 *
 * - **Structural** (missing file, empty file, unparseable JSON, `figures` not an
 *   array): start fresh. There is nothing to salvage without writing a second
 *   JSON parser, and refusing to export would mean one bad byte blocks the tool.
 * - **Per row**: repair, never discard. A row that is an object with a readable
 *   number keeps that number and whatever fields are readable; the rest take
 *   conservative defaults, and its filenames are rebuilt from the number and
 *   slug if they are missing. Dropping a row would silently lose the record of
 *   a published figure and, worse, let its number be reissued. Only a row with
 *   no readable number is dropped, because there is nothing left to protect.
 *
 * `essay` comes from the caller, not the file: the essay is decided by which
 * `out/<slug>/figures/` this was read from, and a stale field must not outvote it.
 */
export function parseRegistry(raw: string | null, essay: string): FigureRegistry {
  if (raw === null || raw.trim() === '') return emptyRegistry(essay)

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyRegistry(essay)
  }

  const rows = rowsOf(parsed)
  if (rows === null) return emptyRegistry(essay)

  const figures: FigureRecord[] = []
  for (const row of rows) {
    const record = repairRecord(row)
    if (record !== null) figures.push(record)
  }
  return { essay, figures }
}

/** A bare array is accepted too: a hand-edited file that lost its wrapper. */
function rowsOf(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed
  if (typeof parsed === 'object' && parsed !== null) {
    const figures = (parsed as { figures?: unknown }).figures
    if (Array.isArray(figures)) return figures
  }
  return null
}

function repairRecord(row: unknown): FigureRecord | null {
  if (typeof row !== 'object' || row === null) return null
  const source = row as Record<string, unknown>

  const number = typeof source.number === 'number' ? source.number : Number.NaN
  if (!Number.isInteger(number) || number < 1) return null

  const caption = asString(source.caption, '')
  const slug = asString(source.slug, '') || captionSlug(caption)
  const rebuilt = figureFileNames(number, slug)
  const files = typeof source.files === 'object' && source.files !== null
    ? (source.files as Record<string, unknown>)
    : {}

  return {
    number,
    caption,
    slug,
    paragraph: typeof source.paragraph === 'string' ? source.paragraph : null,
    shapeIds: Array.isArray(source.shapeIds)
      ? source.shapeIds.filter((id): id is string => typeof id === 'string')
      : [],
    created: asString(source.created, ''),
    sourceHash: asString(source.sourceHash, ''),
    // Rows written before M6 predate generation entirely; they were all hand.
    origin: source.origin === 'generated' || source.origin === 'mixed' ? source.origin : 'hand',
    files: {
      svg: asString(files.svg, '') || rebuilt.svg,
      png: asString(files.png, '') || rebuilt.png,
    },
  }
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

/**
 * A 64-bit content digest of the `.tldr`, for the registry's `sourceHash`: it
 * answers "which canvas state was this figure cut from", and nothing else. It
 * is not a security boundary and must not be used as one.
 *
 * Construction: cyrb53 (bryc, public domain) — two 32-bit `Math.imul` lanes
 * with independent constants, avalanched against each other at the end, emitted
 * as both lanes in hex rather than folded to 53 bits. Sixteen hex characters,
 * so a birthday collision needs on the order of 2^32 figures.
 *
 * Chosen over a platform digest API because those are async, differ between
 * node and the browser, and cannot be reached from a pure module at all — and
 * both edges must produce the same string for the same text or `sourceHash`
 * stops tracing anything. This hashes the JS string's UTF-16 code units, so it
 * will not match an external tool's digest of the same file's bytes; it is only
 * ever compared against itself.
 */
export function hashSource(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return lane(h2) + lane(h1)
}

function lane(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0')
}
