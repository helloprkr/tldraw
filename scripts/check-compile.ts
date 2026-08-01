/**
 * Assertions over the scene compiler (M6.2). Drives the pure compile against
 * the committed test-trace fixture and proves the four §6.3 rules mechanically:
 * ids are derived, positions survive recompiles, the library mints ids and
 * indices, and the schema block is byte-identical to what the app itself saves.
 *
 * The M6.2 gate lives in the `preserve` section: compile, move cards the way a
 * hand would, compile twice more — the arrangement survives both.
 *
 * Run: npx tsx scripts/check-compile.ts
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTrace } from '../src/trace-types.ts'
import { parseScene, validateScene } from '../src/scene-types.ts'
import { layoutScene } from '../src/lib/sceneLayout.ts'
import { compileScenes, fnv1a } from '../src/lib/sceneCompile.ts'
import type { CompiledScene } from '../src/lib/sceneCompile.ts'
import type { StoreDocument, TldrRecord } from '../src/readout-types.ts'
import { loadDeps } from './compile-deps.ts'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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

const SLUG = 'test-trace'
const SCENE = '01-spine'

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, rel), 'utf8')) as T
}

const deps = await loadDeps()
const { trace } = parseTrace(readJson('out/test-trace/trace.json'))
if (!trace) throw new Error('fixture trace failed to parse')
const { scene } = parseScene(readJson('scenes/test-trace/01-spine.scene.json'))
if (!scene) throw new Error('fixture scene failed to parse')

const scenes = (): CompiledScene[] => [{ name: SCENE, scene, layout: layoutScene(scene) }]
const compile = (existing: StoreDocument | null) =>
  compileScenes(SLUG, scenes(), existing, trace.generated.slice(0, 10), deps)

const shapeIdOf = (nodeId: string) => deps.shapeId(fnv1a(`${SLUG}:${SCENE}:${nodeId}`))

section('validate')
{
  check('fixture scene validates against fixture trace', validateScene(scene, trace), [])
  const smuggled = parseScene({ ...readJson<object>('scenes/test-trace/01-spine.scene.json'), x: 100 })
  check('a coordinate field is refused at the scene root', smuggled.issues.some((i) => i.code === 'coordinate'), true)
  const badNode = readJson<{ nodes: Record<string, unknown>[] }>('scenes/test-trace/01-spine.scene.json')
  badNode.nodes[0].y = 40
  check('a coordinate field is refused on a node', parseScene(badNode).issues.some((i) => i.code === 'coordinate'), true)
  const invented = { ...scene, nodes: [...scene.nodes, { ...scene.nodes[0], id: 'n-x', unit: 'u-99' }] }
  check('a node with an invented unit is refused (§9.3)', validateScene(invented, trace).some((i) => i.code === 'unit'), true)
}

section('deterministic ids')
{
  const first = compile(null)
  const again = compile(null)
  check('two fresh compiles are byte-identical', JSON.stringify(first.document), JSON.stringify(again.document))
  check('a node id is derived, not random', first.document.store[shapeIdOf('n-1')] !== undefined, true)
  check('recompiling over the result is a no-op', JSON.stringify(compile(first.document).document), JSON.stringify(first.document))
  check(
    'schema block is byte-identical to an app-saved file',
    JSON.stringify(first.document.schema),
    JSON.stringify(readJson<{ schema: unknown }>('work/test-essay.tldr').schema)
  )
}

section('preserve — the M6.2 gate')
{
  const fresh = compile(null).document

  // A hand moves three things: a card inside a frame, a margin card on the
  // page, and a whole frame. One card is also resized.
  const moved = JSON.parse(JSON.stringify(fresh)) as StoreDocument
  const cardId = shapeIdOf('n-2')
  const marginId = shapeIdOf('n-5')
  const frameId = shapeIdOf('g-2')
  const card = moved.store[cardId]
  const margin = moved.store[marginId]
  const frame = moved.store[frameId]
  card.x = 137.5
  card.y = 421.25
  ;(card.props as Record<string, unknown>).w = 460
  ;(card.props as Record<string, unknown>).h = 180
  margin.x = -555
  margin.y = 88
  frame.x = 900
  frame.y = -60

  const once = compile(moved).document
  const twice = compile(once).document

  check('moved card keeps x after recompile', once.store[cardId].x, 137.5)
  check('moved card keeps y after recompile', once.store[cardId].y, 421.25)
  check('resized card keeps w (text unchanged)', (once.store[cardId].props as Record<string, unknown>).w, 460)
  check('resized card keeps h (text unchanged)', (once.store[cardId].props as Record<string, unknown>).h, 180)
  check('page-level margin card keeps its spot', [once.store[marginId].x, once.store[marginId].y], [-555, 88])
  check('a dragged frame keeps its spot', [once.store[frameId].x, once.store[frameId].y], [900, -60])
  check('compiling twice changes nothing', JSON.stringify(twice), JSON.stringify(once))
  check('report says preserved, not created', compile(moved).report[0].created, 0)
}

section('scene edits land as diffs')
{
  const base = compile(null).document
  const cardId = shapeIdOf('n-2')
  const before = base.store[cardId]

  // Jordan moves the card; then the scene's text for that node changes.
  const moved = JSON.parse(JSON.stringify(base)) as StoreDocument
  moved.store[cardId].x = 999

  const edited = JSON.parse(JSON.stringify(scene)) as typeof scene
  edited.nodes = edited.nodes.map((n) =>
    n.id === 'n-2' ? { ...n, text: `${n.text} And this sentence makes the card need one more line than before.` } : n
  )
  const editedScenes: CompiledScene[] = [{ name: SCENE, scene: edited, layout: layoutScene(edited) }]
  const out = compileScenes(SLUG, editedScenes, moved, trace.generated.slice(0, 10), deps).document

  check('edited text: position still survives', out.store[cardId].x, 999)
  check(
    'edited text: height is recomputed',
    (out.store[cardId].props as Record<string, unknown>).h !== (before.props as Record<string, unknown>).h,
    true
  )

  // A node leaves the scene: its records go; nothing else moves.
  const cut = JSON.parse(JSON.stringify(scene)) as typeof scene
  cut.nodes = cut.nodes.filter((n) => n.id !== 'n-4')
  const cutScenes: CompiledScene[] = [{ name: SCENE, scene: cut, layout: layoutScene(cut) }]
  const cutOut = compileScenes(SLUG, cutScenes, moved, trace.generated.slice(0, 10), deps).document
  check('a cut node takes its shape with it', cutOut.store[shapeIdOf('n-4')], undefined)
  check('a cut node leaves the others alone', cutOut.store[cardId].x, 999)

  // A hand-placed shape on the generated page is invisible to the compiler.
  const withHand = JSON.parse(JSON.stringify(base)) as StoreDocument
  const pageId = Object.values(withHand.store).find((r) => r.typeName === 'page')!.id
  withHand.store['shape:hand-made'] = {
    x: 5,
    y: 5,
    rotation: 0,
    isLocked: false,
    opacity: 1,
    meta: {},
    id: 'shape:hand-made',
    type: 'atom',
    props: { w: 320, h: 200, atom: 'untyped', text: 'mine', sourceId: 'hand-1', created: '2026-07-31', ordinal: 99 },
    parentId: pageId,
    index: 'a9',
    typeName: 'shape',
  } as unknown as TldrRecord
  const handOut = compileScenes(SLUG, scenes(), withHand, trace.generated.slice(0, 10), deps).document
  check("Jordan's hand-placed shape passes through untouched", handOut.store['shape:hand-made'].x, 5)
}

console.log(failures === 0 ? '\nALL CHECKS PASS' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
