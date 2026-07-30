import { toDomPrecision, useEditor, useValue } from 'tldraw'
import type { TLShapeId } from 'tldraw'
import { liveUnsupportedIds } from '../lib/unsupported'

/**
 * The unsupported-claim underline (BUILD.md §7 Stage 4). A card that sits above
 * something it depends on gets a terracotta hairline under its bottom edge —
 * the canvas telling Jordan his reading order is wrong before he writes a word.
 * Terracotta means absence: the argument under this card is missing.
 *
 * Derived, never stored. Writing the set onto shape meta would dirty the
 * document on every drag frame, churning undo history and firing the 30s
 * autosave to work/<slug>.tldr continuously. This is computed from the store
 * and kept nowhere.
 *
 * The rule lives in lib/topo.ts and reaches the canvas through
 * lib/unsupported.ts, which is also what the counter calls. Same source, so the
 * marks Jordan sees and the `N UNSUPPORTED` he reads cannot disagree — and no
 * copy of the graph logic lives here.
 *
 * Mount in the InFrontOfTheCanvas slot. That slot is screen space, not page
 * space — `.tl-canvas__in-front` is a sibling of `.tl-canvas`, not a child of
 * its html layer — so the camera transform is applied here. Inside that layer
 * one CSS pixel is one page unit, and the marks ride pan, zoom, and drag with
 * the cards they belong to.
 */

interface Mark {
  id: string
  /** Page space: the card's left edge, its bottom edge, its width. */
  x: number
  y: number
  w: number
}

interface View {
  camera: { x: number; y: number; z: number }
  marks: Mark[]
}

export function UnsupportedMarks() {
  const editor = useEditor()

  const view = useValue<View | null>(
    'unsupported marks',
    () => {
      const ids = liveUnsupportedIds(editor)
      // Null rather than an empty list: a quiet canvas is the common case, and a
      // stable value keeps every unrelated drag frame free of a React render.
      if (ids.length === 0) return null

      const marks: Mark[] = []
      for (const id of ids) {
        const bounds = editor.getShapePageBounds(id as TLShapeId)
        if (!bounds) continue
        marks.push({
          id,
          x: toDomPrecision(bounds.minX),
          y: toDomPrecision(bounds.maxY),
          w: toDomPrecision(bounds.width),
        })
      }
      if (marks.length === 0) return null

      const { x, y, z } = editor.getCamera()
      return {
        camera: { x: toDomPrecision(x), y: toDomPrecision(y), z: toDomPrecision(z) },
        marks,
      }
    },
    [editor]
  )

  if (!view) return null

  const { camera, marks } = view

  return (
    // The counter announces the count; this is the same fact drawn on the paper.
    <div className="unsupported-layer" aria-hidden="true">
      <div
        className="unsupported-layer__page"
        style={{ transform: `scale(${camera.z}) translate(${camera.x}px, ${camera.y}px)` }}
      >
        {marks.map((mark) => (
          <div
            key={mark.id}
            className="unsupported-mark"
            style={{ transform: `translate(${mark.x}px, ${mark.y}px)`, width: `${mark.w}px` }}
          />
        ))}
      </div>
    </div>
  )
}
