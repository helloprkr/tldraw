/**
 * Two different relations are drawn with the same native arrow binding, and they
 * must never mix (Jordan, 2026-07-31):
 *
 * - `dependency` — Compose's B. "This claim needs that one to land first" (§6.3).
 *   topo.ts reads these to order the essay and to raise the unsupported warning.
 * - `correspondence` — DeltaView's B. "This answers that" (§9). delta.ts reads
 *   these to decide which Received cards are still unanswered.
 *
 * Letting them share a graph corrupts both: a correspondence edge reaching
 * topo.ts fabricates unsupported-claim warnings, and a dependency edge reaching
 * DeltaView silently marks a Received card as answered when nothing answers it.
 *
 * The relation is stamped on the arrow's `meta` at creation, and every consumer
 * filters on it. Arrows written before this rule existed carry no `relation`
 * key and read as `dependency`, which is what they were.
 */

export const RELATIONS = ['dependency', 'correspondence'] as const

export type Relation = (typeof RELATIONS)[number]

export const DEFAULT_RELATION: Relation = 'dependency'

/** Shape of the meta we write onto an arrow. */
export interface RelationMeta {
  relation: Relation
}

export function relationOf(meta: unknown): Relation {
  if (meta && typeof meta === 'object') {
    const value = (meta as Record<string, unknown>).relation
    if (value === 'correspondence' || value === 'dependency') return value
  }
  // Legacy arrows predate the stamp; they were all dependencies.
  return DEFAULT_RELATION
}

export function isRelation(meta: unknown, relation: Relation): boolean {
  return relationOf(meta) === relation
}
