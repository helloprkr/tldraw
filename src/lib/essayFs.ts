import type { InputFile } from '../types'

/**
 * Browser side of the disk bridge. The Vite dev server holds the only process;
 * these are the endpoints its middleware serves (supplement §6.1).
 *
 * Nothing here parses. Raw bytes cross the wire and the pure core in lib/ does
 * the work, so the in-app path and the node CLI path run identical code.
 */

async function json<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) throw new Error(`${what}: ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export async function listEssays(): Promise<string[]> {
  return json(await fetch('/api/essays'), 'list essays')
}

export async function readInputs(slug: string): Promise<InputFile[]> {
  return json(await fetch(`/api/inputs/${encodeURIComponent(slug)}`), `read inputs/${slug}`)
}

/** Returns null when the essay has no canvas state yet — the first spread. */
export async function readWork(slug: string): Promise<unknown | null> {
  const res = await fetch(`/api/work/${encodeURIComponent(slug)}`)
  if (res.status === 404) return null
  return json(res, `read work/${slug}`)
}

export async function writeWork(slug: string, snapshot: unknown): Promise<void> {
  const res = await fetch(`/api/work/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(snapshot),
  })
  if (!res.ok) throw new Error(`write work/${slug}: ${res.status} ${res.statusText}`)
}

/** Everything in corpus/ — the assemblies and the raw essays beside them (§8). */
export async function readCorpus(): Promise<InputFile[]> {
  return json(await fetch('/api/corpus'), 'read corpus')
}

/**
 * Writes a classification back to disk (§8's round trip). Only
 * `*.assembly.json` is writable there; the essays themselves are the writers'
 * material and the plugin refuses to touch them.
 */
export async function writeCorpusAssembly(name: string, content: string): Promise<void> {
  const res = await fetch(`/api/corpus/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: content,
  })
  if (!res.ok) throw new Error(`write corpus/${name}: ${res.status} ${res.statusText}`)
}

/**
 * Reads a text file back out of out/<slug>/. Exists so the figure registry can
 * decide the next figure number from disk (§10) rather than from anything the
 * app remembers across reloads. Null when it has not been written yet.
 */
export async function readOut(slug: string, path: string): Promise<string | null> {
  const res = await fetch(`/api/out/${encodeURIComponent(slug)}/${path}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`read out/${slug}/${path}: ${res.status} ${res.statusText}`)
  return await res.text()
}

export interface OutFile {
  path: string
  content?: string
  /** For binary output — the PNG plate. */
  contentBase64?: string
}

export async function writeOut(slug: string, files: OutFile[]): Promise<void> {
  const res = await fetch(`/api/out/${encodeURIComponent(slug)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ files }),
  })
  if (!res.ok) throw new Error(`write out/${slug}: ${res.status} ${res.statusText}`)
}

/** `?essay=<slug>` is how `npm run spread` hands an essay to the app. */
export function essaySlugFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('essay')
}
