/**
 * `npm run readout -- <slug>` (BUILD.md §7 Stage 5).
 *
 * The node write edge. It reads the snapshot, calls the pure `readout()`, and
 * hands both results to `serialize.ts` — the same function and the same
 * serializer the in-app ⌘R path uses, which is what makes the two provably
 * byte-identical rather than merely similar (supplement §6.2, E8).
 *
 * `--generated <iso>` pins the timestamp so a run can be reproduced; the M2 gate
 * uses it to diff this output against the app's.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readout } from '../src/lib/readout.ts'
import { serializeJson } from '../src/lib/serialize.ts'
import { nowStamp } from '../src/lib/stamp.ts'
import type { StoreDocument } from '../src/readout-types.ts'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function die(message: string): never {
  console.error(message)
  process.exit(1)
}

interface Args {
  slug: string
  generated: string
}

function parseArgs(argv: string[]): Args {
  let slug = ''
  let generated = ''

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--generated') {
      const value = argv[i + 1]
      if (!value) die('Usage: npm run readout -- <essay-slug> [--generated <iso-8601>]')
      generated = value
      i += 1
    } else if (arg.startsWith('--')) {
      die(`Unknown flag: ${arg}\n\nUsage: npm run readout -- <essay-slug> [--generated <iso-8601>]`)
    } else if (!slug) {
      slug = arg
    } else {
      die(`Unexpected argument: ${arg}\n\nUsage: npm run readout -- <essay-slug> [--generated <iso-8601>]`)
    }
  }

  if (!slug) die('Usage: npm run readout -- <essay-slug> [--generated <iso-8601>]')
  if (slug.includes('/') || slug.includes('\\') || slug.includes('..')) die(`Invalid slug: ${slug}`)

  // Seconds precision, matching §7's example stamp.
  return { slug, generated: generated || nowStamp() }
}

async function main(): Promise<void> {
  const { slug, generated } = parseArgs(process.argv.slice(2))
  const source = path.join(REPO_ROOT, 'work', `${slug}.tldr`)

  let raw: string
  try {
    raw = await readFile(source, 'utf8')
  } catch {
    die(
      `No canvas found. Expected a snapshot at work/${slug}.tldr\n\nOpen the essay first so the app can write one:\n\n  npm run spread -- ${slug}`
    )
  }

  let doc: StoreDocument
  try {
    doc = JSON.parse(raw) as StoreDocument
  } catch (err) {
    die(`work/${slug}.tldr is not valid JSON: ${err instanceof Error ? err.message : String(err)}`)
  }

  const { mapMd, assembly } = readout(doc, { slug, generated })

  const outDir = path.join(REPO_ROOT, 'out', slug)
  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(outDir, 'map.md'), mapMd, 'utf8')
  await writeFile(path.join(outDir, 'assembly.json'), serializeJson(assembly), 'utf8')

  console.log(`out/${slug}/map.md`)
  console.log(`out/${slug}/assembly.json`)
  console.log(`${assembly.cards} cards, ${assembly.untyped} untyped, ${assembly.sections.length} sections`)
}

main().catch((err: unknown) => {
  die(err instanceof Error ? err.message : String(err))
})
