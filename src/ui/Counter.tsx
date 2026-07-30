import { useEditor, useValue } from 'tldraw'
import type { TLShape } from 'tldraw'
import type { AtomShape } from '../shapes/AtomShapeUtil'

/**
 * The margin counter (BUILD.md §7 Stage 3). Bottom-left, mono, ink-3:
 *
 *     18 CARDS · 4 UNTYPED
 *
 * Untyped turns terracotta when non-zero, because terracotta means absence and
 * an untyped card is an unfinished judgment. Progress here is visible by
 * subtraction: the line gets quieter as the essay firms up. There is no
 * progress bar; the absence of alarm is the progress bar.
 */

function isAtom(shape: TLShape): shape is AtomShape {
  return shape.type === 'atom'
}

export function Counter() {
  const editor = useEditor()

  const counts = useValue(
    'atom counts',
    () => {
      const atoms = editor.getCurrentPageShapes().filter(isAtom)
      const untyped = atoms.filter((s) => s.props.atom === 'untyped').length
      return { cards: atoms.length, untyped }
    },
    [editor]
  )

  if (counts.cards === 0) return null

  return (
    <div className="margin-note margin-note--bottom-left" aria-live="polite">
      <span>{counts.cards} cards</span>
      <span className="counter__sep"> · </span>
      <span className={counts.untyped > 0 ? 'counter__alarm' : undefined}>
        {counts.untyped} untyped
      </span>
    </div>
  )
}
