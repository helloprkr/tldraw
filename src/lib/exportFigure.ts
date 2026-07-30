import { createShapeId, getSnapshot } from 'tldraw'
import type { Editor, TLShapeId } from 'tldraw'
import { captionHeight } from '../shapes/PlateShapeUtil'
import {
  addFigure,
  captionSlug,
  figureFileNames,
  hashSource,
  nextFigureNumber,
  parseRegistry,
} from './figures'
import { serializeJson } from './serialize'
import { nowStamp } from './stamp'
import { readOut, writeOut } from './essayFs'
import { PLATE_PAD } from '../figure-types'
import type { FigureRecord } from '../figure-types'

/**
 * Stage 7 — export the figure (BUILD.md §10).
 *
 * The plate is a real shape placed behind the selection, not a CSS wrapper and
 * not a post-processed SVG: E10 says anything that must appear in an exported
 * figure has to be a display value, a shape prop, or toSvg output. Making the
 * wrapper a shape means the same geometry produces the SVG and the PNG, and
 * neither can drift from what the canvas shows.
 *
 * §10 describes cloning the selection onto an offscreen plate. Cloning is not
 * needed to get there: the plate is created behind the shapes already selected,
 * both are handed to the exporter by id, and the plate is removed afterwards.
 * That is the same figure with nothing copied, and Jordan's shapes are never
 * touched.
 */

export interface ExportResult {
  number: number
  svgPath: string
  pngPath: string
}

/** Everything the export writes lives under this, per §4's tree. */
const FIGURES_DIR = 'figures'
const REGISTRY_PATH = `${FIGURES_DIR}/figures.json`

function base64FromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('could not read png'))
    reader.onload = () => {
      const result = String(reader.result)
      // strip the `data:image/png;base64,` prefix the plugin does not want
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(blob)
  })
}

export async function exportFigure(
  editor: Editor,
  slug: string,
  caption: string,
  paragraph: string | null
): Promise<ExportResult> {
  const selected = editor.getSelectedShapeIds()
  if (selected.length === 0) throw new Error('nothing selected')

  const bounds = editor.getSelectionPageBounds()
  if (!bounds) throw new Error('selection has no bounds')

  const raw = await readOut(slug, REGISTRY_PATH)
  const registry = parseRegistry(raw, slug)

  // A registry that had bytes but yielded no rows was unreadable. Numbering
  // would restart at 1 and the next write would overwrite an already-published
  // fig-01. Keep the damaged file rather than silently paving over it; a pure
  // module cannot do this itself, so it is done here at the I/O edge.
  if (raw && raw.trim() !== '' && registry.figures.length === 0) {
    await writeOut(slug, [
      { path: `${FIGURES_DIR}/figures.unreadable-${nowStamp()}.json`, content: raw },
    ])
  }

  const number = nextFigureNumber(registry)
  const fileSlug = captionSlug(caption)
  const files = figureFileNames(number, fileSlug)

  const plateId = createShapeId()
  const plateW = bounds.w + PLATE_PAD * 2
  const capH = captionHeight(caption, number, editor, plateW)

  let svg: string | undefined
  let png: Blob | undefined

  try {
    // history: 'ignore' — the plate is scaffolding. It must never appear in
    // Jordan's undo stack, and it must never outlive this function.
    editor.run(
      () => {
        editor.createShape({
          id: plateId,
          type: 'plate',
          x: bounds.x - PLATE_PAD,
          y: bounds.y - PLATE_PAD,
          props: {
            w: plateW,
            h: bounds.h + PLATE_PAD * 2 + capH,
            caption,
            figureNumber: number,
            paragraph: paragraph ?? '',
          },
        })
        editor.sendToBack([plateId])
      },
      { history: 'ignore' }
    )

    const ids: TLShapeId[] = [plateId, ...selected]

    // The plate is the boundary, so no extra padding and no background fill:
    // its own ground is the paper.
    const svgResult = await editor.getSvgString(ids, {
      background: false,
      padding: 0,
      scale: 1,
    })
    if (!svgResult) throw new Error('svg export returned nothing')
    svg = svgResult.svg

    // Both formats, always: SVG for Substack and the reader kit, PNG for X,
    // which will not render SVG (§10).
    const pngResult = await editor.toImage(ids, {
      format: 'png',
      background: false,
      padding: 0,
      scale: 1,
      pixelRatio: 2,
    })
    png = pngResult.blob
  } finally {
    editor.run(() => editor.deleteShapes([plateId]), { history: 'ignore' })
  }

  const { document } = getSnapshot(editor.store)
  const record: FigureRecord = {
    number,
    caption,
    slug: fileSlug,
    paragraph: paragraph && paragraph.trim() !== '' ? paragraph : null,
    shapeIds: [...selected],
    created: nowStamp(),
    sourceHash: hashSource(serializeJson(document)),
    files: { svg: `${FIGURES_DIR}/${files.svg}`, png: `${FIGURES_DIR}/${files.png}` },
  }

  await writeOut(slug, [
    { path: record.files.svg, content: svg },
    { path: record.files.png, contentBase64: await base64FromBlob(png) },
    { path: REGISTRY_PATH, content: serializeJson(addFigure(registry, record)) },
  ])

  return {
    number,
    svgPath: `out/${slug}/${record.files.svg}`,
    pngPath: `out/${slug}/${record.files.png}`,
  }
}
