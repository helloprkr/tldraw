import { ATOM_TYPES } from './types'

/**
 * The trace (M6_GENERATIVE.md §6.1). Structure only — no visual language, no
 * coordinates, nothing a layout pass could be tempted to read as a position.
 *
 * The one addition to the spec's sketch is `quote` on every span: the model
 * writes the verbatim characters it is pointing at, and code turns them into
 * offsets (`npm run trace -- --resolve`, E41.6). Character arithmetic is
 * precision, and §1 sends precision to code. `start`/`end` stay required in the
 * validated form; a span whose offsets do not reproduce its quote is unfounded.
 */

/** The four types from BUILD.md §5.2 carry all the way through. No fifth. */
export type TraceAtom = (typeof ATOM_TYPES)[number]

export const SOURCE_KINDS = ['essay', 'snippet', 'tweet', 'note'] as const
export type SourceKind = (typeof SOURCE_KINDS)[number]

/** §6.1's relation vocabulary, closed. */
export const TRACE_RELATION_KINDS = ['answers', 'supports', 'counters', 'derives', 'feeds'] as const
export type TraceRelationKind = (typeof TRACE_RELATION_KINDS)[number]

export interface TraceSource {
  /** `s-1`, `s-2`, … */
  id: string
  kind: SourceKind
  /** Repo-relative, always under `context/<slug>/`. */
  file: string
  cite: string
}

export interface TraceSpan {
  /** A source id. */
  source: string
  /** Character offsets into the source file. Minted by `--resolve`, never by the model. */
  start: number
  end: number
  /** The verbatim characters the offsets must reproduce. Written by the model. */
  quote: string
}

export interface TraceUnit {
  /** `u-1`, `u-2`, … */
  id: string
  atom: TraceAtom
  text: string
  /** Only meaningful for the delta form; null rather than a guess elsewhere. */
  holder: 'received' | 'mine' | null
  /** REQUIRED. §9: nothing without a span. */
  span: TraceSpan
  /** Ordinal 1..n, concrete low. Drives the `field` form's x-axis. */
  abstraction: number | null
}

export interface TraceRelation {
  from: string
  to: string
  kind: TraceRelationKind
}

export interface TraceTension {
  between: [string, string]
  note: string
  /** E41.3: a tension the model noticed rather than one stated in the pile. */
  proposed?: boolean
}

export interface TraceGap {
  /** The unit this absence faces. Maps onto M4's GapShape and a map.md ticket. */
  facing: string
  label: string
}

export interface Trace {
  idea: string
  slug: string
  /** §9: /draw and the compiler refuse while false. Only Jordan sets it true. */
  reviewed: boolean
  generated: string
  sources: TraceSource[]
  units: TraceUnit[]
  relations: TraceRelation[]
  tensions: TraceTension[]
  gaps: TraceGap[]
}

export interface TraceIssue {
  level: 'error' | 'warn'
  /** Stable code, so a check can assert on the class of failure. */
  code:
    | 'shape'
    | 'slug'
    | 'duplicate-id'
    | 'atom'
    | 'holder'
    | 'abstraction'
    | 'source'
    | 'unfounded'
    | 'quote-missing'
    | 'quote-ambiguous'
    | 'quote-mismatch'
    | 'relation'
    | 'tension'
    | 'gap'
    | 'reviewed'
  /** The unit/relation/source the issue is about, when there is one. */
  at: string | null
  message: string
}

