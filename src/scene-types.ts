import { TRACE_RELATION_KINDS } from './trace-types'
import type { Trace, TraceAtom, TraceRelationKind } from './trace-types'
import { ATOM_TYPES } from './types'

/**
 * The scene (M6_GENERATIVE.md §6.2). Form + nodes + edges + groups, and
 * deliberately nothing else: **there is no x, no y, no width, no height
 * anywhere in this schema**, and the validator refuses a scene that smuggles
 * one in. Language models are unreliable at absolute coordinates, so the
 * schema makes emitting one impossible rather than discouraged (§3). If a
 * form seems to need a coordinate, the layout pass is missing something —
 * fix the layout pass.
 */

export const FORMS = ['spine', 'delta', 'field', 'genealogy', 'mechanism', 'band'] as const
export type SceneForm = (typeof FORMS)[number]

/** Form-specific placement classes. The only "where" a scene may speak. */
export const SLOTS = ['column', 'margin', 'inset', 'received', 'mine'] as const
export type SceneSlot = (typeof SLOTS)[number]

export interface SceneNode {
  /** `n-1`, `n-2`, … scene-local. */
  id: string
  /**
   * The trace unit this node renders. A node with no unit is a lint failure
   * (§9.3) — unless it is a genealogy source node, which references a trace
   * `source` instead. Exactly one of the two, never both, never neither:
   * either way the node points at something already in the trace.
   */
  unit: string | null
  /** A trace source id — genealogy only. Renders as a mono citation card. */
  source: string | null
  /** null only on source nodes: a citation is not an atom and wears no pigment. */
  atom: TraceAtom | null
  text: string
  /** spine: column|margin|inset. delta: received|mine. Others: null. */
  slot: SceneSlot | null
  /** Ordinal ranks, `field` form only. Never pixels. */
  rank: { x: number; y: number } | null
}

/**
 * The field's axis declaration (§5.3). x is always abstraction — concrete
 * left, abstract right, the house convention — so only y is declared, by the
 * model, poles labeled (E41.2).
 */
export interface SceneAxes {
  yLow: string
  yHigh: string
}

export interface SceneEdge {
  from: string
  to: string
  kind: TraceRelationKind
  /** `mechanism` only: routes as a curved return below the main line. */
  feedback: boolean
}

export interface SceneGroup {
  id: string
  label: string
  nodes: string[]
}

export interface Scene {
  form: SceneForm
  title: string
  /** Sentence case; becomes the plate caption. */
  caption: string
  /** The trace this scene was drawn from, repo-relative. */
  source: string
  /** `field` only. */
  axes: SceneAxes | null
  nodes: SceneNode[]
  edges: SceneEdge[]
  groups: SceneGroup[]
}

export interface SceneIssue {
  level: 'error' | 'warn'
  code: 'shape' | 'form' | 'coordinate' | 'node' | 'unit' | 'slot' | 'rank' | 'edge' | 'group' | 'untyped'
  at: string | null
  message: string
}

function issue(level: SceneIssue['level'], code: SceneIssue['code'], at: string | null, message: string): SceneIssue {
  return { level, code, at, message }
}

const COORDINATE_KEYS = ['x', 'y', 'w', 'h', 'width', 'height', 'left', 'top', 'px'] as const

