import type { AtomType } from './types'

/**
 * The readout contract (BUILD.md §7 Stage 5). Shared by the pure core, the
 * in-app ⌘R path, and the node CLI so the two write edges cannot drift.
 */

/** A .tldr document snapshot: the `document` half of `getSnapshot(store)`. */
export interface StoreDocument {
  store: Record<string, TldrRecord>
  schema: unknown
}

/** Only the fields readout actually reads. The snapshot carries far more. */
export interface TldrRecord {
  id: string
  typeName: string
  type?: string
  parentId?: string
  x?: number
  y?: number
  props?: Record<string, unknown>
  fromId?: string
  toId?: string
  index?: string
  /** Arrows carry `{ relation }` here; see src/relations.ts. */
  meta?: Record<string, unknown>
}

export interface ReadoutOptions {
  slug: string
  /**
   * ISO-8601. Injected, never read from a clock inside the pure core — a
   * `Date.now()` in there would make readout non-deterministic and the
   * byte-identical gate unprovable.
   */
  generated: string
}

/** One card, as the map and the assembly program both see it. */
export interface AssemblyUnit {
  id: string
  atom: AtomType
  text: string
  /** The frame it sits in, or null when unplaced. */
  section: string | null
  /** 1-based position in reading order across the whole essay. */
  position: number
}

export interface AssemblyTicket {
  id: string
  text: string
  /** `ticket` for an open question, `gap` for a computed absence (§9). */
  kind: 'ticket' | 'gap'
}

/** `out/<slug>/assembly.json` — the machine-readable twin of map.md. */
export interface Assembly {
  essay: string
  title: string
  generated: string
  source: string
  cards: number
  untyped: number
  sections: string[]
  units: AssemblyUnit[]
  tickets: AssemblyTicket[]
  /** The atom sequence, e.g. ['stance', 'claim', 'move']. */
  program: AtomType[]
}

export interface ReadoutResult {
  mapMd: string
  assembly: Assembly
}

/**
 * `on-the-metabolism-of-attention` becomes `On the metabolism of attention`.
 * Sentence case, per the brand: titles capitalize like a sentence.
 */
export function titleFromSlug(slug: string): string {
  const words = slug.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
