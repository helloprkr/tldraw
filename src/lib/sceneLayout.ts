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

/** Cite card metrics — CiteShapeUtil's mono geometry, transcribed. */
const CITE_ADVANCE = 7.2 /* JetBrains Mono 12px: 0.6em advance */
const CITE_LINE_H = 18
const CITE_PAD = 16

export function citeHeight(text: string, w: number): number {
  const perLine = Math.max(1, Math.floor((w - CITE_PAD * 2) / CITE_ADVANCE))
  const words = text.split(/\s+/).filter((x) => x !== '')
  let lines = 1
  let len = 0
  for (const word of words) {
    if (len === 0) len = word.length
    else if (len + 1 + word.length <= perLine) len += 1 + word.length
    else {
      lines += 1
      len = word.length
    }
  }
  return CITE_PAD * 2 + lines * CITE_LINE_H
}

export interface PlacedNode {
  node: SceneNode
  kind: 'atom' | 'cite'
  x: number
  y: number
  w: number
  h: number
  /** Group id when the node sits inside a section frame; frame names otherwise. */
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
  /** `elbow` rails out of the right margin (spine); `arc` everywhere else. */
  kind: 'elbow' | 'arc'
  bend: number
  /** `trace` for structure edges; `correspondence` in the delta (E17/E18). */
  relation: 'trace' | 'correspondence'
  dash: 'solid' | 'dashed'
  startAnchor: { x: number; y: number }
  endAnchor: { x: number; y: number }
}

export interface PlacedAxes {
  x: number
  y: number
  w: number
  h: number
  xLow: string
  xHigh: string
  yLow: string
  yHigh: string
}

export interface SceneLayout {
  nodes: PlacedNode[]
  frames: PlacedFrame[]
  edges: PlacedEdge[]
  axes: PlacedAxes | null
}

const traceEdge = (edge: SceneEdge, over: Partial<PlacedEdge> = {}): PlacedEdge => ({
  edge,
  kind: 'arc',
  bend: 0,
  relation: 'trace',
  dash: 'solid',
  startAnchor: { x: 0.5, y: 0.5 },
  endAnchor: { x: 0.5, y: 0.5 },
  ...over,
})

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
 */
function layoutSpine(scene: Scene): SceneLayout {
  const groupOf = new Map<string, string>()
  for (const group of scene.groups) {
    for (const id of group.nodes) groupOf.set(id, group.id)
  }

  const column = scene.nodes.filter((n) => n.slot === 'column')
  const placed = new Map<string, PlacedNode>()

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
    placed.set(node.id, { node, kind: 'atom', x: SPINE.columnX, y, w: SPINE.columnW, h, group })
    y += h
  }

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

  // One cursor per side column: an annotation aligns with its anchor when the
  // column is free, and otherwise queues below whatever is already there — two
  // close anchors with tall stacks must never overlap in the margin.
  const nextFree = new Map<string, number>()
  for (const [i, node] of scene.nodes.entries()) {
    if (node.slot !== 'margin' && node.slot !== 'inset') continue
    const anchor = anchorFor(i)
    const x = node.slot === 'margin' ? SPINE.marginX : SPINE.insetX
    const w = node.slot === 'margin' ? SPINE.marginW : SPINE.insetW
    const h = cardHeight(node.text, w)
    const top = Math.max(anchor?.y ?? 0, nextFree.get(node.slot) ?? 0)
    placed.set(node.id, { node, kind: 'atom', x, y: top, w, h, group: null })
    nextFree.set(node.slot, top + h + SPINE.annotationGap)
  }

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

  const edges = scene.edges.map((edge) =>
    traceEdge(edge, { kind: 'elbow', startAnchor: { x: 1, y: 0.5 }, endAnchor: { x: 1, y: 0.5 } })
  )

  return { nodes: [...placed.values()], frames, edges, axes: null }
}

