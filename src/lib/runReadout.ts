import { getSnapshot } from 'tldraw'
import type { Editor } from 'tldraw'
import { readout } from './readout'
import { serializeJson } from './serialize'
import { writeOut } from './essayFs'
import type { StoreDocument } from '../readout-types'

/**
 * Stage 5 — read out, from the live canvas (BUILD.md §7). The node CLI does the
 * same three steps against the same snapshot on disk.
 *
 * Both edges call the same pure `readout()` and the same `serializeJson`, which
 * is what lets the M2 gate diff their output byte for byte. The clock is read
 * here, at the edge, and injected — never inside the pure core.
 */
export async function runReadout(editor: Editor, slug: string): Promise<{ cards: number }> {
  const { document } = getSnapshot(editor.store)
  const result = readout(document as unknown as StoreDocument, {
    slug,
    generated: new Date().toISOString(),
  })

  await writeOut(slug, [
    { path: 'map.md', content: result.mapMd },
    { path: 'assembly.json', content: serializeJson(result.assembly) },
  ])

  return { cards: result.assembly.cards }
}
