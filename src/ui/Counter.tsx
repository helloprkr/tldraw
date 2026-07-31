import { useEditor, useValue } from 'tldraw'
import type { TLShape } from 'tldraw'
import type { AtomShape } from '../shapes/AtomShapeUtil'
import { liveUnsupportedIds } from '../lib/unsupported'
import { isDeltaPage } from '../lib/deltaView'

/**
 * The margin counter (BUILD.md §7 Stage 3, extended by Stage 4). Bottom-left,
 * mono, ink-3:
 *
 *     18 CARDS · 4 UNTYPED · 2 UNSUPPORTED
 *
 * Untyped and unsupported turn terracotta when non-zero, because terracotta
 * means absence and both are a judgment not yet made. Progress here is visible
 * by subtraction: the line gets quieter as the essay firms up. There is no
 * progress bar; the absence of alarm is the progress bar.
 *
 * Segments that read zero are omitted rather than shown as `0 UNSUPPORTED` — a
 * quiet canvas should be quiet, not a row of zeroes.
 */

function isAtom(shape: TLShape): shape is AtomShape {
  return shape.type === 'atom'
}

export function Counter() {
  const editor = useEditor()

  const counts = useValue(
    'atom counts',
    () => {
      // The delta page has its own counter in the opposite margin; this one
      // counts the essay, and the essay is not there.
      if (isDeltaPage(editor)) return null

      const shapes = editor.getCurrentPageShapes()
      const atoms = shapes.filter(isAtom)
      return {
        cards: atoms.length,
        untyped: atoms.filter((s) => s.props.atom === 'untyped').length,
        unsupported: liveUnsupportedIds(editor).length,
        // §7 Stage 6: when this reads zero, the map is clear.
        open: shapes.filter((s) => s.type === 'ticket').length,
      }
    },
    [editor]
  )

  if (!counts || counts.cards === 0) return null

  return (
    <div className="margin-note margin-note--bottom-left" aria-live="polite">
      <span>{counts.cards} cards</span>
      <span className="counter__sep"> · </span>
      <span className={counts.untyped > 0 ? 'counter__alarm' : undefined}>
        {counts.untyped} untyped
      </span>
      {counts.unsupported > 0 && (
        <>
          <span className="counter__sep"> · </span>
          <span className="counter__alarm">{counts.unsupported} unsupported</span>
        </>
      )}
      {counts.open > 0 && (
        <>
          <span className="counter__sep"> · </span>
          <span className="counter__alarm">{counts.open} open</span>
        </>
      )}
    </div>
  )
}
