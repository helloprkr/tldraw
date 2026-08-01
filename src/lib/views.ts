import type { Editor, TLPageId } from 'tldraw'
import { CORPUS_PAGE } from '../corpus-types'
import { DELTA_PAGE } from '../delta-types'

/**
 * Which surface Jordan is standing on, and the way home (E40).
 *
 * The delta and the corpus wall are pages (§9, §8) and pages are invisible in
 * this build — `PageMenu` is null — so the only thing that can say where you are
 * and the only thing that can take you back is the keyboard. Before this file
 * there was no route back at all: the two view keys opened their page and did
 * nothing when pressed again, and refreshing the tab was the exit.
 *
 * Page identity lives here rather than beside each view, so "am I on the delta"
 * and "which page is home" can never disagree. `isDeltaPage` and `isCorpusPage`
 * are kept where their callers expect them and both now read from `currentView`.
 */

export type View = 'essay' | 'delta' | 'corpus'

/**
 * A Map rather than an object literal: a page Jordan named `constructor` would
 * hit `Object.prototype` and be mistaken for a view.
 */
const VIEW_BY_PAGE_NAME = new Map<string, View>([
  [DELTA_PAGE, 'delta'],
  [CORPUS_PAGE, 'corpus'],
])

/**
 * What the margin strip prints. The essay canvas has no label on purpose: home
 * needs no sign, and a margin that always carries a line stops being read (the
 * same rule the delta counter follows).
 */
export const VIEW_LABEL: Record<View, string | null> = {
  essay: null,
  delta: 'Delta view',
  corpus: 'Corpus wall',
}

export function currentView(editor: Editor): View {
  const name = editor.getPages().find((page) => page.id === editor.getCurrentPageId())?.name
  return (name === undefined ? undefined : VIEW_BY_PAGE_NAME.get(name)) ?? 'essay'
}

/**
 * The essay canvas is the first page that is not one of the views — tldraw's
 * own `Page 1`, which `openEssay` spreads onto and never renames. Identified by
 * elimination rather than by name, because the two names this app does control
 * are the two it is eliminating.
 */
export function essayPageId(editor: Editor): TLPageId | null {
  const page = editor.getPages().find((p) => !VIEW_BY_PAGE_NAME.has(p.name))
  return page?.id ?? null
}

/**
 * Goes home. Returns false when there was nothing to return from, which is what
 * makes the two view keys toggles: `⌘D` on the delta returns, `⌘D` anywhere else
 * opens.
 *
 * The camera is not touched. Each page keeps its own, so Jordan comes back to
 * the canvas he left rather than to a fitted view of it.
 */
export function returnToEssay(editor: Editor): boolean {
  if (currentView(editor) === 'essay') return false
  const home = essayPageId(editor)
  if (!home) return false
  editor.setCurrentPage(home)
  return true
}
