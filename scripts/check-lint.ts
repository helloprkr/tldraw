/**
 * Assertions over lint (M6.4). Every check earns its place the E35 way: by
 * failing against a deliberately broken input, not merely passing a clean one.
 * The clean baseline is the committed test-trace fixture, compiled fresh.
 *
 * Run: npx tsx scripts/check-lint.ts
 */

import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTrace } from '../src/trace-types.ts'
import { parseScene } from '../src/scene-types.ts'
import type { Scene } from '../src/scene-types.ts'
import { layoutScene } from '../src/lib/sceneLayout.ts'
import { compileScenes } from '../src/lib/sceneCompile.ts'
import type { CompiledScene } from '../src/lib/sceneCompile.ts'
import { lintPageGeometry, lintScenes } from '../src/lib/sceneLint.ts'
import type { StoreDocument } from '../src/readout-types.ts'
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
const readJson = <T,>(rel: string): T => JSON.parse(readFileSync(path.join(REPO_ROOT, rel), 'utf8')) as T

const deps = await loadDeps()
const { trace } = parseTrace(readJson('out/test-trace/trace.json'))
if (!trace) throw new Error('fixture trace failed to parse')

const files = new Map<string, string>()
for (const name of readdirSync(path.join(REPO_ROOT, 'context', SLUG))) {
  files.set(`context/${SLUG}/${name}`, readFileSync(path.join(REPO_ROOT, 'context', SLUG, name), 'utf8'))
}

const scenes: { name: string; scene: Scene }[] = []
for (const fileName of readdirSync(path.join(REPO_ROOT, 'scenes', SLUG)).sort()) {
  if (!fileName.endsWith('.scene.json')) continue
  const { scene } = parseScene(readJson(`scenes/${SLUG}/${fileName}`))
  if (scene && scene.form !== 'band') scenes.push({ name: fileName.replace(/\.scene\.json$/, ''), scene })
}

const compiled: CompiledScene[] = scenes.map(({ name, scene }) => ({ name, scene, layout: layoutScene(scene) }))
const compileFresh = () => compileScenes(SLUG, compiled, null, trace.generated.slice(0, 10), deps).document

const spineCardId = (nodeId: string) => {
  const doc = compileFresh()
  const hit = Object.values(doc.store).find((r) => r.meta?.scene === '01-spine' && r.meta?.node === nodeId)
  if (!hit) throw new Error(`no compiled record for ${nodeId}`)
  return hit.id
}

section('baseline')
{
  const doc = compileFresh()
  check('a fresh compile lints clean', lintScenes(doc, scenes, trace, files), [])
}

section('overlap — the M6.4 gate')
{
  const doc = compileFresh()
  const a = doc.store[spineCardId('n-1')]
  const b = doc.store[spineCardId('n-2')]
  // The deliberate overlap: drop card n-1 onto n-2.
  a.x = b.x
  a.y = b.y
  const findings = lintScenes(doc, scenes, trace, files)
  check('a deliberately overlapping scene fails lint', findings.some((f) => f.check === 'overlap'), true)
  check('the finding names both nodes', findings.find((f) => f.check === 'overlap')?.at.sort(), ['n-1', 'n-2'])
}

section('overflow')
{
  const doc = compileFresh()
  const a = doc.store[spineCardId('n-8')]
  ;(a.props as { h: number }).h = 60
  const findings = lintPageGeometry(doc, a.parentId!.startsWith('page:') ? a.parentId! : findPage(doc, '01-spine'))
  check('a squashed generated card fails overflow', lintScenes(doc, scenes, trace, files).some((f) => f.check === 'overflow'), true)
  void findings
}

section('bounds')
{
  const doc = compileFresh()
  const a = doc.store[spineCardId('n-5')]
  a.x = 90000
  check('a flung card fails bounds', lintScenes(doc, scenes, trace, files).some((f) => f.check === 'bounds'), true)
}

section('untyped')
{
  const doc = compileFresh()
  const a = doc.store[spineCardId('n-3')]
  ;(a.props as { atom: string }).atom = 'untyped'
  check('a generated card without a type fails untyped', lintScenes(doc, scenes, trace, files).some((f) => f.check === 'untyped'), true)
}

