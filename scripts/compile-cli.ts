/**
 * `npm run compile -- <slug>` (M6_GENERATIVE.md §6.3).
 *
 * scenes/<slug>/*.scene.json + out/<slug>/trace.json → work/<slug>.tldr.
 *
 * The review gate lives here and is mechanical (§9.2): while
 * `trace.json.reviewed` is false this exits naming the file, and there is no
 * flag to skip it. Nothing reaches a canvas that Jordan has not read.
 *
 * Layout and record-building are pure (`sceneLayout.ts`, `sceneCompile.ts`);
 * this edge reads disks, mints ids with the library's own helpers, and writes
 * through the house serializer. The tldraw packages arrive through computed
 * specifiers because tsconfig.scripts.json compiles without the DOM lib
 * (same posture as check-tickets.ts).
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTrace, validateTrace, checkSpans } from '../src/trace-types.ts'
import { parseScene, validateScene } from '../src/scene-types.ts'
import type { Scene } from '../src/scene-types.ts'
import { layoutScene } from '../src/lib/sceneLayout.ts'
import { compileScenes } from '../src/lib/sceneCompile.ts'
import type { CompiledScene } from '../src/lib/sceneCompile.ts'
import { serializeJson } from '../src/lib/serialize.ts'
import { loadDeps } from './compile-deps.ts'
import type { StoreDocument } from '../src/readout-types.ts'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function die(message: string): never {
  console.error(message)
  process.exit(1)
}

async function main(): Promise<void> {
  const slug = process.argv.slice(2).find((a) => !a.startsWith('-'))
  if (!slug) die('usage: npm run compile -- <slug>')

  // ── The gate. §9.2: mechanical, no skip flag, none should be added. ──
  const tracePath = path.join(REPO_ROOT, 'out', slug, 'trace.json')
  let traceRaw: string
  try {
    traceRaw = await readFile(tracePath, 'utf8')
  } catch {
    die(`no out/${slug}/trace.json — run /trace first`)
  }
  const { trace, issues: parseIssues } = parseTrace(JSON.parse(traceRaw))
  if (!trace) {
    for (const i of parseIssues) console.error(`${i.code}: ${i.message}`)
    process.exit(1)
  }
  if (trace.reviewed !== true) {
    die(
      `REVIEW GATE: out/${slug}/trace.json has reviewed: false.\n` +
        `Jordan reads the trace, corrects it, and sets reviewed to true by hand.\n` +
        `Nothing reaches a canvas he has not read (M6_GENERATIVE.md §9).`
    )
  }

  // A reviewed trace must still be founded: offsets that no longer reproduce
  // their quotes mean the pile moved after the review.
  const contextDir = path.join(REPO_ROOT, 'context', slug)
  const files = new Map<string, string>()
  try {
    for (const entry of await readdir(contextDir, { withFileTypes: true })) {
      if (entry.isFile() && !entry.name.startsWith('.')) {
        files.set(`context/${slug}/${entry.name}`, await readFile(path.join(contextDir, entry.name), 'utf8'))
      }
    }
  } catch {
    die(`no context/${slug}/ — the trace's pile is gone`)
  }
  const traceIssues = [...validateTrace(trace), ...checkSpans(trace, files)]
  const traceErrors = traceIssues.filter((i) => i.level === 'error')
  if (traceErrors.length > 0) {
    for (const i of traceErrors) console.error(`${i.code} ${i.at ?? ''}: ${i.message}`)
    die(`trace failed validation — fix it (or re-run npm run trace -- --resolve ${slug}) before compiling`)
  }

  // ── Scenes. ──
  const scenesDir = path.join(REPO_ROOT, 'scenes', slug)
  let sceneNames: string[]
  try {
    sceneNames = (await readdir(scenesDir)).filter((n) => n.endsWith('.scene.json')).sort()
  } catch {
    die(`no scenes/${slug}/ — run /draw first`)
  }
  if (sceneNames.length === 0) {
    // §14: when a form doesn't fit, the correct output is no diagram. But an
    // empty directory that was asked to compile is more likely a mistake.
    die(`scenes/${slug}/ has no *.scene.json — an empty scene set compiles to nothing`)
  }

  const compiled: CompiledScene[] = []
  let sceneErrors = 0
  for (const fileName of sceneNames) {
    const name = fileName.replace(/\.scene\.json$/, '')
    const raw = JSON.parse(await readFile(path.join(scenesDir, fileName), 'utf8')) as unknown
    const { scene, issues } = parseScene(raw)
    const all = [...issues, ...(scene ? validateScene(scene, trace) : [])]
    for (const i of all) {
      if (i.level === 'error') sceneErrors += 1
      console.log(`${fileName}  ${i.level.toUpperCase()} ${i.code} ${i.at ?? ''}: ${i.message}`)
    }
    if (!scene || all.some((i) => i.level === 'error')) continue
    compiled.push({ name, scene: scene as Scene, layout: layoutScene(scene) })
  }
  if (sceneErrors > 0) die(`${sceneErrors} scene error(s) — nothing compiled`)

  // ── Compile, preserving whatever Jordan has arranged. ──
  const workPath = path.join(REPO_ROOT, 'work', `${slug}.tldr`)
  let existing: StoreDocument | null = null
  try {
    existing = JSON.parse(await readFile(workPath, 'utf8')) as StoreDocument
  } catch {
    existing = null
  }

  const deps = await loadDeps()
  const generatedDate = trace.generated.slice(0, 10)
  const { document, report } = compileScenes(slug, compiled, existing, generatedDate, deps)

  await writeFile(workPath, serializeJson(document), 'utf8')

  for (const r of report) {
    console.log(`${r.scene}: ${r.created} created, ${r.preserved} preserved, ${r.removed} removed`)
  }
  console.log(`\nwork/${slug}.tldr written (${compiled.length} scene(s))`)
  console.log(`open: http://localhost:5173/?essay=${encodeURIComponent(slug)}`)
}

await main()