/** Delta geometry — M4's furniture, reused wholesale (deltaView.ts constants). */
const DELTA = {
  cardW: 320 /* CARD_W */,
  gutter: 48 /* GUTTER */,
  frameW: 320 * 2 + 48 * 3 /* FRAME_W */,
  frameGap: 48 * 4 /* FRAME_GAP */,
  framePad: 48,
}

export const DELTA_FRAME_GROUPS = {
  received: { id: 'f-received', label: 'Received' },
  mine: { id: 'f-mine', label: 'Mine' },
} as const

/**
 * §5.2 — received vs. mine. Two fixed frames; correspondence pairs share a
 * y-band; unmatched Mine cards fill the remaining slots in order. Gaps are
 * NOT placed here: the app's own reconciler (M4, E32) mints a hole for every
 * unanswered Received card the moment the delta is opened, and placing them
 * twice would give the one state two owners.
 */
function layoutDelta(scene: Scene): SceneLayout {
  const received = scene.nodes.filter((n) => n.slot === 'received')
  const mine = scene.nodes.filter((n) => n.slot === 'mine')

  // Which Mine card answers which Received card, by scene edges (Mine → Received, E18).
  const answers = new Map<string, string>()
  for (const edge of scene.edges) {
    if (!answers.has(edge.from)) answers.set(edge.from, edge.to)
  }
  const rowOfReceived = new Map(received.map((n, i) => [n.id, i]))

  const matched: (SceneNode | null)[] = received.map(() => null)
  const unmatched: SceneNode[] = []
  for (const m of mine) {
    const target = answers.get(m.id)
    const row = target !== undefined ? rowOfReceived.get(target) : undefined
    if (row !== undefined && matched[row] === null) matched[row] = m
    else unmatched.push(m)
  }
  // §5.2: unmatched items fill the remaining slots in order — empty bands
  // first, then below. The hole and the ※ carry the truth of who answers whom;
  // the fill is just density.
  for (let i = 0; i < matched.length && unmatched.length > 0; i++) {
    if (matched[i] === null) matched[i] = unmatched.shift()!
  }
  const mineRows: (SceneNode | null)[] = [...matched, ...unmatched]
  const rows = Math.max(received.length, mineRows.length)

  // One card per band per side; the band's height is its tallest card.
  const heights: number[] = []
  for (let i = 0; i < rows; i++) {
    const r = received[i] ? cardHeight(received[i].text, DELTA.cardW) : 0
    const m = mineRows[i] ? cardHeight(mineRows[i]!.text, DELTA.cardW) : 0
    heights.push(Math.max(r, m, 1))
  }

  const bandY: number[] = []
  let y = DELTA.framePad
  for (let i = 0; i < rows; i++) {
    bandY.push(y)
    y += heights[i] + DELTA.gutter
  }
  const frameH = y - DELTA.gutter + DELTA.framePad

  const frames: PlacedFrame[] = [
    { group: { ...DELTA_FRAME_GROUPS.received, nodes: [] }, x: 0, y: 0, w: DELTA.frameW, h: frameH },
    { group: { ...DELTA_FRAME_GROUPS.mine, nodes: [] }, x: DELTA.frameW + DELTA.frameGap, y: 0, w: DELTA.frameW, h: frameH },
  ]

  const cardX = (DELTA.frameW - DELTA.cardW) / 2
  const nodes: PlacedNode[] = []
  received.forEach((node, i) => {
    nodes.push({
      node,
      kind: 'atom',
      x: cardX,
      y: bandY[i],
      w: DELTA.cardW,
      h: cardHeight(node.text, DELTA.cardW),
      group: DELTA_FRAME_GROUPS.received.id,
    })
  })
  mineRows.forEach((node, i) => {
    if (!node) return
    nodes.push({
      node,
      kind: 'atom',
      x: DELTA.frameW + DELTA.frameGap + cardX,
      y: bandY[i],
      w: DELTA.cardW,
      h: cardHeight(node.text, DELTA.cardW),
      group: DELTA_FRAME_GROUPS.mine.id,
    })
  })

  const edges = scene.edges.map((edge) => traceEdge(edge, { relation: 'correspondence' }))

  return { nodes, frames, edges, axes: null }
}

