import { useEditor, useValue } from 'tldraw'
import { deltaState } from '../lib/delta'
import { isDeltaPage } from '../lib/deltaView'
import { deltaCount } from '../delta-types'
import type { StoreDocument } from '../readout-types'

/**
 * The delta counter (BUILD.md §9), bottom-right margin, mono, ink-3:
 *
 *     7 UNANSWERED · 3 NOVEL · DELTA 10
 *
 * UNANSWERED turns terracotta when non-zero. It only appears on the delta page —
 * on Compose the number would mean nothing, and a margin that always carries a
 * figure stops being read.
 */
export function DeltaCounter() {
  const editor = useEditor()

  const view = useValue(
    'delta counts',
    () => {
      if (!isDeltaPage(editor)) return null
      const doc = { store: editor.store.serialize(), schema: null } as unknown as StoreDocument
      const state = deltaState(doc)
      return {
        unanswered: state.unanswered.length,
        novel: state.novel.length,
        delta: deltaCount(state),
      }
    },
    [editor]
  )

  if (!view) return null

  return (
    <div className="margin-note margin-note--bottom-right" aria-live="polite">
      <span className={view.unanswered > 0 ? 'counter__alarm' : undefined}>
        {view.unanswered} unanswered
      </span>
      <span className="counter__sep"> · </span>
      <span>{view.novel} novel</span>
      <span className="counter__sep"> · </span>
      <span>delta {view.delta}</span>
    </div>
  )
}
