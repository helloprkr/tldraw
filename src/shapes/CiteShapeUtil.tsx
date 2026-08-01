import { HTMLContainer, Rectangle2d, ShapeUtil, T, resizeBox, resolveLineHeightPx } from 'tldraw'
import type { RecordProps, TLResizeInfo, TLFontFace, TLShape } from 'tldraw'

/**
 * A citation card (M6_GENERATIVE.md §5.4). Sources in a genealogy are not
 * Jordan's atoms and must not wear atom pigments: paper-deep ground, ink-3
 * mono text, no top rule, no eyebrow. The pigments begin where his thinking
 * begins — this card's plainness is the contrast that makes the form read.
 */

export type CiteShape = TLShape<'cite'>

/** Token literals, same posture as AtomShapeUtil. */
const PAPER_DEEP = '#e0d4ba'
const INK_3 = '#6b5a4c'
const MONO_FAMILY = "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace"

const PAD = 16 /* --s-4 */
const TEXT_SIZE = 12 /* --t-meta */
const LEADING = 1.5 /* --lh-normal */
const LINE_H = resolveLineHeightPx(TEXT_SIZE, LEADING)
/** JetBrains Mono's advance is exactly 0.6em; at 12px, 7.2px per character. */
export const CITE_ADVANCE = TEXT_SIZE * 0.6
export const CITE_LINE_H = 18 /* resolveLineHeightPx(12, 1.5), transcribed for the pure core */
export const CITE_PAD = PAD

const MIN_W = 160
const MIN_H = PAD * 2 + LINE_H

/** Monospace makes wrapping arithmetic: greedy fill at a fixed advance. */
function wrapMono(text: string, width: number): string[] {
  const perLine = Math.max(1, Math.floor(width / CITE_ADVANCE))
  const words = text.split(/\s+/).filter((w) => w !== '')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line === '') line = word
    else if (line.length + 1 + word.length <= perLine) line += ` ${word}`
    else {
      lines.push(line)
      line = word
    }
  }
  if (line !== '') lines.push(line)
  return lines
}

export class CiteShapeUtil extends ShapeUtil<CiteShape> {
  static override type = 'cite' as const

  static override props: RecordProps<CiteShape> = {
    w: T.number,
    h: T.number,
    text: T.string,
  }

  getDefaultProps(): CiteShape['props'] {
    return { w: 260, h: 66, text: '' }
  }

  override canResize() {
    return true
  }

  override hideRotateHandle() {
    return true
  }

  override canEdit() {
    return false
  }

  override canBind() {
    return true
  }

  override onResize(shape: CiteShape, info: TLResizeInfo<CiteShape>) {
    return resizeBox(shape, info, { minWidth: MIN_W, minHeight: MIN_H })
  }

  override getGeometry(shape: CiteShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override getFontFaces(): TLFontFace[] {
    return [
      {
        family: 'JetBrains Mono',
        src: { url: '/fonts/jetbrains-mono-latin-400-normal.woff2', format: 'woff2' },
        weight: '400',
        style: 'normal',
      },
    ]
  }

  override getIndicatorPath(shape: CiteShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  component(shape: CiteShape) {
    const { w, h, text } = shape.props
    return (
      <HTMLContainer className="ec-cite">
        <div
          style={{
            width: w,
            height: h,
            background: 'var(--paper-deep)',
            color: 'var(--ink-3)',
            fontFamily: MONO_FAMILY,
            fontSize: TEXT_SIZE,
            lineHeight: `${LINE_H}px`,
            padding: PAD,
            boxSizing: 'border-box',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {text}
        </div>
      </HTMLContainer>
    )
  }

  override toSvg(shape: CiteShape) {
    const { w, h, text } = shape.props
    const lines = wrapMono(text, w - PAD * 2)
    return (
      <g>
        <rect width={w} height={h} rx={2} fill={PAPER_DEEP} />
        <text fontFamily={MONO_FAMILY} fontSize={TEXT_SIZE} fill={INK_3} dominantBaseline="central">
          {lines.map((line, i) => (
            <tspan key={i} x={PAD} y={PAD + i * LINE_H + LINE_H / 2}>
              {line.replace(/\s/g, ' ')}
            </tspan>
          ))}
        </text>
      </g>
    )
  }
}
