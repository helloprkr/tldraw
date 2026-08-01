import type { AtomType } from './types'

/**
 * Registering the custom shapes with tlschema's global props map is what makes
 * `TLShape` narrow to them across the app — `shape.type === 'atom'` type-guards,
 * `editor.updateShapes` accepts atom props, and no cast is needed anywhere.
 *
 * The augmentation must target `@tldraw/tlschema`, which declares the interface.
 * `tldraw` does not re-export it, so augmenting `'tldraw'` silently declares a
 * new unrelated interface and every narrowing keeps failing.
 */
declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    atom: {
      w: number
      h: number
      atom: AtomType
      text: string
      sourceId: string
      created: string
      ordinal: number
    }
    /**
     * One essay's atom sequence as a horizontal band (§8). The only place
     * pigment appears as area fill rather than as a mark (errata E5).
     */
    band: {
      w: number
      h: number
      title: string
      /** `atom: null` is an unclassified unit — hatched, never guessed. */
      segments: { atom: string | null; weight: number }[]
      /** Jordan's own essay: the bottom band, under a double rule. */
      mine: boolean
      /** Which corpus file this came from, so a classification can be written back. */
      slug: string
    }
    /** An open question, in terracotta (§7 Stage 6). */
    ticket: {
      w: number
      h: number
      text: string
      kind: 'grill' | 'research' | 'trial'
      /** Stable id so the map can name it `t-001` rather than a tldraw nanoid. */
      sourceId: string
    }
    /**
     * A hole (§9). Stands in for a Received card that nothing answers. Drawn
     * empty, in a terracotta hairline, so it reads as a missing tooth.
     */
    gap: {
      w: number
      h: number
      label: string
      /** The Received card this stands in for, or null. */
      facingId: string | null
      sourceId: string
    }
    /**
     * The field's axes (M6 §5.3): two bone hairlines, four mono pole labels.
     * One shape for the whole declaration so it exports as one toSvg.
     */
    axes: {
      w: number
      h: number
      xLow: string
      xHigh: string
      yLow: string
      yHigh: string
    }
    /**
     * A genealogy source (M6 §5.4). Not an atom; wears no pigment ever.
     */
    cite: {
      w: number
      h: number
      text: string
    }
    /**
     * The book-plate wrapper (§10). It carries only its own chrome — ground,
     * hairline border, double rule, caption, colophon. The figure's content is
     * the cloned shapes laid over it, so the plate never has to know what it
     * is wrapping.
     */
    plate: {
      w: number
      h: number
      /** Rendered uppercase; stored as Jordan wrote it. */
      caption: string
      figureNumber: number
      /** Paragraph reference for the colophon, or empty. */
      paragraph: string
    }
  }
}
