import { useEffect } from 'react'
import { useEditor, useValue } from 'tldraw'
import { deltaState, gapPlacements } from '../lib/delta'
import { isDeltaPage, reconcileGaps } from '../lib/deltaView'
import type { StoreDocument } from '../readout-types'

/**
 * Keeps the holes on the delta page in agreement with the correspondence graph
 * (BUILD.md §9).
 *
 * §9's closing gesture is "binding a Mine card to a Received card converts the
 * gap back to a normal card". Reconciling only on `⌘D` made that gesture appear
 * to do nothing: the arrow landed, the counter dropped to `6 UNANSWERED`
 * because it recomputes on every store change, and seven holes stayed on the
 * canvas until the view was reopened. The counter and the canvas are the two
 * things §9 exists to keep saying the same thing, so they cannot be driven by
 * different triggers.
 *
 * This renders nothing. It is a reconciler, in the margin of the component tree
 * rather than the page.
 *
 * The signature below is the *wanted* state, not the current one — which holes
 * should exist and which cards are novel. Neither quantity is derived from the
 * gaps or the marks themselves, so reconciling cannot change its own input and
 * the loop settles in one pass. `reconcileGaps` is idempotent besides: with
 * nothing to do it returns before touching the store.
 */
export function DeltaReconciler() {
  const editor = useEditor()

  const wanted = useValue(
    'delta reconciliation signature',
    () => {
      if (!isDeltaPage(editor)) return null
      const doc = { store: editor.store.serialize(), schema: null } as unknown as StoreDocument
      const holes = gapPlacements(doc)
        .map((placement) => placement.facingId)
        .sort()
      const novel = [...deltaState(doc).novel].sort()
      return `${holes.join(',')}|${novel.join(',')}`
    },
    [editor]
  )

  useEffect(() => {
    if (wanted === null) return
    reconcileGaps(editor)
  }, [editor, wanted])

  return null
}
