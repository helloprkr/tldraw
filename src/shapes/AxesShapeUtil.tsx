import { HTMLContainer, Rectangle2d, ShapeUtil, T } from 'tldraw'
import type { RecordProps, TLFontFace, TLShape } from 'tldraw'

/**
 * The field's axes (M6_GENERATIVE.md §5.3): two hairline bone rules crossing
 * at the center, mono uppercase pole labels at the extremes in ink-3. No
 * gridlines, no quadrant tints — the argument is the placement, and the axes
 * only say what placement means.
 *
 * A custom shape rather than line-and-text primitives because everything that
 * must survive into a plate needs a real toSvg (E10, E38's foreignObject
 * caveat), and the theme collapses primitive colors to ink, which is not bone.
 */

export type AxesShape = TLShape<'axes'>

/** Token literals, same posture as AtomShapeUtil. */
const BONE = '#d6c9ad'
const INK_3 = '#6b5a4c'
const MONO_FAMILY = "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace"

const LABEL_SIZE = 12 /* --t-meta */
const LABEL_H = 16
const TRACKING = '0.12em' /* --tk-wider */
const INSET = 8 /* --s-2, label clearance off a rule */

interface AxisLabel {
  text: string
  x: number
  y: number
  anchor: 'start' | 'end'
}

/** One geometry for DOM and SVG: the two rules and the four pole labels. */
function axesLayout(w: number, h: number, p: AxesShape['props']) {
  const cx = Math.round(w / 2) + 0.5
  const cy = Math.round(h / 2) + 0.5
  const labels: AxisLabel[] = [
    { text: p.xLow.toUpperCase(), x: 0, y: cy + INSET, anchor: 'start' },
    { text: p.xHigh.toUpperCase(), x: w, y: cy + INSET, anchor: 'end' },
    { text: p.yHigh.toUpperCase(), x: cx + INSET, y: 0, anchor: 'start' },
    { text: p.yLow.toUpperCase(), x: cx + INSET, y: h - LABEL_H, anchor: 'start' },
  ]
  return { cx, cy, labels }
}

export class AxesShapeUtil extends ShapeUtil<AxesShape> {
  static override type = 'axes' as const

  static override props: RecordProps<AxesShape> = {
    w: T.number,
    h: T.number,
    xLow: T.string,
    xHigh: T.string,
    yLow: T.string,
    yHigh: T.string,
  }

  getDefaultProps(): AxesShape['props'] {
    return { w: 800, h: 600, xLow: 'concrete', xHigh: 'abstract', yLow: '', yHigh: '' }
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

  // The axes sit under the cards and never steal their clicks.
  override canBind() {
    return false
  }

  override getGeometry(shape: AxesShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: false })
  }

  override getFontFaces(): TLFontFace[] {
    return [
      {
        family: 'JetBrains Mono',
        src: { url: '/fonts/jetbrains-mono-latin-500-normal.woff2', format: 'woff2' },
        weight: '500',
        style: 'normal',
      },
    ]
  }

  override getIndicatorPath(shape: AxesShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  component(shape: AxesShape) {
    const { w, h } = shape.props
    const { cx, cy, labels } = axesLayout(w, h, shape.props)
    return (
      <HTMLContainer className="ec-axes">
        <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
          <line x1={0} y1={cy} x2={w} y2={cy} stroke={BONE} strokeWidth={1} />
          <line x1={cx} y1={0} x2={cx} y2={h} stroke={BONE} strokeWidth={1} />
          {labels.map((l, i) => (
            <text
              key={i}
              x={l.x}
              y={l.y + LABEL_H / 2}
              textAnchor={l.anchor}
              dominantBaseline="central"
              fontFamily={MONO_FAMILY}
              fontSize={LABEL_SIZE}
              fontWeight={500}
              letterSpacing={TRACKING}
              fill={INK_3}
            >
              {l.text}
            </text>
          ))}
        </svg>
      </HTMLContainer>
    )
  }

  override toSvg(shape: AxesShape) {
    const { w, h } = shape.props
    const { cx, cy, labels } = axesLayout(w, h, shape.props)
    return (
      <g>
        <line x1={0} y1={cy} x2={w} y2={cy} stroke={BONE} strokeWidth={1} />
        <line x1={cx} y1={0} x2={cx} y2={h} stroke={BONE} strokeWidth={1} />
        {labels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={l.y + LABEL_H / 2}
            textAnchor={l.anchor}
            dominantBaseline="central"
            fontFamily={MONO_FAMILY}
            fontSize={LABEL_SIZE}
            fontWeight={500}
            letterSpacing={TRACKING}
            fill={INK_3}
          >
            {l.text}
          </text>
        ))}
      </g>
    )
  }
}
