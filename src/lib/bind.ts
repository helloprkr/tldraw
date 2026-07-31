import { atom, createShapeId } from 'tldraw'
import type { Editor, Signal, TLArrowBinding, TLShape, TLShapeId } from 'tldraw'
import { isRelation } from '../relations'
import type { Relation } from '../relations'
import '../ui/bind.css'

/**
 * Stage 4 — bind dependencies. `B` arms the mode; the next click on a card
 * draws an arrow from every selected card to the one clicked.
 *
 * Direction carries the meaning (§6.3): A -> B reads "A depends on B", so B
 * must land first. topo.ts reads the same convention off the binding records.
 */

const armed = atom('bindMode.armed', false)

/** True while the mode waits for its click. UI reads this through useValue. */
export const bindModeArmed: Signal<boolean> = armed

const ARMED_CLASS = 'essay-bind-armed'

interface Session {
  teardown(): void
}

/**
 * A mode that silently swallows clicks is worse than no mode at all, so exactly
 * one session may exist and every exit path runs through disarm().
 */
let session: Session | null = null

function isAtom(shape: TLShape): boolean {
  return shape.type === 'atom'
}

/**
 * A hole stands where its Received card stands, and in DeltaView the card
 * behind it is not drawn — so §9's closing gesture, "bind a Mine card to a
 * Received card", can only land on the gap. The gap carries `facingId` for
 * exactly this: clicking the hole binds to the card it stands in for, the
 * correspondence closes, and the hole is reconciled away.
 */
function isBindTarget(shape: TLShape): boolean {
  return shape.type === 'atom' || shape.type === 'gap'
}

function resolveTarget(editor: Editor, shape: TLShape): TLShapeId | null {
  if (shape.type !== 'gap') return shape.id
  const facingId = (shape.props as { facingId?: string | null }).facingId
  if (!facingId) return null
  return editor.getShape(facingId as TLShapeId) ? (facingId as TLShapeId) : null
}

/** Selected cards, in the order tldraw reports them. Arrows are not sources. */
function selectedAtomIds(editor: Editor): TLShapeId[] {
  return editor.getSelectedShapes().filter(isAtom).map((shape) => shape.id)
}

/**
 * An arrow is one shape plus two binding records; the pair (start.toId,
 * end.toId) is the edge. Walk from the source's bindings so the scan stays
 * proportional to that card's degree rather than to the page.
 */
function hasEdge(
  editor: Editor,
  fromId: TLShapeId,
  toId: TLShapeId,
  relation: Relation
): boolean {
  return editor.getBindingsToShape<TLArrowBinding>(fromId, 'arrow').some((start) => {
    if (start.props.terminal !== 'start') return false
    // A dependency and a correspondence between the same pair are different
    // assertions; only a repeat of the same relation is a duplicate.
    if (!isRelation(editor.getShape(start.fromId)?.meta, relation)) return false
    return editor
      .getBindingsFromShape<TLArrowBinding>(start.fromId, 'arrow')
      .some((end) => end.props.terminal === 'end' && end.toId === toId)
  })
}

/**
 * §5.5 and Stage 4: ink-3, 1px, small solid head, never pigmented.
 *
 * theme.ts collapses every named tldraw color to solid ink, so no `color` value
 * can produce ink-3; the hue is forced in bind.css and `black` is chosen here
 * only to pin the prop against whatever the style memory last held. `size: 's'`
 * fixes the head geometry (the arrowhead path is derived from stroke width, so
 * thinning the line in CSS alone keeps the head readable). `fill: 'fill'` is the
 * only fill that paints the head with the shape's own color rather than the
 * paper-warm semi tint, which matters on the export path where CSS cannot reach.
 */
const ARROW_PROPS = {
  kind: 'arc',
  bend: 0,
  color: 'black',
  labelColor: 'black',
  size: 's',
  dash: 'solid',
  fill: 'fill',
  arrowheadStart: 'none',
  arrowheadEnd: 'triangle',
  scale: 1,
} as const

function createArrows(
  editor: Editor,
  sources: TLShapeId[],
  targetId: TLShapeId,
  relation: Relation
): number {
  const edges = sources.filter((id) => id !== targetId && !hasEdge(editor, id, targetId, relation))
  if (edges.length === 0) return 0

  // One mark, one transaction: three cards bound at once undo as one keystroke.
  editor.markHistoryStoppingPoint('bind')
  editor.run(() => {
    for (const fromId of edges) {
      const arrowId = createShapeId()
      // The relation is stamped here and read by every consumer. Compose's
      // dependency graph and DeltaView's correspondences share the arrow
      // binding and must never share a graph.
      editor.createShape({ id: arrowId, type: 'arrow', props: ARROW_PROPS, meta: { relation } })
      editor.createBinding({
        type: 'arrow',
        fromId: arrowId,
        toId: fromId,
        props: { terminal: 'start', normalizedAnchor: { x: 0.5, y: 0.5 } },
      })
      editor.createBinding({
        type: 'arrow',
        fromId: arrowId,
        toId: targetId,
        props: { terminal: 'end', normalizedAnchor: { x: 0.5, y: 0.5 } },
      })
    }
  })

  return edges.length
}

function disarm(): void {
  if (!session) return
  const ending = session
  session = null
  ending.teardown()
  armed.set(false)
}

/** Escape, a click on empty canvas, a click on anything that is not a card. */
export function cancelBindMode(_editor?: Editor): void {
  disarm()
}

/**
 * Arms the mode against the current selection. Re-arming replaces the pending
 * session; an empty selection is a no-op, which is why the mode can never be
 * armed with nothing to bind from.
 */
export function startBindMode(editor: Editor, relation: Relation = 'dependency'): void {
  disarm()

  const sources = selectedAtomIds(editor)
  if (sources.length === 0) return

  const container = editor.getContainer()

  function onPointerDown(event: PointerEvent): void {
    // Anything outside the canvas — margin counter, browser chrome — cancels
    // rather than binds, and keeps its own click.
    if (!(event.target instanceof Node) || !container.contains(event.target)) {
      disarm()
      return
    }

    // Consumed before tldraw sees it, so the bind click never selects or drags.
    event.preventDefault()
    event.stopPropagation()
    disarm()

    if (event.button !== 0) return

    const point = editor.screenToPage({ x: event.clientX, y: event.clientY })
    const hit = editor.getShapeAtPoint(point, { hitInside: true, filter: isBindTarget })
    if (!hit) return

    const targetId = resolveTarget(editor, hit)
    if (!targetId) return

    createArrows(editor, sources, targetId, relation)
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    disarm()
  }

  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('blur', disarm)
  container.classList.add(ARMED_CLASS)

  session = {
    teardown() {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('blur', disarm)
      container.classList.remove(ARMED_CLASS)
    },
  }

  armed.set(true)
}

if (import.meta.env.DEV) {
  Object.assign(window, { bindMode: { startBindMode, cancelBindMode, bindModeArmed } })
}
