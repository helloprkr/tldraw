import { EASINGS, createShapeId, getSnapshot, loadSnapshot } from 'tldraw'
import type { Editor, TLShape } from 'tldraw'
import { readInputs, readWork, writeWork } from './essayFs'
import { parseFragments } from './frontmatter'
import { planSpread } from './spread'
import { CARD_H, CARD_W } from '../types'
import type { AtomShape } from '../shapes/AtomShapeUtil'

/** §5.6: camera moves take --dur-3 on the brand's long out-curve. */
const CAMERA = { animation: { duration: 420, easing: EASINGS.easeOutCubic } }
const AUTOSAVE_MS = 30_000

function isAtom(shape: TLShape): shape is AtomShape {
  return shape.type === 'atom'
}

/**
 * Stage 1 — spread. Reads the fragments off disk, restores whatever arrangement
 * already exists, and creates cards only for fragments that are new.
 *
 * Re-running never moves or deletes a card Jordan placed; new arrivals park in a
 * staging column to the left. His arrangement is sacred, and that is enforced
 * here by only ever calling createShapes.
 */
export async function openEssay(editor: Editor, slug: string): Promise<void> {
  const [inputs, work] = await Promise.all([readInputs(slug), readWork(slug)])

  if (work) {
    loadSnapshot(editor.store, { document: work as never })
  }

  const existingIds = editor.getCurrentPageShapes().filter(isAtom).map((s) => s.props.sourceId)
  const placements = planSpread(parseFragments(inputs), existingIds)

  if (placements.length > 0) {
    editor.createShapes(
      placements.map(({ x, y, fragment }) => ({
        id: createShapeId(),
        type: 'atom' as const,
        x,
        y,
        props: {
          w: CARD_W,
          h: CARD_H,
          atom: fragment.atom,
          text: fragment.text,
          sourceId: fragment.id,
          created: new Date().toISOString().slice(0, 10),
          ordinal: fragment.ordinal,
        },
      }))
    )
  }

  editor.selectNone()
  editor.zoomToFit(CAMERA)
}

/**
 * Disk is the database (§2.6), so state goes to work/<slug>.tldr on a timer and
 * on blur. Deliberately boring: no IndexedDB persistenceKey, no cleverness.
 * Committing stays Jordan's.
 */
export function startAutosave(editor: Editor, slug: string): () => void {
  const save = () => {
    const { document } = getSnapshot(editor.store)
    void writeWork(slug, document).catch((err) => {
      console.error('autosave failed', err)
    })
  }

  const timer = window.setInterval(save, AUTOSAVE_MS)
  window.addEventListener('blur', save)

  return () => {
    window.clearInterval(timer)
    window.removeEventListener('blur', save)
    save()
  }
}
