/**
 * Input files to fragments. Pure: data in, data out — no fs, no fetch, no DOM,
 * no editor. The browser feeds it /api/inputs, node feeds it readdir, and both
 * paths must produce the identical fragment list (supplement §6.2).
 *
 * The frontmatter dialect is BUILD.md §6.1 and nothing more: flat `key: value`
 * pairs, optionally quoted. A YAML library would accept far more than the format
 * allows and would make the two paths depend on a parser we do not control.
 */

import { isAtomType } from '../types'
import type { Fragment, InputFile } from '../types'

const FENCE = '---'

export interface ParsedFile {
  data: Record<string, string>
  body: string
}

/** Frontmatter is only frontmatter when the file opens with the fence. */
export function parseFrontmatter(raw: string): ParsedFile {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  if (lines[0]?.trim() !== FENCE) return { data: {}, body: text }

  const close = lines.findIndex((line, i) => i > 0 && line.trim() === FENCE)
  if (close === -1) return { data: {}, body: text }

  const data: Record<string, string> = {}
  for (const line of lines.slice(1, close)) {
    const colon = line.indexOf(':')
    if (colon === -1 || line.trim().startsWith('#')) continue
    const key = line.slice(0, colon).trim()
    if (key) data[key] = readValue(line.slice(colon + 1).trim())
  }
  return { data, body: lines.slice(close + 1).join('\n') }
}

/** Quotes win over comments: a `#` inside quotes is content, not a comment. */
function readValue(raw: string): string {
  const quote = raw[0]
  if (quote === '"' || quote === "'") {
    const end = raw.indexOf(quote, 1)
    if (end > 0) return raw.slice(1, end)
  }
  const hash = raw.indexOf('#')
  return (hash === -1 ? raw : raw.slice(0, hash)).trim()
}

/**
 * The low-friction path: a wall of thinking separated by rules. Split only on
 * lines that are exactly the fence and only within the body, so the frontmatter
 * delimiters can never be mistaken for section separators.
 */
export function splitSections(body: string): string[] {
  return body.split('\n').reduce<string[]>(
    (sections, line) => {
      if (line.trim() === FENCE) sections.push('')
      else sections[sections.length - 1] += `${line}\n`
      return sections
    },
    ['']
  )
}

function isNotesFile(name: string): boolean {
  return name.split('/').pop()?.toLowerCase() === 'notes.md'
}

/** `001-some-fragment.md` becomes `001-some-fragment`. */
function baseId(name: string): string {
  const file = name.split('/').pop() ?? name
  return file.replace(/\.[^.]+$/, '')
}

function byName(a: InputFile, b: InputFile): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
}

/**
 * Ids must survive a re-run unchanged — they are the whole basis of spread being
 * additive rather than duplicating Jordan's cards. So an id is either declared in
 * frontmatter or derived from the filename, never from content or position.
 */
export function parseFragments(files: InputFile[]): Fragment[] {
  const fragments: Fragment[] = []

  for (const file of [...files].sort(byName)) {
    const { data, body } = parseFrontmatter(file.content)
    const atom = isAtomType(data.atom) ? data.atom : 'untyped'
    const frame = data.frame ? data.frame : null
    const declaredId = data.id
    const notes = isNotesFile(file.name)
    const sections = notes ? splitSections(body) : [body]

    sections.forEach((section, index) => {
      const text = section.trim()
      if (!text) return
      // Section index comes from the raw split, so emptying one section does not
      // renumber the others.
      const suffix = notes ? `-${index + 1}` : ''
      fragments.push({
        id: `${declaredId ?? baseId(file.name)}${suffix}`,
        text,
        atom,
        frame,
        sourceFile: file.name,
        ordinal: fragments.length + 1,
      })
    })
  }

  return fragments
}
