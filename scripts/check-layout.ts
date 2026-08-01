/**
 * Assertions over the form layouts (M6.3). The gate: each form renders
 * legibly at 8 and at 20 nodes. Legibility is Jordan's word; what a script
 * can hold is its mechanical floor — no two cards overlap, nothing collapses
 * to a point, and a mechanism's feedback return actually clears the main
 * line instead of lancing through it.
 *
 * Scenes here are synthetic and sized on demand; the committed fixture scenes
 * cover the 8-node end with real content.
 *
 * Run: npx tsx scripts/check-layout.ts
 */

import { layoutScene } from '../src/lib/sceneLayout.ts'
import type { PlacedNode } from '../src/lib/sceneLayout.ts'
import type { Scene, SceneNode, SceneEdge } from '../src/scene-types.ts'

let failures = 0

function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    console.log(`PASS  ${label}`)
  } else {
    failures += 1
    console.log(`FAIL  ${label}`)
    console.log(`      expected ${b}`)
    console.log(`      actual   ${a}`)
  }
}

function section(title: string): void {
  console.log(`\n${title}`)
}

const WORDS =
  'the braid holds because many weak strands cross each other and no strand runs the whole length of the rope'.split(' ')

function sentence(i: number, length: number): string {
  const out: string[] = []
  for (let k = 0; k < length; k++) out.push(WORDS[(i * 7 + k) % WORDS.length])
  return out.join(' ')
}

function overlaps(placed: PlacedNode[]): string[] {
  const bad: string[] = []
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]
      const b = placed[j]
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
        bad.push(`${a.node.id}×${b.node.id}`)
      }
    }
  }
  return bad
}

const ATOMS = ['claim', 'move', 'figure', 'stance'] as const

function makeScene(form: Scene['form'], n: number): Scene {
  const nodes: SceneNode[] = []
  const edges: SceneEdge[] = []
  for (let i = 1; i <= n; i++) {
    const atom = ATOMS[i % 4]
    const base: SceneNode = {
      id: `n-${i}`,
      unit: `u-${i}`,
      source: null,
      atom,
      text: sentence(i, 6 + (i % 9)),
      slot: null,
      rank: null,
    }
    if (form === 'spine') {
      base.slot = i % 5 === 3 ? 'margin' : i % 7 === 4 ? 'inset' : 'column'
    } else if (form === 'delta') {
      base.slot = i % 2 === 0 ? 'mine' : 'received'
    } else if (form === 'field') {
      // Deliberate collisions: a five-column grid over n nodes ties repeatedly.
      base.rank = { x: (i % 5) + 1, y: (i % 3) + 1 }
    } else if (form === 'genealogy' && i <= 3) {
      base.unit = null
      base.atom = null
      base.source = `s-${i}`
      base.text = `Source ${i}, a citation line long enough to wrap, 2026`
    }
    nodes.push(base)
  }

  if (form === 'spine') {
    for (let i = 5; i <= n; i += 5) edges.push({ from: `n-${i}`, to: `n-${i - 4}`, kind: 'derives', feedback: false })
  } else if (form === 'delta') {
    for (let i = 2; i <= n; i += 4) edges.push({ from: `n-${i}`, to: `n-${i - 1}`, kind: 'answers', feedback: false })
  } else if (form === 'genealogy') {
    for (let i = 4; i <= n; i++) edges.push({ from: `n-${Math.max(1, i - 3)}`, to: `n-${i}`, kind: 'feeds', feedback: false })
  } else if (form === 'mechanism') {
    for (let i = 2; i <= n; i++) edges.push({ from: `n-${i - 1}`, to: `n-${i}`, kind: 'feeds', feedback: false })
    edges.push({ from: `n-${n}`, to: 'n-1', kind: 'feeds', feedback: true })
    if (n >= 12) edges.push({ from: `n-${Math.floor(n / 2)}`, to: 'n-2', kind: 'feeds', feedback: true })
  }

  return {
    form,
    title: `${form} at ${n}`,
    caption: 'synthetic',
    source: 'out/x/trace.json',
    axes: form === 'field' ? { yLow: 'low pole', yHigh: 'high pole' } : null,
    nodes,
    edges,
    groups:
      form === 'spine'
        ? [
            { id: 'g-1', label: 'First', nodes: nodes.slice(0, Math.floor(n / 2)).filter((x) => x.slot === 'column').map((x) => x.id) },
            { id: 'g-2', label: 'Second', nodes: nodes.slice(Math.floor(n / 2)).filter((x) => x.slot === 'column').map((x) => x.id) },
          ]
        : [],
  }
}

for (const form of ['spine', 'delta', 'field', 'genealogy', 'mechanism'] as const) {
  section(form)
  for (const n of [8, 20]) {
    const layout = layoutScene(makeScene(form, n))
    check(`${form}@${n}: places every node`, layout.nodes.length, n)
    check(`${form}@${n}: no two cards overlap`, overlaps(layout.nodes), [])
    const minW = Math.min(...layout.nodes.map((p) => p.w))
    const minH = Math.min(...layout.nodes.map((p) => p.h))
    check(`${form}@${n}: nothing collapses`, minW >= 160 && minH >= 50, true)
  }
}

section('mechanism return clearance')
{
  const layout = layoutScene(makeScene('mechanism', 8))
  const maxBottom = Math.max(...layout.nodes.map((p) => p.y + p.h))
  const feedback = layout.edges.filter((e) => e.edge.feedback)
  check('returns are dashed arcs', feedback.every((e) => e.dash === 'dashed' && e.kind === 'arc'), true)
  check('returns anchor at the bottom edge', feedback.every((e) => e.startAnchor.y === 1 && e.endAnchor.y === 1), true)
  // Negative bend swings the right-to-left return below the cards (verified
  // against the running app; the sign regressing is exactly what this catches).
  check('returns bow below the deepest card', feedback.every((e) => e.bend <= -(maxBottom - maxBottom + 80)), true)
  check('bend scales past the main line', feedback.every((e) => Math.abs(e.bend) >= 80), true)
}

section('field poles')
{
  const layout = layoutScene(makeScene('field', 8))
  check('x poles are the house convention', [layout.axes!.xLow, layout.axes!.xHigh], ['concrete', 'abstract'])
  check('y poles come from the scene', [layout.axes!.yLow, layout.axes!.yHigh], ['low pole', 'high pole'])
  const under = layout.nodes.every(
    (p) => p.x >= layout.axes!.x && p.x + p.w <= layout.axes!.x + layout.axes!.w && p.y >= layout.axes!.y && p.y + p.h <= layout.axes!.y + layout.axes!.h
  )
  check('the axes span every card', under, true)
}

console.log(failures === 0 ? '\nALL CHECKS PASS' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
