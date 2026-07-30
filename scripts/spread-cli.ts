/**
 * `npm run spread -- <slug>` (BUILD.md §7 Stage 1).
 *
 * This only validates and opens. The spread itself — diffing fragment ids
 * against work/<slug>.tldr and parking only the new ones at x = STAGING_X —
 * runs in the app on load, so that the one code path is the one Jordan uses.
 */

import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEV_SERVER = 'http://localhost:5173'

function die(message: string): never {
  console.error(message)
  process.exit(1)
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory()
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  const slug = process.argv[2]
  if (!slug) die('Usage: npm run spread -- <essay-slug>')
  if (slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
    die(`Invalid slug: ${slug}`)
  }

  const inputsDir = path.join(REPO_ROOT, 'inputs', slug)
  if (!(await isDirectory(inputsDir))) {
    die(`No fragments found. Expected a directory at inputs/${slug}/\n\nCreate it and drop one .md file per fragment, then run this again.`)
  }

  const reachable = await fetch(`${DEV_SERVER}/api/essays`, { signal: AbortSignal.timeout(2000) })
    .then((response) => response.ok)
    .catch(() => false)

  if (!reachable) {
    die(`The dev server is not answering at ${DEV_SERVER}.\n\nStart it in another terminal:\n\n  npm run dev\n\nThen run: npm run spread -- ${slug}`)
  }

  const url = `${DEV_SERVER}/?essay=${encodeURIComponent(slug)}`
  if (process.platform === 'darwin') {
    spawn('open', [url], { stdio: 'ignore', detached: true }).unref()
  }
  console.log(url)
}

main().catch((err: unknown) => {
  die(err instanceof Error ? err.message : String(err))
})
