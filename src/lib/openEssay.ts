import { EASINGS, createShapeId, getSnapshot, loadSnapshot } from 'tldraw'
import type { Editor, TLShape } from 'tldraw'
import { readInputsOrNull, readWork, writeWork } from './essayFs'
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
  // E12: nothing may write to work/ while the essay is still arriving. The flag
  // is cleared here rather than only set at the end, so a reload part-way
  // through cannot leave a stale "ready" standing over an empty store.
  ready = false
  const [inputs, work] = await Promise.all([readInputsOrNull(slug), readWork(slug)])

  // A generated essay (M6) has a compiled canvas and no inputs/ folder at all.
  // Only a slug with neither is refused — that is a typo, and opening it blank
  // would invite autosave to mint an empty work file under the wrong name.
  if (!inputs && !work) {
    throw new Error(`no inputs/${slug}/ and no work/${slug}.tldr — nothing to open`)
  }

  if (work) {
    loadSnapshot(editor.store, { document: work as never })
  }

  const existingIds = editor.getCurrentPageShapes().filter(isAtom).map((s) => s.props.sourceId)
  const placements = planSpread(parseFragments(inputs ?? []), existingIds)

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

  // Opening an essay is not an edit, and must not be undoable.
  //
  // Without this, the snapshot load and the initial spread sit on the undo
  // stack with no mark in front of them, so the first cmd+Z after opening an
  // essay unwinds past them and empties the canvas — eighteen shapes to zero,
  // measured. Autosave would then write that empty store to work/<slug>.tldr on
  // the next tick, which is E12's failure reached by a different road: the guard
  // there asks whether the store is ready, and a store emptied by undo is.
  //
  // cmd+Z stays tldraw's default (§11); it just no longer has anything behind
  // the essay to undo into.
  editor.clearHistory()

  editor.zoomToFit(CAMERA)
  ready = true
}

/**
 * Whether the canvas is safe to write to disk. See E12: an autosave that runs
 * against a half-initialized store overwrites the file it is about to read.
 */
let ready = false

/**
 * Writes work/<slug>.tldr now. The shared write edge for all three triggers —
 * the 30s timer, blur, and ⌘S — so the readiness guard cannot be honored by two
 * of them and forgotten by the third.
 */
export async function saveWork(editor: Editor, slug: string): Promise<boolean> {
  if (!ready) return false
  const { document } = getSnapshot(editor.store)
  await writeWork(slug, document)
  return true
}

/**
 * Disk is the database (§2.6), so state goes to work/<slug>.tldr every 30s and
 * on blur — the two triggers §7 Stage 8 names, and no others.
 *
 * Two guards, both of which exist because this function can destroy Jordan's
 * arrangement and nothing else in the app can:
 *
 * 1. It refuses to write until `openEssay` has finished. React StrictMode
 *    mounts, unmounts, and remounts in development, so an unguarded autosave
 *    writes the empty store from the first mount over a real canvas, and the
 *    remount then reads back the file it just destroyed.
 * 2. It does not save on teardown. Saving on unmount reads whatever the store
 *    happens to hold mid-teardown, which is the same failure wearing a
 *    different hat. A timer and a blur are enough; anything unsaved at teardown
 *    is at most thirty seconds of work, and losing the file is unbounded.
 */
export function startAutosave(editor: Editor, slug: string): () => void {
  const save = () => {
    void saveWork(editor, slug).catch((err) => {
      console.error('autosave failed', err)
    })
  }

  const timer = window.setInterval(save, AUTOSAVE_MS)
  window.addEventListener('blur', save)

  return () => {
    window.clearInterval(timer)
    window.removeEventListener('blur', save)
  }
}