/** Field geometry, §5.3. */
const FIELD = {
  cardW: 260,
  cellGapX: 51 /* pitch 311 */,
  cellGapY: 48 /* --s-7 */,
  margin: 96 /* --s-9, axes overshoot past the outer cards */,
  nudge: 24 /* --s-5, tie separation */,
}

/**
 * §5.3 — the positioning map. Ordinal ranks onto a grid; ties resolved by
 * nudging along the less-loaded axis; axes drawn once, over the whole extent.
 * y rank 1 is the LOW pole, which sits at the bottom — the canvas y-axis grows
 * downward, so the row order inverts here and nowhere else.
 */
function layoutField(scene: Scene): SceneLayout {
  const items = scene.nodes
  const maxRx = Math.max(...items.map((n) => n.rank!.x))
  const maxRy = Math.max(...items.map((n) => n.rank!.y))

  const heights = new Map(items.map((n) => [n.id, cardHeight(n.text, FIELD.cardW)]))

  // Ties share a cell and stack whole cards along the less-loaded axis (§5.3),
  // so the grid's pitch has to make room for the deepest stack in each rank —
  // half-card nudges read as ties but land as overlaps, which lint refuses.
  const loadX = new Map<number, number>()
  const loadY = new Map<number, number>()
  for (const n of items) {
    loadX.set(n.rank!.x, (loadX.get(n.rank!.x) ?? 0) + 1)
    loadY.set(n.rank!.y, (loadY.get(n.rank!.y) ?? 0) + 1)
  }

  const cells = new Map<string, SceneNode[]>()
  for (const n of items) {
    const key = `${n.rank!.x}:${n.rank!.y}`
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key)!.push(n)
  }
  const stackAxis = (rx: number, ry: number): 'x' | 'y' =>
    (loadX.get(rx) ?? 0) <= (loadY.get(ry) ?? 0) ? 'x' : 'y'

  const colW = new Map<number, number>()
  const rowH = new Map<number, number>()
  for (const [key, members] of cells) {
    const [rx, ry] = key.split(':').map(Number)
    const along = stackAxis(rx, ry)
    const wNeed = along === 'x' ? members.length * FIELD.cardW + (members.length - 1) * FIELD.nudge : FIELD.cardW
    const hOf = (n: SceneNode) => heights.get(n.id)!
    const hNeed =
      along === 'y'
        ? members.reduce((acc, n) => acc + hOf(n), 0) + (members.length - 1) * FIELD.nudge
        : Math.max(...members.map(hOf))
    colW.set(rx, Math.max(colW.get(rx) ?? FIELD.cardW, wNeed))
    rowH.set(ry, Math.max(rowH.get(ry) ?? 0, hNeed))
  }

  const colX = new Map<number, number>()
  let cx = 0
  for (let rx = 1; rx <= maxRx; rx++) {
    colX.set(rx, cx)
    cx += (colW.get(rx) ?? FIELD.cardW) + FIELD.cellGapX
  }
  // y rank 1 is the LOW pole and sits at the bottom: canvas y grows downward,
  // so rows lay out from the highest rank first.
  const rowY = new Map<number, number>()
  let cy = 0
  for (let ry = maxRy; ry >= 1; ry--) {
    rowY.set(ry, cy)
    cy += (rowH.get(ry) ?? 0) + FIELD.cellGapY
  }

  const nodes: PlacedNode[] = []
  for (const [key, members] of cells) {
    const [rx, ry] = key.split(':').map(Number)
    const along = stackAxis(rx, ry)
    let x = colX.get(rx)!
    let y = rowY.get(ry)!
    for (const node of members) {
      const h = heights.get(node.id)!
      nodes.push({ node, kind: 'atom', x, y, w: FIELD.cardW, h, group: null })
      if (along === 'x') x += FIELD.cardW + FIELD.nudge
      else y += h + FIELD.nudge
    }
  }

  const minX = Math.min(...nodes.map((n) => n.x)) - FIELD.margin
  const maxX = Math.max(...nodes.map((n) => n.x + n.w)) + FIELD.margin
  const minY = Math.min(...nodes.map((n) => n.y)) - FIELD.margin
  const maxY = Math.max(...nodes.map((n) => n.y + n.h)) + FIELD.margin

  const axes: PlacedAxes = {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    xLow: 'concrete',
    xHigh: 'abstract',
    yLow: scene.axes!.yLow,
    yHigh: scene.axes!.yHigh,
  }

  return { nodes, frames: [], edges: [], axes }
}

