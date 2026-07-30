/**
 * The disk bridge (supplement §6.1). The app is a browser SPA, but inputs/,
 * work/, out/ and corpus/ live on disk, and the Vite dev server is the only
 * process we are allowed to run (BUILD.md §2.6). So it carries the filesystem.
 *
 * Every guard that keeps Jordan's material safe is implemented here, not in the
 * callers: this middleware is the single place a browser can reach the disk, so
 * it is the only place worth defending.
 */

import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INPUTS_DIR = path.join(REPO_ROOT, 'inputs')

/** Generous, but a browser tab should not be able to exhaust the dev server. */
const MAX_BODY_BYTES = 64 * 1024 * 1024

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Lexical containment. Segments are validated individually because `..` must
 * never survive as a segment even when the resolved path happens to land inside
 * the repo — the intent is what we are rejecting, not just the outcome.
 */
function resolveInRepo(...segments: string[]): string {
  const parts: string[] = []
  for (const segment of segments) {
    for (const part of segment.split('/')) {
      if (part === '') continue
      if (
        part === '.' ||
        part.includes('..') ||
        part.includes('\0') ||
        part.includes('\\') ||
        path.isAbsolute(part)
      ) {
        throw new HttpError(403, `illegal path segment: ${part}`)
      }
      parts.push(part)
    }
  }
  if (parts.length === 0) throw new HttpError(400, 'empty path')
  const resolved = path.resolve(REPO_ROOT, ...parts)
  if (resolved !== REPO_ROOT && !resolved.startsWith(REPO_ROOT + path.sep)) {
    throw new HttpError(403, 'path escapes the repo root')
  }
  return resolved
}

function requireSegment(value: string | undefined, what: string): string {
  if (!value) throw new HttpError(400, `missing ${what}`)
  if (value.includes('/') || value.includes('\\')) {
    throw new HttpError(403, `${what} must be a single path segment`)
  }
  if (value === '.' || value.includes('..') || value.includes('\0')) {
    throw new HttpError(403, `illegal ${what}: ${value}`)
  }
  return value
}

/**
 * Symlinks are followed by the filesystem but not by path.resolve, so a link
 * planted under out/ could otherwise aim a write at inputs/. Re-check against
 * the deepest ancestor that actually exists.
 */
async function realTarget(target: string): Promise<string> {
  const tail = [path.basename(target)]
  let dir = path.dirname(target)
  for (;;) {
    try {
      const real = await fs.realpath(dir)
      return path.join(real, ...[...tail].reverse())
    } catch {
      const parent = path.dirname(dir)
      if (parent === dir) return target
      tail.push(path.basename(dir))
      dir = parent
    }
  }
}

/** BUILD.md §4: inputs/ is Jordan's material and the app never writes to it. */
function assertWritable(target: string): void {
  if (target === INPUTS_DIR || target.startsWith(INPUTS_DIR + path.sep)) {
    throw new HttpError(403, 'refused: inputs/ is read-only (BUILD.md §4)')
  }
  if (target !== REPO_ROOT && !target.startsWith(REPO_ROOT + path.sep)) {
    throw new HttpError(403, 'refused: path escapes the repo root')
  }
}

/** Temp file beside the target, then rename — a half-written .tldr is worse than none. */
async function writeAtomic(target: string, data: string | Uint8Array): Promise<number> {
  assertWritable(target)
  assertWritable(await realTarget(target))
  const dir = path.dirname(target)
  await fs.mkdir(dir, { recursive: true })
  const temp = path.join(dir, `.${path.basename(target)}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.tmp`)
  try {
    await fs.writeFile(temp, data)
    await fs.rename(temp, target)
  } catch (err) {
    await fs.rm(temp, { force: true })
    throw err
  }
  return typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength
}

/**
 * Re-serialized, never re-sorted: JSON.parse preserves the order it was given,
 * so the git diff Jordan reads stays a diff of his structure, not of key order.
 */
function prettyJson(raw: string, what: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new HttpError(400, `${what} is not valid JSON`)
  }
  return `${JSON.stringify(parsed, null, 2)}\n`
}

function isJsonPath(target: string): boolean {
  return target.endsWith('.json') || target.endsWith('.tldr')
}

function repoRelative(target: string): string {
  return path.relative(REPO_ROOT, target).split(path.sep).join('/')
}

async function readBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = chunk as Buffer
    size += buf.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'request body too large')
    chunks.push(buf)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.setHeader('cache-control', 'no-store')
  res.end(`${JSON.stringify(payload, null, 2)}\n`)
}

async function readDirEntries(dir: string) {
  try {
    return await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }
}

async function readFilesInto(dir: string, names: string[]) {
  const files: Array<{ name: string; content: string }> = []
  for (const name of names) {
    files.push({ name, content: await fs.readFile(path.join(dir, name), 'utf8') })
  }
  return files
}

