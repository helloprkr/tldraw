import { EASINGS, atom, createShapeId } from 'tldraw'
import type { Editor, Signal, TLPageId, TLShape } from 'tldraw'
import { assemblyFileName, classifyUnit, parseAssembly, toBands } from './corpus'
import { readCorpus, writeCorpusAssembly } from './essayFs'
import { serializeJson } from './serialize'
import { currentView } from './views'
import { BAND_GAP, CORPUS_PAGE } from '../corpus-types'
import { BAND_SHAPE_H, BAND_SHAPE_W, bandSegmentIndexAt } from '../shapes/BandShapeUtil'
import type { BandShape } from '../shapes/BandShapeUtil'
import type { CorpusAssembly, UnitAtom } from '../corpus-types'

/**
 * The corpus wall (BUILD.md §8), as a route.
 *
 * Its own page, like the delta: three essays by one writer become three bands
 * and Jordan's becomes a fourth, and none of that belongs on the compose
 * canvas. Bands are rebuilt from `corpus/` on every open — the files are the
 * record, the canvas is the rendering, and a stale band would be a lie about
 * what is on disk.
 */

const CAMERA = { animation: { duration: 420, easing: EASINGS.easeOutCubic } }
const PITCH = BAND_SHAPE_H + BAND_GAP

function findPage(editor: Editor, name: string): TLPageId | null {
  return editor.getPages().find((page) => page.name === name)?.id ?? null
}

export function isCorpusPage(editor: Editor): boolean {
  return currentView(editor) === 'corpus'
}

/** Every assembly in corpus/, in the order the wall stacks them. */
export async function loadAssemblies(): Promise<CorpusAssembly[]> {
  const files = await readCorpus()
  const assemblies: CorpusAssembly[] = []
  for (const file of files) {
    if (!file.name.endsWith('.assembly.json')) continue
    const parsed = parseAssembly(file.content, file.name.replace('.assembly.json', ''))
    if (parsed) assemblies.push(parsed)
  }
  return assemblies
}

/** `⌘⇧C`. Rebuilds the wall from disk each time. */
export async function openCorpusWall(editor: Editor): Promise<{ bands: number }> {
  const existing = findPage(editor, CORPUS_PAGE)
  if (existing) {
    editor.setCurrentPage(existing)
  } else {
    editor.createPage({ name: CORPUS_PAGE })
    const created = findPage(editor, CORPUS_PAGE)
    if (!created) return { bands: 0 }
    editor.setCurrentPage(created)
  }

  const bands = toBands(await loadAssemblies())

  editor.run(
    () => {
      const stale = editor.getCurrentPageShapes()
      if (stale.length) editor.deleteShapes(stale.map((s) => s.id))

      bands.forEach((band, index) => {
        editor.createShape({
          id: createShapeId(),
          type: 'band',
          x: 0,
          y: index * PITCH,
          props: {
            w: BAND_SHAPE_W,
            h: BAND_SHAPE_H,
            title: band.title,
            segments: band.segments,
            mine: band.mine,
            slug: band.slug,
          },
        })
      })
    },
    { history: 'ignore' }
  )

  editor.zoomToFit(CAMERA)
  return { bands: bands.length }
}

export interface PickedSegment {
  slug: string
  index: number
}

/**
 * The segment Jordan last clicked. §8's gesture is "click a segment, press
 * 1-4", so the judgment has to attach to what he pointed at, not to wherever
 * the cursor happens to rest when the key goes down — otherwise nudging the
 * mouse between the click and the keystroke silently types the wrong paragraph.
 *
 * It is also what the margin panel reads to show the source text.
 */
const picked = atom<PickedSegment | null>('corpus.pickedSegment', null)

export const pickedSegment: Signal<PickedSegment | null> = picked

export function pickSegment(editor: Editor, shape: TLShape, pagePoint: { x: number; y: number }) {
  const local = editor.getPointInShapeSpace(shape, pagePoint)
  const index = bandSegmentIndexAt(shape as BandShape, local)
  const slug = (shape.props as { slug?: string }).slug
  picked.set(index === null || !slug ? null : { slug, index })
}

export function clearPickedSegment(): void {
  picked.set(null)
}

/**
 * §8's round trip: classify a segment on the canvas and the judgment lands in
 * `corpus/<slug>.assembly.json`. Disk is the record, so the file is rewritten
 * from the file — read, amend, write — rather than from whatever the canvas
 * happens to hold. The band is then rebuilt from what was actually written.
 */
export async function classifySelectedSegment(
  editor: Editor,
  judgment: UnitAtom
): Promise<{ slug: string; unit: number } | null> {
  const target = picked.get()
  if (!target) return null
  const { slug, index: unit } = target

  const files = await readCorpus()
  const name = assemblyFileName(slug)
  const file = files.find((f) => f.name === name)
  if (!file) return null

  const assembly = parseAssembly(file.content, slug)
  if (!assembly) return null

  const next = classifyUnit(assembly, unit, judgment)
  await writeCorpusAssembly(name, serializeJson(next))
  await openCorpusWall(editor)
  // The wall is rebuilt from disk, so the old shape is gone; the judgment still
  // belongs to the same paragraph.
  picked.set({ slug, index: unit })

  return { slug, unit }
}

/** The clicked segment's source text, for the margin panel (§8). */
export function pickedUnitText(assemblies: CorpusAssembly[], target: PickedSegment | null): string {
  if (!target) return ''
  const assembly = assemblies.find((a) => a.slug === target.slug)
  return assembly?.units[target.index]?.text ?? ''
}