/**
 * Longest-path layering over the acyclic edge set. Rank 0 holds the roots.
 * Deterministic, no library (E41.8). Throws on a cycle — in a mechanism that
 * means an edge is missing `feedback: true`, and the message says so.
 */
function layerize(ids: string[], edges: { from: string; to: string }[], cycleHint: string): Map<string, number> {
  const rank = new Map<string, number>()
  const out = new Map<string, string[]>()
  const indegree = new Map<string, number>()
  for (const id of ids) {
    out.set(id, [])
    indegree.set(id, 0)
  }
  for (const e of edges) {
    out.get(e.from)!.push(e.to)
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1)
  }
  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0)
  for (const id of queue) rank.set(id, 0)
  let head = 0
  while (head < queue.length) {
    const id = queue[head++]
    for (const next of out.get(id)!) {
      rank.set(next, Math.max(rank.get(next) ?? 0, rank.get(id)! + 1))
      indegree.set(next, indegree.get(next)! - 1)
      if (indegree.get(next) === 0) queue.push(next)
    }
  }
  if (queue.length < ids.length) throw new Error(cycleHint)
  return rank
}

/** Genealogy geometry, §5.4. */
const GENEALOGY = {
  atomW: 320,
  citeW: 260,
  gapX: 64 /* --s-8 */,
  gapY: 96 /* --s-9 between generations */,
}

/**
 * §5.4 — where it came from. A DAG, sources at the top, synthesis at the
 * bottom; rank by longest path from the roots; each generation centered.
 */
function layoutGenealogy(scene: Scene): SceneLayout {
  const rank = layerize(
    scene.nodes.map((n) => n.id),
    scene.edges,
    'genealogy edges form a cycle — provenance flows one way'
  )

  // Sources own the top row. An atom with no incoming edge is still Jordan's
  // thinking, not a source — it starts at the first generation below them,
  // where its edges stay short instead of lancing through the middle rows.
  const hasSources = scene.nodes.some((n) => n.source !== null)
  const generations = new Map<number, SceneNode[]>()
  for (const node of scene.nodes) {
    let r = rank.get(node.id) ?? 0
    if (hasSources && node.source === null) r = Math.max(r, 1)
    if (!generations.has(r)) generations.set(r, [])
    generations.get(r)!.push(node)
  }

  const sizeOf = (n: SceneNode) =>
    n.source !== null
      ? { kind: 'cite' as const, w: GENEALOGY.citeW, h: citeHeight(n.text, GENEALOGY.citeW) }
      : { kind: 'atom' as const, w: GENEALOGY.atomW, h: cardHeight(n.text, GENEALOGY.atomW) }

  const nodes: PlacedNode[] = []
  let y = 0
  for (const r of [...generations.keys()].sort((a, b) => a - b)) {
    const row = generations.get(r)!
    const sizes = row.map(sizeOf)
    const totalW = sizes.reduce((acc, s) => acc + s.w, 0) + (row.length - 1) * GENEALOGY.gapX
    let x = -totalW / 2
    let rowH = 0
    row.forEach((node, i) => {
      const s = sizes[i]
      nodes.push({ node, kind: s.kind, x, y, w: s.w, h: s.h, group: null })
      x += s.w + GENEALOGY.gapX
      rowH = Math.max(rowH, s.h)
    })
    y += rowH + GENEALOGY.gapY
  }

  const edges = scene.edges.map((edge) =>
    traceEdge(edge, { startAnchor: { x: 0.5, y: 1 }, endAnchor: { x: 0.5, y: 0 } })
  )

  return { nodes, frames: [], edges, axes: null }
}

