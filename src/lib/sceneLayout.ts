import type { Scene, SceneEdge, SceneGroup, SceneNode } from '../scene-types'
import { BODY_LINE_H, lineCount } from './measure'

/**
 * The layout pass (M6_GENERATIVE.md §5, §6.2). Scenes carry no coordinates;
 * every position on a generated canvas is computed here, deterministically,
 * with no graph library (E41.8). Pure: data in, placements out.
 *
 * All card metrics transcribe AtomShapeUtil's layout constants — pad 16, rule
 * 1, gaps 12/12/4, label rows 16 — so a computed height is exactly the height
 * at which the card clamps nothing.
 */

/** Vertical chrome around the body text: everything in the card that is not lines. */
const CARD_CHROME_TOP = 16 + 1 + 12 + 16 + 12 /* pad, rule, gap, eyebrow, gap = 57 */
const CARD_CHROME_BOTTOM = 4 + 16 + 16 /* gap, meta row, pad = 36 */
const CARD_PAD_X = 16

/** Height at which `text` fits `w` with zero clamping. */
export function cardHeight(text: string, w: number): number {
  const lines = lineCount(text, w - CARD_PAD_X * 2)
  return CARD_CHROME_TOP + lines * BODY_LINE_H + CARD_CHROME_BOTTOM
}

export interface PlacedNode {
  node: SceneNode
  x: number
  y: number
  w: number
  h: number
  /** Group id when the node sits inside a section frame. */
  group: string | null
}

export interface PlacedFrame {
  group: SceneGroup
  x: number
  y: number
  w: number
  h: number
}

export interface PlacedEdge {
  edge: SceneEdge
  /** `elbow` rails out of the right margin (spine); `arc` bends (mechanism returns). */
  kind: 'elbow' | 'arc'
  bend: number
  startAnchor: { x: number; y: number }
  endAnchor: { x: number; y: number }
}

export interface SceneLayout {
  nodes: PlacedNode[]
  frames: PlacedFrame[]
  edges: PlacedEdge[]
}

/** Spine geometry, §5.1. Every number is stated by the spec or a spacing token. */
const SPINE = {
  columnX: 0,
  columnW: 420,
  marginX: -320,
  marginW: 260,
  insetX: 460,
  insetW: 320,
  gap: 32 /* --s-6 */,
  annotationGap: 12 /* --s-3, two annotations on one card */,
  framePad: 24 /* --s-5 */,
  frameHead: 40 /* heading clearance: the title renders above the frame edge */,
}

/**
 * §5.1 — the argument in order. One column of claims; moves in the left
 * margin; figures as right insets. The column is the order, so no vertical
 * arrows; explicit dependency edges rail out of the right margin as elbows.
 *
 * Margin and inset cards attach to the nearest preceding column card in the
 * scene's node order (or the first that follows, for a leading annotation).
 */
function layoutSpine(scene: Scene): SceneLayout {
  const groupOf = new Map<string, string>()
  for (const group of scene.groups) {
    for (const id of group.nodes) groupOf.set(id, group.id)
  }

  const column = scene.nodes.filter((n) => n.slot === 'column')
  const placed = new Map<string, PlacedNode>()

  // The column accumulates measured height, opening room for a frame's heading
  // and padding at every group boundary.
  let y = 0
  let previousGroup: string | null = null
  for (const [i, node] of column.entries()) {
    const group = groupOf.get(node.id) ?? null
    if (i > 0) y += SPINE.gap
    if (group !== previousGroup) {
      if (previousGroup !== null) y += SPINE.framePad
      if (group !== null) y += SPINE.frameHead + SPINE.framePad
      previousGroup = group
    }
    const h = cardHeight(node.text, SPINE.columnW)
    placed.set(node.id, { node, x: SPINE.columnX, y, w: SPINE.columnW, h, group })
    y += h
  }

  // Annotations share their anchor's top edge; a second one on the same card
  // stacks below the first.
  const anchorFor = (index: number): PlacedNode | null => {
    for (let i = index - 1; i >= 0; i--) {
      const p = placed.get(scene.nodes[i].id)
      if (p && scene.nodes[i].slot === 'column') return p
    }
    for (let i = index + 1; i < scene.nodes.length; i++) {
      const p = placed.get(scene.nodes[i].id)
      if (p && scene.nodes[i].slot === 'column') return p
    }
    return null
  }

  const nextFree = new Map<string, number>()
  for (const [i, node] of scene.nodes.entries()) {
    if (node.slot !== 'margin' && node.slot !== 'inset') continue
    const anchor = anchorFor(i)
    const x = node.slot === 'margin' ? SPINE.marginX : SPINE.insetX
    const w = node.slot === 'margin' ? SPINE.marginW : SPINE.insetW
    const h = cardHeight(node.text, w)
    const key = `${node.slot}:${anchor?.node.id ?? 'none'}`
    const top = nextFree.get(key) ?? anchor?.y ?? 0
    placed.set(node.id, { node, x, y: top, w, h, group: null })
    nextFree.set(key, top + h + SPINE.annotationGap)
  }

  // Frames wrap their column members; margin and inset cards stay on the page,
  // outside the paper's edge on purpose — the margin is not part of the section.
  const frames: PlacedFrame[] = []
  for (const group of scene.groups) {
    const members = group.nodes.map((id) => placed.get(id)).filter((p): p is PlacedNode => !!p && p.group === group.id)
    if (members.length === 0) continue
    const top = Math.min(...members.map((m) => m.y))
    const bottom = Math.max(...members.map((m) => m.y + m.h))
    frames.push({
      group,
      x: SPINE.columnX - SPINE.framePad,
      y: top - SPINE.framePad,
      w: SPINE.columnW + SPINE.framePad * 2,
      h: bottom - top + SPINE.framePad * 2,
    })
  }

  // Explicit dependencies rail out of the right edge as elbows (§5.1). The
  // column itself is the order, so nothing vertical is drawn.
  const edges: PlacedEdge[] = scene.edges.map((edge) => ({
    edge,
    kind: 'elbow',
    bend: 0,
    startAnchor: { x: 1, y: 0.5 },
    endAnchor: { x: 1, y: 0.5 },
  }))

  return { nodes: [...placed.values()], frames, edges }
}

export function layoutScene(scene: Scene): SceneLayout {
  switch (scene.form) {
    case 'spine':
      return layoutSpine(scene)
    default:
      throw new Error(`layout for form "${scene.form}" is not built yet (M6.3)`)
  }
}
