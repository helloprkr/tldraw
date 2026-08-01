import type { Scene } from '../scene-types'
import type { StoreDocument, TldrRecord } from '../readout-types'
import type { SceneLayout, PlacedNode } from './sceneLayout'

/**
 * Scenes → .tldr records (M6_GENERATIVE.md §6.3). Pure: the id and index
 * helpers come in as `deps` so the mint stays the library's (§6.3 rule 3)
 * while this module stays importable anywhere the pure core is.
 *
 * The four rules, in order of how expensive they are to get wrong:
 *
 * 1. Ids are derived — `shapeId(hash(slug:scene:node))` — so recompiling an
 *    edited scene produces a diff, not a duplicate set. Seeds are scene-
 *    qualified because two scenes both have an `n-1` (E35's lesson: an
 *    id allocated against too small a scope collides where nobody looks).
 * 2. Preserve-positions is the default, not a flag. A surviving shape keeps
 *    x, y, parentId and index; its size survives too unless the node's text
 *    changed. Regeneration must never destroy an arrangement Jordan made.
 * 3. Only records this compiler minted are ever touched. A hand-placed shape
 *    on a generated page carries no `meta.scene` and is invisible here.
 * 4. Everything else in the store — Jordan's pages, the delta, user records —
 *    passes through byte-untouched.
 */

export interface CompileDeps {
  /** `createShapeId(seed)` from tldraw. */
  shapeId: (seed: string) => string
  /** `createBindingId(seed)` from tldraw. */
  bindingId: (seed: string) => string
  /** `PageRecordType.createId(seed)` from tldraw. */
  pageId: (seed: string) => string
  /** The library's fractional-index mint: n keys strictly above `after`. */
  indicesAfter: (after: string | null, n: number) => string[]
  /** Serialized schema, byte-identical to what the app itself saves. */
  schema: unknown
}

export interface CompiledScene {
  /** The scene file's basename without extension — the stable identity. */
  name: string
  scene: Scene
  layout: SceneLayout
}

export interface CompileResult {
  document: StoreDocument
  /** Per scene: what happened, for the CLI to report. */
  report: { scene: string; created: number; preserved: number; removed: number }[]
}

/** FNV-1a, hex. Stable, dependency-free; the seed the library id helpers wrap. */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const DOCUMENT_ID = 'document:document'

/** Full default arrow props for 5.2.5, transcribed from an app-saved file. */
const ARROW_PROPS = {
  kind: 'arc',
  elbowMidPoint: 0.5,
  dash: 'solid',
  size: 's',
  fill: 'fill',
  color: 'black',
  labelColor: 'black',
  bend: 0,
  start: { x: 0, y: 0 },
  end: { x: 2, y: 0 },
  arrowheadStart: 'none',
  arrowheadEnd: 'triangle',
  richText: { type: 'doc', content: [{ type: 'paragraph' }] },
  labelPosition: 0.5,
  font: 'draw',
  scale: 1,
} as const

function bindingProps(terminal: 'start' | 'end', anchor: { x: number; y: number }) {
  return {
    isPrecise: true,
    isExact: false,
    normalizedAnchor: anchor,
    snap: 'none',
    terminal,
  }
}

function highestIndex(records: TldrRecord[]): string | null {
  let max: string | null = null
  for (const r of records) {
    if (typeof r.index === 'string' && (max === null || r.index > max)) max = r.index
  }
  return max
}

