import { createShapeId } from 'tldraw'
import type { Editor } from 'tldraw'
import { CARD_H, CARD_W } from '../types'

/**
 * `T` — a new ticket (BUILD.md §7 Stage 6). An open question, in terracotta,
 * parked where Jordan is looking.
 *
 * Tickets are the one thing on this canvas he authors directly rather than
 * dropping into `inputs/`, so the shape is created empty and immediately put
 * into edit mode: the keystroke should leave him typing the question, not
 * hunting for where it landed.
 */

/**
 * Every ticket in the store, not only the ones on the page in front of him.
 *
 * `readout.ts` collects tickets from all pages on purpose (E20) and the margin
 * counter counts them the same way (E28), so the allocator has to draw on the
 * same set or it hands out an id that is already taken. Scoped to the current
 * page it did exactly that: a ticket written on Compose was invisible from the
 * delta page, the next `T` there was allocated `t-001` a second time, and
 * `map.md` carried two `## Open tickets` lines under one id — losing the trace
 * from map back to canvas that E11 added `sourceId` to keep.
 *
 * The walk is `Counter.tsx`'s, for the same reason: `getCurrentPageShapes` has
 * no all-pages counterpart, so the shapes come out a page at a time.
 */
function usedTicketIds(editor: Editor): Set<string> {
  const used = new Set<string>()
  for (const page of editor.getPages()) {
    for (const id of editor.getPageShapeIds(page.id)) {
      const shape = editor.getShape(id)
      if (shape?.type !== 'ticket') continue
      used.add((shape.props as { sourceId?: string }).sourceId ?? '')
    }
  }
  return used
}

/**
 * Stable, readable ids for the map: `t-001`, `t-002` (§7 Stage 5's example).
 *
 * Exported so `scripts/check-tickets.ts` can drive the allocation directly; the
 * canvas reaches it only through `createTicket`.
 */
export function nextTicketId(editor: Editor): string {
  const used = usedTicketIds(editor)
  for (let n = 1; n < 1000; n++) {
    const id = `t-${String(n).padStart(3, '0')}`
    if (!used.has(id)) return id
  }
  return `t-${used.size + 1}`
}

export function createTicket(editor: Editor): void {
  const id = createShapeId()
  const centre = editor.getViewportPageBounds().center

  editor.markHistoryStoppingPoint('new ticket')
  editor.createShape({
    id,
    type: 'ticket',
    x: centre.x - CARD_W / 2,
    y: centre.y - CARD_H / 2,
    props: {
      w: CARD_W,
      h: CARD_H,
      text: '',
      kind: 'grill',
      sourceId: nextTicketId(editor),
    },
  })
  editor.select(id)
  editor.setEditingShape(id)
}
