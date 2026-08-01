import { useEditor, useValue } from 'tldraw'
import { VIEW_LABEL, currentView } from '../lib/views'

/**
 * The view label (E40) — top-left margin, mono, ink-3:
 *
 *     DELTA VIEW · ESC RETURNS
 *
 * Pages are invisible in this build, so without this the delta and the corpus
 * wall are two canvases that arrive unannounced and look like the essay having
 * changed under you. It says where you are and, in the same breath, how to
 * leave — a label that named the surface without naming the exit would only
 * make being stranded legible.
 *
 * Nothing renders on the essay canvas. Home needs no sign, and a margin that
 * always carries a line stops being read.
 *
 * Sentence case here, uppercased by `.margin-note` — the same division of
 * labour as the counter, where the words are content and the caps are a
 * rendering decision.
 */
export function ViewLabel() {
  const editor = useEditor()
  const label = useValue('view label', () => VIEW_LABEL[currentView(editor)], [editor])

  if (!label) return null

  return (
    <div className="margin-note margin-note--top-left" aria-live="polite">
      <span>{label}</span>
      <span className="counter__sep"> · </span>
      <span>esc returns</span>
    </div>
  )
}
