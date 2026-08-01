/**
 * tldraw's id, index, and schema helpers for the node edges (compile-cli and
 * check-compile). Loaded through computed specifiers because
 * tsconfig.scripts.json compiles without the DOM lib (same posture as
 * check-tickets.ts); resolved normally at runtime.
 */

import type { CompileDeps } from '../src/lib/sceneCompile.ts'

/**
 * tldraw's id and index helpers, loaded opaquely (see header). The schema
 * block is created with the shapes in the app's own registration order, so it
 * serializes byte-identically to what the app saves — check-compile proves it.
 */
export async function loadDeps(): Promise<CompileDeps> {
  const TLSCHEMA = '@tldraw/tlschema'
  const UTILS = '@tldraw/utils'

  // @tldraw/utils picks its key generator at import time: jittered normally,
  // plain `generateNKeysBetween` under NODE_ENV=test. The jitter is a
  // collaborative-editing collision defense; this process is a single writer
  // that needs `compile twice → identical bytes` (E22.5), so we take the
  // library's own deterministic path rather than hand-rolling one (§6.3 rule 3).
  // Set before the dynamic import so the module reads it as it initializes.
  process.env.NODE_ENV = 'test'
  const tlschema = (await import(TLSCHEMA)) as {
    createShapeId: (id?: string) => string
    createBindingId: (id?: string) => string
    PageRecordType: { createId: (id?: string) => string }
    createTLSchema: (opts: { shapes: Record<string, unknown>; bindings: unknown }) => { serialize: () => unknown }
    defaultShapeSchemas: Record<string, unknown>
    defaultBindingSchemas: unknown
  }
  const utils = (await import(UTILS)) as {
    getIndicesAbove: (below: string | null | undefined, n: number) => string[]
  }

  const d = tlschema.defaultShapeSchemas
  // The app's registration order (App.tsx shapeUtils), which decides the
  // serialized key order: defaults, then the five custom shapes, then the
  // subclassed arrow and frame.
  const shapes = {
    group: d.group,
    text: d.text,
    bookmark: d.bookmark,
    draw: d.draw,
    geo: d.geo,
    note: d.note,
    line: d.line,
    highlight: d.highlight,
    embed: d.embed,
    image: d.image,
    video: d.video,
    atom: {},
    ticket: {},
    gap: {},
    band: {},
    plate: {},
    arrow: d.arrow,
    frame: d.frame,
  }
  const schema = tlschema.createTLSchema({ shapes, bindings: tlschema.defaultBindingSchemas }).serialize()

  return {
    shapeId: (seed) => tlschema.createShapeId(seed),
    bindingId: (seed) => tlschema.createBindingId(seed),
    pageId: (seed) => tlschema.PageRecordType.createId(seed),
    indicesAfter: (after, n) => utils.getIndicesAbove(after, n),
    schema,
  }
}