section('orphan-gap')
{
  const doc = compileFresh()
  const pageId = findPage(doc, '02-delta')
  doc.store['shape:lint-gap'] = {
    x: 10,
    y: 10,
    rotation: 0,
    isLocked: false,
    opacity: 1,
    meta: {},
    id: 'shape:lint-gap',
    type: 'gap',
    props: { w: 320, h: 200, label: 'UNANSWERED', facingId: 'shape:no-such-card', sourceId: 'g-x' },
    parentId: pageId,
    index: 'a9',
    typeName: 'shape',
  } as never
  check('a gap facing nothing fails orphan-gap', lintScenes(doc, scenes, trace, files).some((f) => f.check === 'orphan-gap'), true)
}

section('collision')
{
  const doc = compileFresh()
  const arrow = Object.values(doc.store).find((r) => r.type === 'arrow' && r.meta?.scene === '01-spine')!
  ;(arrow.props as { richText: unknown }).richText = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'surprise label' }] }],
  }
  check('an arrow label fails collision while labels are unrendered', lintScenes(doc, scenes, trace, files).some((f) => f.check === 'collision'), true)
}

section('orphan')
{
  const broken = scenes.map((s) =>
    s.name === '05-genealogy'
      ? {
          ...s,
          scene: {
            ...s.scene,
            nodes: [
              ...s.scene.nodes,
              { id: 'n-lonely', unit: 'u-3', source: null, atom: 'claim' as const, text: 'unconnected', slot: null, rank: null },
            ],
          },
        }
      : s
  )
  const compiledBroken: CompiledScene[] = broken.map(({ name, scene }) => ({ name, scene, layout: layoutScene(scene) }))
  const doc = compileScenes(SLUG, compiledBroken, null, trace.generated.slice(0, 10), deps).document
  check('an unconnected genealogy node fails orphan', lintScenes(doc, broken, trace, files).some((f) => f.check === 'orphan'), true)
}

section('unfounded')
{
  const movedFiles = new Map(files)
  movedFiles.set(`context/${SLUG}/essay.md`, `PREFACE.\n\n${files.get(`context/${SLUG}/essay.md`)!}`)
  const doc = compileFresh()
  check('a moved pile fails unfounded at the last gate', lintScenes(doc, scenes, trace, movedFiles).some((f) => f.check === 'unfounded'), true)
}

section('crossings')
{
  // A dense synthetic mechanism whose chords braid: every edge jumps two
  // ranks and alternates sides, so chords cross repeatedly.
  const n = 12
  const nodes = Array.from({ length: n }, (_, k) => ({
    id: `n-${k + 1}`,
    unit: `u-${(k % 8) + 1}`,
    source: null,
    atom: 'claim' as const,
    text: `node ${k + 1}`,
    slot: null,
    rank: null,
  }))
  const edges = []
  for (let k = 1; k <= n - 2; k++) {
    edges.push({ from: `n-${k}`, to: `n-${k + 2}`, kind: 'feeds' as const, feedback: false })
    if (k <= n - 3) edges.push({ from: `n-${k}`, to: `n-${k + 3}`, kind: 'feeds' as const, feedback: false })
  }
  const scene: Scene = {
    form: 'mechanism',
    title: 'tangle',
    caption: 'tangle',
    source: 'out/test-trace/trace.json',
    axes: null,
    nodes,
    edges,
    groups: [],
  }
  const tangle = [{ name: '09-tangle', scene }]
  const doc = compileScenes(
    SLUG,
    [{ name: '09-tangle', scene, layout: layoutScene(scene) }],
    null,
    trace.generated.slice(0, 10),
    deps
  ).document
  check('a braided mechanism fails crossings', lintScenes(doc, tangle, trace, files).some((f) => f.check === 'crossings'), true)
}

function findPage(doc: StoreDocument, sceneName: string): string {
  const page = Object.values(doc.store).find((r) => r.typeName === 'page' && r.meta?.scene === sceneName)
  if (!page) throw new Error(`no page for ${sceneName}`)
  return page.id
}

console.log(failures === 0 ? '\nALL CHECKS PASS' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