function issue(level: TraceIssue['level'], code: TraceIssue['code'], at: string | null, message: string): TraceIssue {
  return { level, code, at, message }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTraceAtom(value: unknown): value is TraceAtom {
  return typeof value === 'string' && (ATOM_TYPES as readonly string[]).includes(value)
}

/**
 * Parse without trusting. Returns the trace only when the shape is usable
 * enough to validate further; shape errors otherwise.
 */
export function parseTrace(value: unknown): { trace: Trace | null; issues: TraceIssue[] } {
  const issues: TraceIssue[] = []
  if (!isRecord(value)) {
    return { trace: null, issues: [issue('error', 'shape', null, 'trace.json is not an object')] }
  }

  for (const key of ['idea', 'slug', 'generated'] as const) {
    if (typeof value[key] !== 'string' || value[key] === '') {
      issues.push(issue('error', 'shape', null, `"${key}" must be a non-empty string`))
    }
  }
  if (typeof value.reviewed !== 'boolean') {
    issues.push(issue('error', 'reviewed', null, '"reviewed" must be literally true or false'))
  }
  for (const key of ['sources', 'units', 'relations', 'tensions', 'gaps'] as const) {
    if (!Array.isArray(value[key])) {
      issues.push(issue('error', 'shape', null, `"${key}" must be an array`))
    }
  }
  if (issues.some((i) => i.level === 'error')) return { trace: null, issues }
  return { trace: value as unknown as Trace, issues }
}

/**
 * Everything checkable without file contents: ids, vocabulary, references.
 * Span-against-file checks live in `checkSpans`, because the pure core does not
 * read disks — the caller brings the bytes.
 */
export function validateTrace(trace: Trace): TraceIssue[] {
  const issues: TraceIssue[] = []

  const sourceIds = new Set<string>()
  for (const source of trace.sources) {
    if (sourceIds.has(source.id)) issues.push(issue('error', 'duplicate-id', source.id, `duplicate source id ${source.id}`))
    sourceIds.add(source.id)
    if (!(SOURCE_KINDS as readonly string[]).includes(source.kind)) {
      issues.push(issue('error', 'source', source.id, `source kind "${String(source.kind)}" is not essay|snippet|tweet|note`))
    }
    if (!source.file.startsWith(`context/${trace.slug}/`)) {
      issues.push(issue('error', 'source', source.id, `source file must live under context/${trace.slug}/ (got ${source.file})`))
    }
  }

  const unitIds = new Set<string>()
  for (const unit of trace.units) {
    if (unitIds.has(unit.id)) issues.push(issue('error', 'duplicate-id', unit.id, `duplicate unit id ${unit.id}`))
    unitIds.add(unit.id)

    if (!isTraceAtom(unit.atom)) {
      issues.push(issue('error', 'atom', unit.id, `atom "${String(unit.atom)}" is not one of the four types — there is no fifth`))
    }
    if (unit.holder !== null && unit.holder !== 'received' && unit.holder !== 'mine') {
      issues.push(issue('error', 'holder', unit.id, `holder must be "received", "mine", or null — never a guess`))
    }
    if (unit.abstraction !== null && (!Number.isInteger(unit.abstraction) || unit.abstraction < 1)) {
      issues.push(issue('error', 'abstraction', unit.id, `abstraction must be an ordinal 1..n or null`))
    }

    const span = unit.span
    if (!span || typeof span !== 'object') {
      issues.push(issue('error', 'unfounded', unit.id, `unit ${unit.id} has no span — nothing without a span (§9)`))
      continue
    }
    if (!sourceIds.has(span.source)) {
      issues.push(issue('error', 'unfounded', unit.id, `span points at unknown source "${span.source}"`))
    }
    if (typeof span.quote !== 'string' || span.quote.trim().length < 8) {
      issues.push(issue('error', 'unfounded', unit.id, `span.quote must be a verbatim excerpt of at least 8 characters`))
    }
  }

  for (const [i, relation] of trace.relations.entries()) {
    const at = `relations[${i}]`
    if (!unitIds.has(relation.from)) issues.push(issue('error', 'relation', at, `relation.from "${relation.from}" is not a unit`))
    if (!unitIds.has(relation.to)) issues.push(issue('error', 'relation', at, `relation.to "${relation.to}" is not a unit`))
    if (!(TRACE_RELATION_KINDS as readonly string[]).includes(relation.kind)) {
      issues.push(issue('error', 'relation', at, `relation kind "${String(relation.kind)}" is not in the closed vocabulary`))
    }
  }

  for (const [i, tension] of trace.tensions.entries()) {
    const at = `tensions[${i}]`
    if (!Array.isArray(tension.between) || tension.between.length !== 2) {
      issues.push(issue('error', 'tension', at, `tension.between must name exactly two units`))
      continue
    }
    for (const id of tension.between) {
      if (!unitIds.has(id)) issues.push(issue('error', 'tension', at, `tension names unknown unit "${id}"`))
    }
    if (typeof tension.note !== 'string' || tension.note.trim() === '') {
      issues.push(issue('error', 'tension', at, `a tension is named, not resolved — the note carries the naming`))
    }
  }

  for (const [i, gap] of trace.gaps.entries()) {
    const at = `gaps[${i}]`
    if (!unitIds.has(gap.facing)) issues.push(issue('error', 'gap', at, `gap faces unknown unit "${gap.facing}"`))
    if (typeof gap.label !== 'string' || gap.label.trim() === '') {
      issues.push(issue('error', 'gap', at, `gap.label must say what is absent`))
    }
  }

  return issues
}

/** How many times `needle` occurs in `haystack`. Overlaps count; determinism over cleverness. */
function occurrences(haystack: string, needle: string): number {
  if (needle === '') return 0
  let count = 0
  let from = 0
  for (;;) {
    const at = haystack.indexOf(needle, from)
    if (at === -1) return count
    count += 1
    from = at + 1
  }
}

/**
 * Resolve every span's quote to offsets against the actual file bytes.
 * Idempotent: a span whose offsets already reproduce its quote is left alone.
 * Returns a new trace; never mutates. An unresolvable quote leaves offsets
 * untouched and reports — resolution must not guess (§1).
 */
export function resolveSpans(
  trace: Trace,
  files: ReadonlyMap<string, string>
): { trace: Trace; issues: TraceIssue[] } {
  const issues: TraceIssue[] = []
  const bySource = new Map(trace.sources.map((s) => [s.id, s]))

  const units = trace.units.map((unit) => {
    const span = unit.span
    if (!span || typeof span.quote !== 'string') return unit
    const source = bySource.get(span.source)
    const content = source ? files.get(source.file) : undefined
    if (content === undefined) {
      issues.push(issue('error', 'unfounded', unit.id, `no file content for source "${span.source}"`))
      return unit
    }

    if (
      Number.isInteger(span.start) &&
      Number.isInteger(span.end) &&
      span.start >= 0 &&
      content.slice(span.start, span.end) === span.quote
    ) {
      return unit
    }

    const count = occurrences(content, span.quote)
    if (count === 0) {
      issues.push(issue('error', 'quote-missing', unit.id, `quote not found verbatim in ${source?.file ?? span.source}`))
      return unit
    }
    if (count > 1) {
      issues.push(
        issue('error', 'quote-ambiguous', unit.id, `quote occurs ${count} times in ${source?.file ?? span.source} — lengthen it until it is unique`)
      )
      return unit
    }
    const start = content.indexOf(span.quote)
    return { ...unit, span: { ...span, start, end: start + span.quote.length } }
  })

  return { trace: { ...trace, units }, issues }
}

/**
 * The `unfounded` ground truth: every span's offsets must reproduce its quote
 * from the real file. This is what "the model can organize Jordan's thinking;
 * it cannot add to it" compiles down to.
 */
export function checkSpans(trace: Trace, files: ReadonlyMap<string, string>): TraceIssue[] {
  const issues: TraceIssue[] = []
  const bySource = new Map(trace.sources.map((s) => [s.id, s]))

  for (const unit of trace.units) {
    const span = unit.span
    if (!span) continue
    const source = bySource.get(span.source)
    const content = source ? files.get(source.file) : undefined
    if (content === undefined) {
      issues.push(issue('error', 'unfounded', unit.id, `source file for "${span.source}" is missing`))
      continue
    }
    if (!Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end <= span.start) {
      issues.push(issue('error', 'unfounded', unit.id, `span offsets are unresolved — run npm run trace -- --resolve ${trace.slug}`))
      continue
    }
    if (content.slice(span.start, span.end) !== span.quote) {
      issues.push(
        issue('error', 'quote-mismatch', unit.id, `offsets ${span.start}..${span.end} do not reproduce the quote — the file or the trace moved`)
      )
    }
  }
  return issues
}
