/**
 * `npm run trace -- --resolve <slug>` and `npm run trace -- --check <slug>`
 * (M6_GENERATIVE.md §6.1, §9; E41.6).
 *
 * The deterministic half of /trace. The model writes out/<slug>/trace.json with
 * a verbatim `quote` on every span; this edge locates each quote in its context
 * file and mints the character offsets. Code does the arithmetic, the model
 * never does — a quote that fails to resolve verbatim, or resolves in two
 * places, is reported and left unresolved rather than guessed at.
 *
 * `--check` validates without writing: vocabulary, references, and every span's
 * offsets reproducing its quote from the real file. Exit 1 on any error, so
 * gates can depend on it.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkSpans, parseTrace, resolveSpans, validateTrace } from '../src/trace-types.ts'
import type { Trace, TraceIssue } from '../src/trace-types.ts'
import { serializeJson } from '../src/lib/serialize.ts'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function die(message: string): never {
  console.error(message)
  process.exit(1)
}

interface Args {
  mode: 'resolve' | 'check'
  slug: string
}

function parseArgs(argv: string[]): Args {
  let mode: Args['mode'] | null = null
  let slug: string | null = null
  for (const arg of argv) {
    if (arg === '--resolve') mode = 'resolve'
    else if (arg === '--check') mode = 'check'
    else if (!arg.startsWith('-') && !slug) slug = arg
    else die(`unrecognized argument: ${arg}`)
  }
  if (!slug) die('usage: npm run trace -- --resolve <slug> | --check <slug>')
  return { mode: mode ?? 'check', slug }
}

/** Everything under context/<slug>/, keyed by repo-relative path — what spans point at. */
async function readContext(slug: string): Promise<Map<string, string>> {
  const dir = path.join(REPO_ROOT, 'context', slug)
  let names: string[]
  try {
    names = (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isFile() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort()
  } catch {
    die(`no context/${slug}/ — the pile has to exist before it can be traced`)
  }
  const files = new Map<string, string>()
  for (const name of names) {
    files.set(`context/${slug}/${name}`, await readFile(path.join(dir, name), 'utf8'))
  }
  return files
}

function report(issues: TraceIssue[]): number {
  let errors = 0
  for (const i of issues) {
    if (i.level === 'error') errors += 1
    console.log(`${i.level.toUpperCase().padEnd(5)} ${i.code.padEnd(15)} ${i.at ?? '-'}  ${i.message}`)
  }
  return errors
}

async function main(): Promise<void> {
  const { mode, slug } = parseArgs(process.argv.slice(2))
  const tracePath = path.join(REPO_ROOT, 'out', slug, 'trace.json')

  let raw: string
  try {
    raw = await readFile(tracePath, 'utf8')
  } catch {
    die(`no out/${slug}/trace.json — run /trace first`)
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch (err) {
    die(`out/${slug}/trace.json is not JSON: ${String(err)}`)
  }

  const { trace, issues: shapeIssues } = parseTrace(parsedJson)
  if (!trace) {
    report(shapeIssues)
    process.exit(1)
  }
  if (trace.slug !== slug) {
    die(`trace.slug is "${trace.slug}" but the file lives under out/${slug}/`)
  }

  const files = await readContext(slug)
  const issues: TraceIssue[] = [...shapeIssues, ...validateTrace(trace)]

  let final: Trace = trace
  if (mode === 'resolve') {
    const resolved = resolveSpans(trace, files)
    final = resolved.trace
    issues.push(...resolved.issues)
    // reviewed is Jordan's field. Resolution rewrites offsets, nothing else —
    // in particular it must never flip reviewed, in either direction.
    await writeFile(tracePath, serializeJson({ ...final, reviewed: trace.reviewed }), 'utf8')
    console.log(`resolved offsets written to out/${slug}/trace.json`)
  }

  issues.push(...checkSpans(final, files))

  const errors = report(issues)
  const founded = final.units.filter((u) => u.span && Number.isInteger(u.span.start) && u.span.start >= 0).length
  console.log(`\n${final.units.length} units, ${founded} founded, ${final.relations.length} relations, ${final.tensions.length} tensions, ${final.gaps.length} gaps`)
  console.log(errors === 0 ? 'TRACE OK' : `TRACE FAILED: ${errors} error(s)`)
  process.exit(errors === 0 ? 0 : 1)
}

await main()
