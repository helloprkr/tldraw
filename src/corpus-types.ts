import type { AtomType } from './types'

/**
 * The corpus wall (BUILD.md §8). Three essays by one writer become three
 * horizontal bands; Jordan's own becomes a fourth. The difference between
 * another writer's rhythm and his stops being an analysis and becomes an image.
 */

/** ⌘⇧C lives on its own page, like the delta. */
export const CORPUS_PAGE = 'Corpus'

/** §8: full width, 64px tall, stacked with --s-7 between. */
export const BAND_H = 64
export const BAND_W = 1120
export const BAND_GAP = 48 /* --s-7 */
/** The mono strip of the atom sequence sits above each band. */
export const BAND_STRIP_H = 20
/** The left margin carries the essay title, right-aligned to the band. */
export const BAND_LABEL_W = 240

/**
 * A classified atom, or null when the analysis has not been made. §8 is explicit
 * that the parse path never guesses: classification is a judgment, not a
 * heuristic, and an unclassified unit renders as a visible hole in the analysis.
 */
export type UnitAtom = AtomType | null

export interface AssemblyUnit {
  atom: UnitAtom
  words: number
  /** The paragraph itself, so clicking a segment can show it (§8). Optional: an
   *  authored assembly may carry only the grammar. */
  text?: string
}

/** `corpus/<slug>.assembly.json`, per §8's schema. */
export interface CorpusAssembly {
  slug: string
  title: string
  units: AssemblyUnit[]
  /**
   * Marks the band as Jordan's own, which §8 separates from the studied essays
   * by a double rule. Absent means another writer's.
   */
  mine?: boolean
}

/** One band, ready to render. */
export interface BandSegment {
  atom: UnitAtom
  /** Share of the essay's words, 0..1. Widths are proportional (§8). */
  weight: number
}

export function isCorpusAssembly(value: unknown): value is CorpusAssembly {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CorpusAssembly>
  return (
    typeof candidate.slug === 'string' &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.units)
  )
}
