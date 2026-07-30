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