/** Body shape for POST /api/out/:slug. */
interface OutFile {
  path: string
  content?: string
  contentBase64?: string
}

function parseOutFiles(raw: string): OutFile[] {
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    throw new HttpError(400, 'body is not valid JSON')
  }
  const files = (body as { files?: unknown } | null)?.files
  if (!Array.isArray(files)) throw new HttpError(400, 'body must be { files: [...] }')
  return files.map((entry, index) => {
    const file = entry as OutFile | null
    if (!file || typeof file.path !== 'string' || file.path === '') {
      throw new HttpError(400, `files[${index}].path is required`)
    }
    const hasText = typeof file.content === 'string'
    const hasBinary = typeof file.contentBase64 === 'string'
    if (hasText === hasBinary) {
      throw new HttpError(400, `files[${index}] needs exactly one of content or contentBase64`)
    }
    return file
  })
}

async function handle(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  segments: string[],
): Promise<void> {
  const method = req.method ?? 'GET'
  const [, area, param] = segments

  const expect = (allowed: string): void => {
    if (method !== allowed) throw new HttpError(405, `${method} not allowed on ${req.url}`)
  }

  if (area === 'essays' && segments.length === 2) {
    expect('GET')
    const entries = await readDirEntries(INPUTS_DIR)
    const slugs = (entries ?? [])
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort()
    return sendJson(res, 200, slugs)
  }

  if (area === 'inputs' && segments.length === 3) {
    expect('GET')
    const slug = requireSegment(param, 'slug')
    const dir = resolveInRepo('inputs', slug)
    const entries = await readDirEntries(dir)
    if (!entries) throw new HttpError(404, `no such essay: ${slug}`)
    const names = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name)
      .sort()
    return sendJson(res, 200, await readFilesInto(dir, names))
  }

  if (area === 'work' && segments.length === 3) {
    const slug = requireSegment(param, 'slug')
    const target = resolveInRepo('work', `${slug}.tldr`)

    if (method === 'GET') {
      let raw: string
      try {
        raw = await fs.readFile(target, 'utf8')
      } catch {
        throw new HttpError(404, `no canvas state for ${slug}`)
      }
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.setHeader('cache-control', 'no-store')
      return res.end(raw)
    }

    expect('PUT')
    const bytes = await writeAtomic(target, prettyJson(await readBody(req), 'body'))
    return sendJson(res, 200, { path: repoRelative(target), bytes })
  }

  if (area === 'corpus' && segments.length === 2) {
    expect('GET')
    const dir = path.join(REPO_ROOT, 'corpus')
    const entries = await readDirEntries(dir)
    const names = (entries ?? [])
      .filter((entry) => entry.isFile() && (entry.name.endsWith('.assembly.json') || entry.name.endsWith('.md')))
      .map((entry) => entry.name)
      .sort()
    return sendJson(res, 200, await readFilesInto(dir, names))
  }

  if (area === 'corpus' && segments.length === 3) {
    expect('PUT')
    const file = requireSegment(param, 'file')
    // §8's round-trip writes classifications back; the raw essay stays Jordan's.
    if (!file.endsWith('.assembly.json')) {
      throw new HttpError(403, 'only *.assembly.json is writable in corpus/')
    }
    const target = resolveInRepo('corpus', file)
    const bytes = await writeAtomic(target, prettyJson(await readBody(req), 'body'))
    return sendJson(res, 200, { path: repoRelative(target), bytes })
  }

  if (area === 'out' && segments.length === 3) {
    expect('POST')
    const slug = requireSegment(param, 'slug')
    const files = parseOutFiles(await readBody(req))
    const written: string[] = []
    for (const file of files) {
      const target = resolveInRepo('out', slug, file.path)
      const data =
        typeof file.contentBase64 === 'string'
          ? Buffer.from(file.contentBase64, 'base64')
          : isJsonPath(target)
            ? prettyJson(file.content as string, file.path)
            : (file.content as string)
      await writeAtomic(target, data)
      written.push(repoRelative(target))
    }
    return sendJson(res, 200, { written })
  }

  throw new HttpError(404, `no such endpoint: ${req.url}`)
}

export function essayFs(): Plugin {
  return {
    name: 'essay-fs',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawPath = (req.url ?? '/').split('?')[0]
        if (!rawPath.startsWith('/api/')) return next()

        // Decode after splitting, so an encoded slash cannot smuggle a segment.
        let segments: string[]
        try {
          segments = rawPath.split('/').filter(Boolean).map(decodeURIComponent)
        } catch {
          return sendJson(res, 400, { error: 'malformed percent-encoding in path' })
        }

        try {
          await handle(req, res, segments)
        } catch (err) {
          const status = err instanceof HttpError ? err.status : 500
          const message = err instanceof Error ? err.message : String(err)
          sendJson(res, status, { error: message })
        }
      })
    },
  }
}
