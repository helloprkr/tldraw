/**
 * Shared vocabulary. Everything downstream — shapes, the pure core, the node
 * scripts, the FS plugin — codes against these.
 */

/** BUILD.md §5.2. Four atom types, settled (supplement §7.1). */
export const ATOM_TYPES = ['claim', 'move', 'figure', 'stance'] as const

export type AtomType = (typeof ATOM_TYPES)[number] | 'untyped'

/**
 * §5.2's mapping, derived from each pigment's stated job in Brand/README.md.
 * Not up for reinterpretation.
 *
 * Terracotta is absent on purpose: it is reserved for absence (§9) and never
 * types an atom. Spending it on decoration destroys the one signal it carries.
 */
export const ATOM_PIGMENT: Record<AtomType, string | null> = {
  claim: 'var(--oxblood)',
  move: 'var(--ochre)',
  figure: 'var(--lapis)',
  stance: 'var(--moss)',
  untyped: null,
}

/** The same values as literals, for the raster and SVG paths that cannot read CSS. */
export const ATOM_PIGMENT_HEX: Record<AtomType, string | null> = {
  claim: '#5a1f1a',
  move: '#c08a3e',
  figure: '#2a3f6b',
  stance: '#5d6a4a',
  untyped: null,
}

export const TERRACOTTA = '#b5532e'

/** Keys 1-4 type the selection; 0 untypes it (§11). */
export const ATOM_BY_KEY: Record<string, AtomType> = {
  '1': 'claim',
  '2': 'move',
  '3': 'figure',
  '4': 'stance',
  '0': 'untyped',
}

export function isAtomType(value: unknown): value is AtomType {
  return typeof value === 'string' && (value === 'untyped' || (ATOM_TYPES as readonly string[]).includes(value))
}

/** One file, or one `---`-separated section of a notes.md, out of inputs/<slug>/. */
export interface Fragment {
  /** Stable id. From frontmatter `id:` if given, else derived from the filename. */
  id: string
  text: string
  atom: AtomType
  /** Optional pre-assigned section from frontmatter `frame:`. */
  frame: string | null
  /** The file this came from, relative to inputs/<slug>/. */
  sourceFile: string
  /** Position within the essay, by filename order then section order within a file. */
  ordinal: number
}

/** A raw file as the FS bridge hands it over. */
export interface InputFile {
  name: string
  content: string
}

/** Card geometry, fixed by §7 Stage 1. */
export const CARD_W = 320
export const CARD_H = 200
export const GUTTER = 48
export const GRID_COLUMNS = 5
/** Re-running spread parks new fragments here rather than disturbing the arrangement. */
export const STAGING_X = -600
