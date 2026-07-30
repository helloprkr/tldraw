/**
 * The plate and the figure registry (BUILD.md §10). Shared by the plate shape,
 * the pure registry logic, and the export orchestration.
 */

/** Plate geometry, §10. Every number is a token from tokens.css. */
export const PLATE_PAD = 48 /* --s-7 */
export const PLATE_RULE_GAP = 24 /* --s-5, double rule to caption baseline block */
export const PLATE_CAPTION_SIZE = 12 /* --t-meta */
export const PLATE_CAPTION_LEADING = 1.5 /* --lh-normal */
/** The printer's chapter break: 3px double, --ink-3. The plate's signature. */
export const PLATE_DOUBLE_RULE_H = 3
/** Jordan's colophon mark, bottom right. */
export const COLOPHON = 'JWP'

/** One row of out/<slug>/figures/figures.json. */
export interface FigureRecord {
  number: number
  /** As Jordan typed it, sentence-cased. Rendered uppercase; stored as written. */
  caption: string
  /** The kebab slug used in the filename. */
  slug: string
  /** Paragraph reference, if given: renders as `JWP ¶ 26`. */
  paragraph: string | null
  /** tldraw ids of the shapes the plate was made from. */
  shapeIds: string[]
  created: string
  /** Hash of the .tldr the plate was cut from, so a figure can be traced back. */
  sourceHash: string
  files: { svg: string; png: string }
}

export interface FigureRegistry {
  essay: string
  figures: FigureRecord[]
}

export function emptyRegistry(essay: string): FigureRegistry {
  return { essay, figures: [] }
}
