import type { Scene } from '../scene-types'
import type { Trace } from '../trace-types'
import type { CorpusAssembly } from '../corpus-types'

/**
 * The band form (M6_GENERATIVE.md §5.6, E41.10): no shapes. A band scene
 * compiles to `corpus/<slug>.assembly.json`, and M5's corpus wall renders it
 * against the others with zero new canvas code — which is what "reuses M5
 * wholesale" means once you notice the wall's input is a file.
 *
 * Classification here is not the guessing §8 forbids: the atoms come out of a
 * trace Jordan has reviewed. Weight is the span's real footprint in the pile —
 * the characters he actually wrote — counted in words, in essay order.
 */

function wordsIn(text: string): number {
  return text.split(/\s+/).filter((w) => w !== '').length
}

export function bandAssembly(scene: Scene, trace: Trace): CorpusAssembly {
  const units = new Map(trace.units.map((u) => [u.id, u]))
  const chosen = scene.nodes
    .map((n) => units.get(n.unit ?? ''))
    .filter((u): u is NonNullable<typeof u> => u !== undefined)
    .sort((a, b) => a.span.start - b.span.start)

  return {
    slug: trace.slug,
    title: scene.title,
    units: chosen.map((u) => ({ atom: u.atom, words: wordsIn(u.span.quote), text: u.text })),
    mine: true,
  }
}