export function compileScenes(
  slug: string,
  scenes: CompiledScene[],
  existing: StoreDocument | null,
  generatedDate: string,
  deps: CompileDeps
): CompileResult {
  // Insertion order is preserved for kept records and appended for new ones,
  // so a recompile with no changes is byte-identical (E8's discipline).
  const store = new Map<string, TldrRecord>()
  if (existing) {
    for (const [id, record] of Object.entries(existing.store)) store.set(id, { ...record })
  }

  if (!store.has(DOCUMENT_ID)) {
    store.set(DOCUMENT_ID, {
      gridSize: 10,
      name: '',
      meta: {},
      id: DOCUMENT_ID,
      typeName: 'document',
    } as unknown as TldrRecord)
  }

  const pages = [...store.values()].filter((r) => r.typeName === 'page')
  const report: CompileResult['report'] = []

  let pageIndexCursor = highestIndex(pages)
  for (const { name, scene, layout } of scenes) {
    // Everything this compiler ever minted for this scene, before this run —
    // collected before the page upsert so the page's own record cannot be
    // mistaken for a leftover of itself.
    const mineBefore = new Map<string, TldrRecord>()
    for (const record of store.values()) {
      if (record.meta && record.meta.scene === name) mineBefore.set(record.id, record)
    }

    const wanted = new Set<string>()

    // A delta scene compiles onto THE delta page — the one ⌘D opens and the
    // reconciler works (M4). If Jordan already visited the delta by hand, that
    // page exists under tldraw's own id; adopt it rather than minting a twin
    // with the same name and stranding one of them.
    const pageName = scene.form === 'delta' ? 'Delta' : scene.title
    let pageId = deps.pageId(fnv1a(`${slug}:${name}:page`))
    if (scene.form === 'delta') {
      const existingDelta = [...store.values()].find(
        (r) => r.typeName === 'page' && (r as unknown as { name: string }).name === 'Delta'
      )
      if (existingDelta) pageId = existingDelta.id
    }
    wanted.add(pageId)
    const pageRecord = store.get(pageId)
    if (pageRecord) {
      // The page survives as-is; only its label and provenance refresh.
      ;(pageRecord as unknown as { name: string }).name = pageName
      pageRecord.meta = { ...pageRecord.meta, generated: true, scene: name, form: scene.form }
    } else {
      const [index] = deps.indicesAfter(pageIndexCursor, 1)
      pageIndexCursor = index
      store.set(pageId, {
        meta: { generated: true, scene: name, form: scene.form },
        id: pageId,
        name: pageName,
        index,
        typeName: 'page',
      } as unknown as TldrRecord)
    }
    let created = 0
    let preserved = 0

    const frameIds = new Map<string, string>()
    const nodeIds = new Map<string, string>()

    const place = (
      id: string,
      build: () => TldrRecord,
      preserve: (existingRecord: TldrRecord, fresh: TldrRecord) => TldrRecord
    ) => {
      wanted.add(id)
      const before = mineBefore.get(id)
      const fresh = build()
      if (before) {
        preserved += 1
        store.set(id, preserve(before, fresh))
      } else {
        created += 1
        store.set(id, fresh)
      }
    }

    // Frames first: cards parent onto them, and their ids must exist to do so.
    for (const frame of layout.frames) {
      // Delta furniture may already exist by hand (⌘D's ensureFrames): adopt a
      // frame with the matching name on the target page instead of doubling it.
      if (scene.form === 'delta') {
        const handFrame = [...store.values()].find(
          (r) =>
            r.typeName === 'shape' &&
            r.type === 'frame' &&
            r.parentId === pageId &&
            (r.props as { name?: string } | undefined)?.name === frame.group.label &&
            r.meta?.scene === undefined
        )
        if (handFrame) {
          frameIds.set(frame.group.id, handFrame.id)
          continue
        }
      }
      const id = deps.shapeId(fnv1a(`${slug}:${name}:${frame.group.id}`))
      frameIds.set(frame.group.id, id)
      place(
        id,
        () =>
          ({
            x: frame.x,
            y: frame.y,
            rotation: 0,
            isLocked: false,
            opacity: 1,
            meta: { origin: 'generated', scene: name, node: frame.group.id },
            id,
            type: 'frame',
            props: { w: frame.w, h: frame.h, name: frame.group.label, color: 'black' },
            parentId: pageId,
            index: '',
            typeName: 'shape',
          }) as unknown as TldrRecord,
        (before, fresh) => ({
          ...fresh,
          // A frame Jordan moved or resized is his furniture now.
          x: before.x,
          y: before.y,
          parentId: before.parentId,
          index: before.index,
          props: { ...(fresh.props ?? {}), w: before.props?.w, h: before.props?.h },
        })
      )
    }

    // The field's axes: one shape, under everything (placed first, so a fresh
    // compile mints it the lowest index on the page).
    if (layout.axes) {
      const a = layout.axes
      const id = deps.shapeId(fnv1a(`${slug}:${name}:axes`))
      place(
        id,
        () =>
          ({
            x: a.x,
            y: a.y,
            rotation: 0,
            isLocked: false,
            opacity: 1,
            meta: { origin: 'generated', scene: name, node: 'axes' },
            id,
            type: 'axes',
            props: { w: a.w, h: a.h, xLow: a.xLow, xHigh: a.xHigh, yLow: a.yLow, yHigh: a.yHigh },
            parentId: pageId,
            index: '',
            typeName: 'shape',
          }) as unknown as TldrRecord,
        (before, fresh) => ({
          ...fresh,
          x: before.x,
          y: before.y,
          parentId: before.parentId,
          index: before.index,
          props: { ...(fresh.props ?? {}), w: before.props?.w, h: before.props?.h },
        })
      )
    }

    const textHash = (p: PlacedNode) => fnv1a(p.node.text)
    // Reading order is the scene's node order, not placement order — the
    // eyebrow ordinal and ¶ reference both read from it.
    const readingOrder = new Map(scene.nodes.map((n, i) => [n.id, i + 1]))
    for (const placedNode of layout.nodes) {
      const ordinal = readingOrder.get(placedNode.node.id) ?? 0
      const id = deps.shapeId(fnv1a(`${slug}:${name}:${placedNode.node.id}`))
      nodeIds.set(placedNode.node.id, id)
      const parentId = placedNode.group ? frameIds.get(placedNode.group)! : pageId
      const frame = placedNode.group ? layout.frames.find((f) => f.group.id === placedNode.group) : undefined
      // Child coordinates are relative to the parent frame.
      const x = frame ? placedNode.x - frame.x : placedNode.x
      const y = frame ? placedNode.y - frame.y : placedNode.y
      const props =
        placedNode.kind === 'cite'
          ? { w: placedNode.w, h: placedNode.h, text: placedNode.node.text }
          : {
              w: placedNode.w,
              h: placedNode.h,
              atom: placedNode.node.atom,
              text: placedNode.node.text,
              sourceId: placedNode.node.unit,
              created: generatedDate,
              ordinal,
            }
      place(
        id,
        () =>
          ({
            x,
            y,
            rotation: 0,
            isLocked: false,
            opacity: 1,
            meta: { origin: 'generated', scene: name, node: placedNode.node.id, textHash: textHash(placedNode) },
            id,
            type: placedNode.kind,
            props,
            parentId,
            index: '',
            typeName: 'shape',
          }) as unknown as TldrRecord,
        (before, fresh) => {
          // §6.3 rule 2. Position always survives; size survives while the
          // text it was sized for does.
          const sameText = before.meta?.textHash === (fresh.meta as { textHash: string }).textHash
          return {
            ...fresh,
            x: before.x,
            y: before.y,
            parentId: before.parentId,
            index: before.index,
            props: sameText
              ? { ...(fresh.props ?? {}), w: before.props?.w, h: before.props?.h }
              : (fresh.props as Record<string, unknown>),
          }
        }
      )
    }

    for (const placedEdge of layout.edges) {
      const { edge } = placedEdge
      const seed = `${slug}:${name}:e:${edge.from}->${edge.to}:${edge.kind}`
      const arrowId = deps.shapeId(fnv1a(seed))
      const fromShape = nodeIds.get(edge.from)
      const toShape = nodeIds.get(edge.to)
      if (!fromShape || !toShape) continue
      place(
        arrowId,
        () =>
          ({
            x: 0,
            y: 0,
            rotation: 0,
            isLocked: false,
            opacity: 1,
            meta: {
              origin: 'generated',
              scene: name,
              node: `e:${edge.from}->${edge.to}`,
              relation: placedEdge.relation,
              kind: edge.kind,
              feedback: edge.feedback,
            },
            id: arrowId,
            type: 'arrow',
            props: {
              ...ARROW_PROPS,
              kind: placedEdge.kind === 'elbow' ? 'elbow' : 'arc',
              bend: placedEdge.bend,
              dash: placedEdge.dash,
            },
            parentId: pageId,
            index: '',
            typeName: 'shape',
          }) as unknown as TldrRecord,
        (before, fresh) => ({ ...fresh, index: before.index })
      )
      for (const [terminal, target, anchor] of [
        ['start', fromShape, placedEdge.startAnchor],
        ['end', toShape, placedEdge.endAnchor],
      ] as const) {
        const bid = deps.bindingId(fnv1a(`${seed}:${terminal}`))
        wanted.add(bid)
        const before = mineBefore.get(bid)
        store.set(bid, {
          meta: { scene: name },
          id: bid,
          type: 'arrow',
          fromId: arrowId,
          toId: target,
          props: bindingProps(terminal, anchor),
          typeName: 'binding',
        } as unknown as TldrRecord)
        if (before) preserved += 1
        else created += 1
      }
    }

    // A node cut from the scene takes its records with it. Nothing without
    // `meta.scene === name` can be in `mineBefore`, so nothing of Jordan's
    // is reachable from this loop.
    let removed = 0
    for (const id of mineBefore.keys()) {
      if (!wanted.has(id)) {
        store.delete(id)
        removed += 1
      }
    }

    // New shapes join their siblings above the current top of the stack, in
    // scene order, minted by the library (§6.3 rule 3).
    const byParent = new Map<string, TldrRecord[]>()
    for (const record of store.values()) {
      if (record.typeName !== 'shape') continue
      const parent = record.parentId ?? ''
      if (!byParent.has(parent)) byParent.set(parent, [])
      byParent.get(parent)!.push(record)
    }
    for (const siblings of byParent.values()) {
      const fresh = siblings.filter((s) => s.index === '' && s.meta?.scene === name)
      if (fresh.length === 0) continue
      const taken = siblings.filter((s) => !fresh.includes(s))
      const indices = deps.indicesAfter(highestIndex(taken), fresh.length)
      fresh.forEach((record, i) => {
        record.index = indices[i]
      })
    }

    report.push({ scene: name, created, preserved, removed })
  }

  const document: StoreDocument = {
    store: Object.fromEntries(store),
    schema: existing?.schema ?? deps.schema,
  }
  return { document, report }
}
