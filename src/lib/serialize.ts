/**
 * The only place in this codebase that turns a value into bytes.
 *
 * The M2 gate diffs `⌘R`'s output against `npm run readout`'s byte for byte.
 * Routing both through the same pure `readout()` is necessary but not
 * sufficient — key order, indent width, and the trailing newline are all
 * decided at the write edge, and two independent `JSON.stringify` calls are
 * exactly how a gate like this fails at diff time rather than at review time.
 *
 * So neither edge is allowed its own serializer. Pure: no fs, no fetch.
 */

/** Two-space indent, trailing newline, insertion order preserved. */
export function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/**
 * Markdown documents end with exactly one newline. Readout builds its body by
 * joining lines; this is what guarantees the terminator regardless of how the
 * last section happened to end.
 */
export function serializeMarkdown(body: string): string {
  return `${body.replace(/\n+$/, '')}\n`
}
