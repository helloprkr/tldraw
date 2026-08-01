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
  /** The trace unit this node renders. A node with no unit is a lint failure (§9.3). */
  unit: string
  atom: TraceAtom
  text: string
  /** spine: column|margin|inset. delta: received|mine. Others: null. */
  slot: SceneSlot | null
  /** Ordinal ranks, `field` form only. Never pixels. */
  rank: { x: number; y: number } | null
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
    nodes: (raw.nodes ?? []).map((n) => ({
      id: n.id,
      unit: n.unit,
      atom: n.atom,
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
  const nodeIds = new Set<string>()

  for (const node of scene.nodes) {
    if (nodeIds.has(node.id)) issues.push(issue('error', 'node', node.id, `duplicate node id ${node.id}`))
    nodeIds.add(node.id)

    // §9.3: /draw may not invent. Every node references a unit that exists.
    const unit = units.get(node.unit)
    if (!unit) {
      issues.push(issue('error', 'unit', node.id, `node references unit "${node.unit}" which is not in the trace — nothing invented`))
    }
    if (!(ATOM_TYPES as readonly string[]).includes(node.atom)) {
      issues.push(issue('error', 'untyped', node.id, `node atom "${String(node.atom)}" is not one of the four`))
    } else if (unit && unit.atom !== node.atom) {
      issues.push(issue('error', 'untyped', node.id, `node atom "${node.atom}" disagrees with unit ${unit.id}'s "${unit.atom}"`))
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