/** Mechanism geometry, §5.5. */
const MECHANISM = {
  cardW: 320,
  gapX: 96 /* --s-9 between stages */,
  gapY: 48 /* --s-7 within a stage */,
  returnClear: 80 /* how far below the main line a feedback return swings */,
}

/**
 * §5.5 — how the thing works. Rank left-to-right on the forward edges;
 * feedback edges route as curved returns below the main line — bottom-anchored
 * arcs with a bend deep enough to clear the tallest card they pass under.
 */
function layoutMechanism(scene: Scene): SceneLayout {
  const forward = scene.edges.filter((e) => !e.feedback)
  const rank = layerize(
    scene.nodes.map((n) => n.id),
    forward,
    'mechanism forward edges form a cycle — mark the return edge feedback: true'
  )

  const stages = new Map<number, SceneNode[]>()
  for (const node of scene.nodes) {
    const r = rank.get(node.id) ?? 0
    if (!stages.has(r)) stages.set(r, [])
    stages.get(r)!.push(node)
  }

  const heights = new Map(scene.nodes.map((n) => [n.id, cardHeight(n.text, MECHANISM.cardW)]))
  const placed = new Map<string, PlacedNode>()
  for (const r of [...stages.keys()].sort((a, b) => a - b)) {
    const stage = stages.get(r)!
    const totalH = stage.reduce((acc, n) => acc + heights.get(n.id)!, 0) + (stage.length - 1) * MECHANISM.gapY
    let y = -totalH / 2
    for (const node of stage) {
      placed.set(node.id, {
        node,
        kind: 'atom',
        x: r * (MECHANISM.cardW + MECHANISM.gapX),
        y,
        w: MECHANISM.cardW,
        h: heights.get(node.id)!,
        group: null,
      })
      y += heights.get(node.id)! + MECHANISM.gapY
    }
  }

  const maxBottom = Math.max(...[...placed.values()].map((p) => p.y + p.h))

  const edges = scene.edges.map((edge) => {
    if (!edge.feedback) {
      return traceEdge(edge, { startAnchor: { x: 1, y: 0.5 }, endAnchor: { x: 0, y: 0.5 } })
    }
    // The return: out of the source's bottom, back into the target's bottom,
    // bowed far enough below the deepest card in between that the curve never
    // crosses the main line. Sign verified against the running app: the return
    // travels right-to-left, and a NEGATIVE bend is what swings it downward —
    // positive bowed it up through the diagram (check-layout guards this).
    const from = placed.get(edge.from)!
    const to = placed.get(edge.to)!
    const clearance = maxBottom - Math.min(from.y + from.h, to.y + to.h) + MECHANISM.returnClear
    return traceEdge(edge, {
      bend: -clearance,
      dash: 'dashed',
      startAnchor: { x: 0.5, y: 1 },
      endAnchor: { x: 0.5, y: 1 },
    })
  })

  return { nodes: [...placed.values()], frames: [], edges, axes: null }
}

export function layoutScene(scene: Scene): SceneLayout {
  switch (scene.form) {
    case 'spine':
      return layoutSpine(scene)
    case 'delta':
      return layoutDelta(scene)
    case 'field':
      return layoutField(scene)
    case 'genealogy':
      return layoutGenealogy(scene)
    case 'mechanism':
      return layoutMechanism(scene)
    case 'band':
      // The band emits corpus/<slug>.assembly.json, not shapes (E41.10);
      // the compile edge handles it before layout is ever asked.
      throw new Error('band scenes do not lay out — they compile to a corpus assembly')
  }
}
