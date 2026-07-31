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

/** Stable, readable ids for the map: `t-001`, `t-002` (§7 Stage 5's example). */
function nextTicketId(editor: Editor): string {
  const used = new Set<string>()
  for (const shape of editor.getCurrentPageShapes()) {
    if (shape.type !== 'ticket') continue
    used.add((shape.props as { sourceId?: string }).sourceId ?? '')
  }
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
