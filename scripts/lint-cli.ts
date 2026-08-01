/**
 * `npm run lint -- <slug>` (M6_GENERATIVE.md §7).
 *
 * Lints work/<slug>.tldr as it stands — compiled layout plus whatever hands
 * have moved — against the scenes and the trace. Text findings with node ids,
 * so /draw can fix and recompile without seeing anything. Exit 1 on any
 * finding: lint is a gate on export, not a warning.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTrace } from '../src/trace-types.ts'
import { parseScene } from '../src/scene-types.ts'
import type { Scene } from '../src/scene-types.ts'
import { lintScenes } from '../src/lib/sceneLint.ts'
import type { StoreDocument } from '../src/readout-types.ts'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function die(message: string): never {
  console.error(message)
  process.exit(1)
}

async function main(): Promise<void> {
  const slug = process.argv.slice(2).find((a) => !a.startsWith('-'))
  if (!slug) die('usage: npm run lint -- <slug>')

  let doc: StoreDocument
  try {
    doc = JSON.parse(await readFile(path.join(REPO_ROOT, 'work', `${slug}.tldr`), 'utf8')) as StoreDocument
  } catch {
    die(`no work/${slug}.tldr — run npm run compile -- ${slug} first`)
  }

  const { trace } = parseTrace(JSON.parse(await readFile(path.join(REPO_ROOT, 'out', slug, 'trace.json'), 'utf8')))
  if (!trace) die(`out/${slug}/trace.json failed to parse`)

  const files = new Map<string, string>()
  for (const entry of await readdir(path.join(REPO_ROOT, 'context', slug), { withFileTypes: true })) {
    if (entry.isFile() && !entry.name.startsWith('.')) {
      files.set(`context/${slug}/${entry.name}`, await readFile(path.join(REPO_ROOT, 'context', slug, entry.name), 'utf8'))
    }
  }

  const scenesDir = path.join(REPO_ROOT, 'scenes', slug)
  const scenes: { name: string; scene: Scene }[] = []
  for (const fileName of (await readdir(scenesDir)).filter((n) => n.endsWith('.scene.json')).sort()) {
    const { scene } = parseScene(JSON.parse(await readFile(path.join(scenesDir, fileName), 'utf8')))
    if (scene && scene.form !== 'band') scenes.push({ name: fileName.replace(/\.scene\.json$/, ''), scene })
  }

  const findings = lintScenes(doc, scenes, trace, files)
  for (const f of findings) {
    console.log(`FAIL  ${f.check.padEnd(11)} ${f.where}  [${f.at.join(', ')}]  ${f.message}`)
  }
  console.log(findings.length === 0 ? `LINT CLEAN — ${scenes.length} scene(s)` : `\nLINT FAILED: ${findings.length} finding(s)`)
  process.exit(findings.length === 0 ? 0 : 1)
}

await main()
