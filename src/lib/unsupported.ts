import type { Editor, TLArrowBinding, TLShape } from 'tldraw'
import { unsupportedFrom } from './topo'
import type { DependencyEdge } from './topo'
import { isRelation } from '../relations'

/**
 * The live-canvas path to the unsupported-claim check (BUILD.md §7 Stage 4).
 *
 * The rule itself lives in topo.ts and is shared with the node readout — this
 * file only sources the two inputs from the editor. It exists because the
 * acceptance criterion is "within one frame": serializing the whole store on
 * every drag frame to rebuild a StoreDocument would be wasted work, and
 * `getShapePageBounds` already resolves parent frames for us, which is the part
 * a naive implementation gets wrong.
 *
 * Both the counter and the margin marks call this, so the number Jordan reads
 * and the marks he sees can never disagree.
 */

function isArrow(shape: TLShape): boolean {
  return shape.type === 'arrow'
}

/** start terminal is the dependent, end terminal is the dependency (§6.3). */
export function liveDependencyEdges(editor: Editor): DependencyEdge[] {
  const edges: DependencyEdge[] = []

  for (const arrow of editor.getCurrentPageShapes().filter(isArrow)) {
    // Correspondence arrows assert something else entirely (§9); they are not
    // part of the reading-order graph.
    if (!isRelation(arrow.meta, 'dependency')) continue

    const bindings = editor.getBindingsInvolvingShape<TLArrowBinding>(arrow, 'arrow')
    const start = bindings.find((b) => b.fromId === arrow.id && b.props.terminal === 'start')
    const end = bindings.find((b) => b.fromId === arrow.id && b.props.terminal === 'end')
    if (!start || !end) continue

    // An arrow asserts a dependency only between two cards.
    if (editor.getShape(start.toId)?.type !== 'atom') continue
    if (editor.getShape(end.toId)?.type !== 'atom') continue

    edges.push({ dependent: start.toId, dependency: end.toId })
  }

  return edges
}

export function liveUnsupportedIds(editor: Editor): string[] {
  const edges = liveDependencyEdges(editor)
  if (edges.length === 0) return []

  const tops = new Map<string, number>()
  for (const { dependent, dependency } of edges) {
    for (const id of [dependent, dependency]) {
      if (tops.has(id)) continue
      const bounds = editor.getShapePageBounds(id as never)
      if (bounds) tops.set(id, bounds.y)
    }
  }

  return unsupportedFrom(edges, tops)
}
