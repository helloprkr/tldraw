/**
 * `npm run save -- <slug>` (BUILD.md §7 Stage 8, supplement §6.3).
 *
 * Stages the essay's structure for commit. It does not write the snapshot —
 * the app's autosave owns `work/<slug>.tldr` (§7 Stage 8: every 30s and on
 * blur) — and it does not commit. Jordan commits. The whole job is to verify
 * the snapshot is on disk and then `git add work/ out/`.
 *
 * Not committing is the point rather than an omission. §7 Stage 8's acceptance
 * is that `git log -p work/<slug>.tldr` reads as a history of the essay's
 * structure changing, and a machine-authored commit every thirty seconds would
 * make that log worthless.
 *
 * A missing snapshot is the common failure and it has a specific cause — the
 * essay was never opened, so nothing autosaved — so the error carries the fix
 * rather than the diagnosis.
 */

import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const run = promisify(execFile)

function die(message: string): never {
  console.error(message)
  process.exit(1)
}

async function isFile(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isFile()
  } catch {
    return false
  }
}

/** Runs git in the repo root and returns stdout, or dies with git's own words. */
async function git(...args: string[]): Promise<string> {
  try {
    const { stdout } = await run('git', args, { cwd: REPO_ROOT })
    return stdout
  } catch (err: unknown) {
    const stderr = (err as { stderr?: string }).stderr
    die(`git ${args.join(' ')} failed:\n\n${(stderr || String(err)).trim()}`)
  }
}

async function main(): Promise<void> {
  const slug = process.argv[2]
  if (!slug) die('Usage: npm run save -- <essay-slug>')
  if (slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
    die(`Invalid slug: ${slug}`)
  }

  const snapshot = path.join(REPO_ROOT, 'work', `${slug}.tldr`)
  if (!(await isFile(snapshot))) {
    die(
      `No canvas found. Expected a snapshot at work/${slug}.tldr\n\n` +
        `The app writes that file itself, every 30s and when the tab loses focus.\n` +
        `Open the essay, place a card, then click away from the tab:\n\n` +
        `  npm run spread -- ${slug}\n\n` +
        `Then run: npm run save -- ${slug}`
    )
  }

  // §6.3 verbatim: work/ and out/ together. The snapshot without the outputs it
  // produced is exactly the desync E22 and E25 were written about.
  await git('add', 'work/', 'out/')

  const staged = (await git('diff', '--cached', '--name-only'))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (staged.length === 0) {
    console.log('work/ and out/ are already committed as they stand. Nothing staged.')
    return
  }

  for (const file of staged) console.log(file)
  console.log(`\n${staged.length} file${staged.length === 1 ? '' : 's'} staged. Not committed — commit when the structure is where you want it.`)
}

main().catch((err: unknown) => {
  die(err instanceof Error ? err.message : String(err))
})