function coordinateKeysIn(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  return Object.keys(value as object).filter((k) => (COORDINATE_KEYS as readonly string[]).includes(k))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseScene(value: unknown): { scene: Scene | null; issues: SceneIssue[] } {
  const issues: SceneIssue[] = []
  if (!isRecord(value)) return { scene: null, issues: [issue('error', 'shape', null, 'scene is not an object')] }

  if (!(FORMS as readonly string[]).includes(value.form as string)) {
    issues.push(issue('error', 'form', null, `form "${String(value.form)}" is not one of the six`))
  }
  for (const key of ['title', 'caption', 'source'] as const) {
    if (typeof value[key] !== 'string' || value[key] === '') {
      issues.push(issue('error', 'shape', null, `"${key}" must be a non-empty string`))
    }
  }
  for (const key of ['nodes', 'edges', 'groups'] as const) {
    if (value[key] !== undefined && !Array.isArray(value[key])) {
      issues.push(issue('error', 'shape', null, `"${key}" must be an array when present`))
    }
  }

  // The load-bearing refusal: no coordinate speaks, anywhere, at any level.
  const smuggled = new Set<string>([...coordinateKeysIn(value)])
  for (const node of Array.isArray(value.nodes) ? value.nodes : []) {
    for (const k of coordinateKeysIn(node)) smuggled.add(k)
  }
  for (const k of smuggled) {
    issues.push(issue('error', 'coordinate', null, `coordinate field "${k}" has no place in a scene — layout is computed (§3, §6.2)`))
  }

  if (issues.some((i) => i.level === 'error')) return { scene: null, issues }

  const raw = value as unknown as Scene
  const scene: Scene = {
    form: raw.form,
    title: raw.title,
    caption: raw.caption,
    source: raw.source,
    axes: raw.axes ? { yLow: raw.axes.yLow, yHigh: raw.axes.yHigh } : null,
    nodes: (raw.nodes ?? []).map((n) => ({
      id: n.id,
      unit: n.unit ?? null,
      source: n.source ?? null,
      atom: n.atom ?? null,
      text: n.text,
      slot: n.slot ?? null,
      rank: n.rank ?? null,
    })),
    edges: (raw.edges ?? []).map((e) => ({ from: e.from, to: e.to, kind: e.kind, feedback: e.feedback === true })),
    groups: (raw.groups ?? []).map((g) => ({ id: g.id, label: g.label, nodes: [...(g.nodes ?? [])] })),
  }
  return { scene, issues }
}

/** Which slots each form may use. */
const FORM_SLOTS: Record<SceneForm, readonly SceneSlot[]> = {
  spine: ['column', 'margin', 'inset'],
  delta: ['received', 'mine'],
  field: [],
  genealogy: [],
  mechanism: [],
  band: [],
}

export function validateScene(scene: Scene, trace: Trace): SceneIssue[] {
  const issues: SceneIssue[] = []
  const units = new Map(trace.units.map((u) => [u.id, u]))
  const sources = new Map(trace.sources.map((s) => [s.id, s]))
  const nodeIds = new Set<string>()

  if (scene.form === 'field') {
    if (!scene.axes || typeof scene.axes.yLow !== 'string' || typeof scene.axes.yHigh !== 'string' || scene.axes.yLow === '' || scene.axes.yHigh === '') {
      issues.push(issue('error', 'form', null, `a field declares its y-axis: axes: { yLow, yHigh } (x is always abstraction)`))
    }
  } else if (scene.axes !== null) {
    issues.push(issue('error', 'form', null, `axes belong to the field form only`))
  }

  for (const node of scene.nodes) {
    if (nodeIds.has(node.id)) issues.push(issue('error', 'node', node.id, `duplicate node id ${node.id}`))
    nodeIds.add(node.id)

    // §9.3: /draw may not invent. Every node references something that exists
    // in the trace — a unit, or (genealogy only) a source.
    if (node.unit !== null && node.source !== null) {
      issues.push(issue('error', 'unit', node.id, `a node points at a unit or a source, never both`))
    } else if (node.source !== null) {
      if (scene.form !== 'genealogy') {
        issues.push(issue('error', 'unit', node.id, `source nodes exist only in a genealogy`))
      }
      if (!sources.has(node.source)) {
        issues.push(issue('error', 'unit', node.id, `node references source "${node.source}" which is not in the trace`))
      }
      if (node.atom !== null) {
        issues.push(issue('error', 'untyped', node.id, `a source is not an atom and carries no atom type (§5.4)`))
      }
    } else if (node.unit === null) {
      issues.push(issue('error', 'unit', node.id, `node references no unit — nothing invented (§9.3)`))
    } else {
      const unit = units.get(node.unit)
      if (!unit) {
        issues.push(issue('error', 'unit', node.id, `node references unit "${node.unit}" which is not in the trace — nothing invented`))
      }
      if (node.atom === null || !(ATOM_TYPES as readonly string[]).includes(node.atom)) {
        issues.push(issue('error', 'untyped', node.id, `node atom "${String(node.atom)}" is not one of the four`))
      } else if (unit && unit.atom !== node.atom) {
        issues.push(issue('error', 'untyped', node.id, `node atom "${node.atom}" disagrees with unit ${unit.id}'s "${unit.atom}"`))
      }
      if (scene.form === 'delta') {
        const holder = unit?.holder ?? null
        if (node.slot === 'received' && holder !== 'received') {
          issues.push(issue('error', 'slot', node.id, `unit ${node.unit} is not held by "received" — the delta must not manufacture a strawman`))
        }
        if (node.slot === 'mine' && holder !== 'mine') {
          issues.push(issue('error', 'slot', node.id, `unit ${node.unit} is not held by "mine"`))
        }
      }
    }

    const allowed = FORM_SLOTS[scene.form]
    if (node.slot !== null && !allowed.includes(node.slot)) {
      issues.push(issue('error', 'slot', node.id, `slot "${node.slot}" is not valid in a ${scene.form}`))
    }
    if (scene.form === 'spine' && node.slot === null) {
      issues.push(issue('error', 'slot', node.id, `a spine node needs a slot: column, margin, or inset`))
    }
    if (scene.form === 'delta' && node.slot === null) {
      issues.push(issue('error', 'slot', node.id, `a delta node needs a slot: received or mine`))
    }

    if (scene.form === 'field') {
      if (!node.rank || !Number.isInteger(node.rank.x) || !Number.isInteger(node.rank.y) || node.rank.x < 1 || node.rank.y < 1) {
        issues.push(issue('error', 'rank', node.id, `a field node needs ordinal ranks {x: 1..n, y: 1..n}`))
      }
    } else if (node.rank !== null) {
      issues.push(issue('error', 'rank', node.id, `rank is field-only; a ${scene.form} node may not carry one`))
    }
  }

  for (const [i, edge] of scene.edges.entries()) {
    const at = `edges[${i}]`
    if (!nodeIds.has(edge.from)) issues.push(issue('error', 'edge', at, `edge.from "${edge.from}" is not a node`))
    if (!nodeIds.has(edge.to)) issues.push(issue('error', 'edge', at, `edge.to "${edge.to}" is not a node`))
    if (!(TRACE_RELATION_KINDS as readonly string[]).includes(edge.kind)) {
      issues.push(issue('error', 'edge', at, `edge kind "${String(edge.kind)}" is not in the vocabulary`))
    }
    if (edge.feedback && scene.form !== 'mechanism') {
      issues.push(issue('error', 'edge', at, `feedback edges exist only in a mechanism`))
    }
    if (scene.form === 'delta') {
      // E18: the correspondence runs Mine (start) → Received (end), and it
      // means "this answers that". A backwards edge must fail here, visibly,
      // not work silently and entrench an inconsistent canvas.
      const from = scene.nodes.find((n) => n.id === edge.from)
      const to = scene.nodes.find((n) => n.id === edge.to)
      if (edge.kind !== 'answers') {
        issues.push(issue('error', 'edge', at, `delta edges are correspondences: kind "answers" only`))
      }
      if (from && from.slot !== 'mine') issues.push(issue('error', 'edge', at, `a correspondence starts at a Mine card (E18)`))
      if (to && to.slot !== 'received') issues.push(issue('error', 'edge', at, `a correspondence ends at a Received card (E18)`))
    }
  }

  const groupIds = new Set<string>()
  for (const group of scene.groups) {
    if (groupIds.has(group.id)) issues.push(issue('error', 'group', group.id, `duplicate group id ${group.id}`))
    groupIds.add(group.id)
    for (const id of group.nodes) {
      if (!nodeIds.has(id)) issues.push(issue('error', 'group', group.id, `group lists unknown node "${id}"`))
    }
  }

  return issues
}
