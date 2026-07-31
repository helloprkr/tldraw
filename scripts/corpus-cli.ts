/**
 * `npm run corpus -- --parse corpus/<slug>.md` (BUILD.md §8, the fresh-parse path).
 *
 * The node write edge for the corpus wall. It reads the essay, calls the pure
 * `parseEssay`, and hands the result to `serialize.ts` — the same function and
 * the same serializer the browser uses when it writes a classification back
 * through `PUT /api/corpus/:file`, which is what keeps a parsed file and a
 * round-tripped file byte-comparable rather than merely similar (supplement
 * §6.2, E8).
 *
 * §8's one prohibition lives in `parseEssay`, not here: this command never
 * guesses an atom, so every unit it writes is `"atom": null` and renders as a
 * hatched hole until somebody makes the judgment.
 */

import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assemblyFileName, parseEssay, slugFromFileName } from '../src/lib/corpus.ts'
import { serializeJson } from '../src/lib/serialize.ts'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CORPUS_DIR = path.join(REPO_ROOT, 'corpus')

const USAGE = 'Usage: npm run corpus -- --parse corpus/<slug>.md [--force]'

function die(message: string): never {
  console.error(message)
  process.exit(1)
}

interface Args {
  target: string
  force: boolean
}

function parseArgs(argv: string[]): Args {
  let target = ''
  let force = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--parse') {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) die(`--parse needs an essay path.\n\n${USAGE}`)
      target = value
      i += 1
    } else if (arg === '--force') {
      force = true
    } else if (arg.startsWith('--')) {
      die(`Unknown flag: ${arg}\n\n${USAGE}`)
    } else {
      die(`Unexpected argument: ${arg}\n\nThe essay is named by --parse.\n\n${USAGE}`)
    }
  }

  if (!target) die(USAGE)
  return { target, force }
}

/** Repo-relative, like the documented invocation, whatever directory it is run from. */
function resolveTarget(target: string): string {
  const resolved = path.resolve(REPO_ROOT, target)
  const shown = path.relative(REPO_ROOT, resolved) || target

  if (!resolved.endsWith('.md')) {
    die(
      `Not a markdown essay: ${shown}\n\nThe fresh-parse path reads corpus/<slug>.md. An analysis that already exists is read straight off disk as corpus/<slug>.assembly.json and needs no parse.`
    )
  }
  // Direct child only. `..` and a symlinked detour both fail this, and corpus/
  // is flat by §4 — a nested essay would collide on slug the moment two of them
  // shared a filename.
  if (path.dirname(resolved) !== CORPUS_DIR) {
    die(
      `Outside corpus/: ${shown}\n\nThe wall reads essays from corpus/ and writes their assemblies beside them. Move the essay there and run this again.`
    )
  }
  return resolved
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  const { target, force } = parseArgs(process.argv.slice(2))
  const source = resolveTarget(target)
  const slug = slugFromFileName(source)
  const outName = assemblyFileName(slug)
  const out = path.join(CORPUS_DIR, outName)

  let raw: string
  try {
    raw = await readFile(source, 'utf8')
  } catch {
    die(
      `No essay found. Expected a markdown file at corpus/${slug}.md\n\nDrop the essay there and run this again.`
    )
  }

  // A parse writes nulls. Overwriting an analysis Jordan made by hand would
  // erase it silently and irreversibly, so refusing is the default and
  // discarding is a thing he has to say out loud.
  if (!force && (await exists(out))) {
    die(
      `corpus/${outName} already exists.\n\nA parse writes "atom": null for every unit, so this would discard every classification the file holds.\n\nTo throw that analysis away deliberately:\n\n  npm run corpus -- --parse ${path.relative(REPO_ROOT, source)} --force`
    )
  }

  const assembly = parseEssay(raw, slug)
  await writeFile(out, serializeJson(assembly), 'utf8')

  const words = assembly.units.reduce((sum, unit) => sum + unit.words, 0)
  const unclassified = assembly.units.filter((unit) => unit.atom === null).length
  console.log(`corpus/${outName}`)
  console.log(`${assembly.units.length} units, ${words} words, ${unclassified} unclassified`)
}

main().catch((err: unknown) => {
  die(err instanceof Error ? err.message : String(err))
})
