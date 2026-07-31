import { HTMLContainer, Rectangle2d, ShapeUtil, T, resizeBox, resolveLineHeightPx } from 'tldraw'
import type { RecordProps, SvgExportContext, TLFontFace, TLResizeInfo, TLShape } from 'tldraw'
import { GAP_LABEL } from '../delta-types'
import { CARD_H, CARD_W, TERRACOTTA } from '../types'
import './gap.css'

/**
 * The hole — BUILD.md §9. A Received card that nothing answers is replaced by
 * one of these: a card's footprint with no card in it. Empty, unfilled, a
 * terracotta hairline, so a row of cards reads as having a missing tooth.
 *
 * Everything here is subtraction. There is no ground rect, no pigment rule, no
 * baseline meta: the canvas paper shows through the frame, which is the entire
 * point of the component.
 */

export type GapShape = TLShape<'gap'>

/**
 * The SVG export cannot read CSS custom properties, and the text measurer needs
 * the same family string the DOM resolves. These literals transcribe tokens.css;
 * they are not new values. Same posture as theme.ts and AtomShapeUtil.
 */
const INK_4 = '#9a8a78'

const BODY_FAMILY = "'EB Garamond', 'Iowan Old Style', 'Charter', Georgia, serif"
const MONO_FAMILY = "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace"
/** tokens.css sets these on `body`; stating them explicitly keeps DOM, measurer and SVG in step. */
const FEATURES = "'kern', 'liga', 'onum', 'pnum'"

/** --tk-wider, the uppercase mono label tracking. */
const EYEBROW_TRACKING = '0.12em'

/**
 * The card's own spacing, repeated rather than shared, because a gap stands
 * where a card would: in a row of Received cards the eyebrows must sit on one
 * line, so the vertical rhythm down to the body is the card's exactly —
 * including the band the card's pigment rule occupies, which here stays empty.
 */
const PAD = 16 /* --s-4 */
const RULE_BAND = 1 /* where the card's pigment rule sits; a gap has no type */
const GAP_RULE = 12 /* --s-3, rule to eyebrow */
const GAP_EYEBROW = 12 /* --s-3, eyebrow to body */
const LABEL_H = 16
const LABEL_SIZE = 12 /* --t-meta */
const BODY_SIZE = 17 /* --t-body-sm */
const BODY_LEADING = 1.5 /* --lh-normal */
/** E4: the measurer snaps leading to whole pixels; DOM, measure and export must all take it from here. */
const BODY_LINE_H = resolveLineHeightPx(BODY_SIZE, BODY_LEADING)

const MIN_W = 200
/** One quoted line is the floor: below it the gap would name nothing. */
const MIN_H = PAD + RULE_BAND + GAP_RULE + LABEL_H + GAP_EYEBROW + BODY_LINE_H + PAD

/**
 * The dash rhythm. A hairline at Chrome's `border-style: dashed` is a 3px-on,
 * 3px-off UI convention; this is twice as open, and reads as a rule someone
 * drew by hand where a card was going to go.
 */
const DASH = 8 /* --s-2 */
const DASH_GAP = 8 /* --s-2, nominal only — see fitDash */

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * CSS `border-style: dashed` and SVG `stroke-dasharray` disagree by
 * construction: the dash length of a CSS border is the user agent's business
 * and it silently rescales the pattern to fit each side, while an SVG dash
 * array is literal and lets the pattern fall wherever the geometry ends. So
 * the canvas does not use a CSS border at all — `component` draws the same four
 * stroked lines the export draws, from this one function, and the two cannot
 * drift because there is only one description of the frame.
 *
 * The fit is the part a CSS border was doing for free: a run of `length` gets
 * whole dashes only, with the gap stretched to absorb the remainder, so every
 * side begins and ends on a dash and the four corners close.
 */
function fitDash(length: number): string {
  const count = Math.floor((length + DASH_GAP) / (DASH + DASH_GAP))
  if (count < 2) return String(round2(length))
  return `${DASH} ${round2((length - count * DASH) / (count - 1))}`
}

interface FrameLine {
  x1: number
  y1: number
  x2: number
  y2: number
  dash: string
}

/**
 * The hairline, on the half pixel so a 1px stroke lands on one device row.
 * Each side is its own run starting at a corner, which is what lets the dashes
 * meet cleanly there instead of bending a dash around the turn.
 */
function gapFrame(w: number, h: number): FrameLine[] {
  const right = Math.max(0.5, w - 0.5)
  const bottom = Math.max(0.5, h - 0.5)
  const across = fitDash(right - 0.5)
  const down = fitDash(bottom - 0.5)
  return [
    { x1: 0.5, y1: 0.5, x2: right, y2: 0.5, dash: across },
    { x1: 0.5, y1: bottom, x2: right, y2: bottom, dash: across },
    { x1: 0.5, y1: 0.5, x2: 0.5, y2: bottom, dash: down },
    { x1: right, y1: 0.5, x2: right, y2: bottom, dash: down },
  ]
}

interface GapLayout {
  padX: number
  textW: number
  eyebrowTop: number
  labelH: number
  bodyTop: number
  bodyH: number
  maxLines: number
}

/**
 * One layout, consumed by both `component` and `toSvg`. The two renderings must
 * be pixel-identical — a delta figure is exactly the kind of plate §10 exists
 * for — so neither is allowed its own idea of where anything sits.
 */
function gapLayout(w: number, h: number): GapLayout {
  const eyebrowTop = PAD + RULE_BAND + GAP_RULE
  const bodyTop = eyebrowTop + LABEL_H + GAP_EYEBROW
  // No baseline meta: a gap has no date and no ordinal of its own, so the
  // quoted text runs to the bottom margin.
  const available = Math.max(BODY_LINE_H, h - PAD - bodyTop)
  const maxLines = Math.max(1, Math.floor(available / BODY_LINE_H))
  return {
    padX: PAD,
    textW: Math.max(1, w - PAD * 2),
    eyebrowTop,
    labelH: LABEL_H,
    bodyTop,
    // Clamp to whole lines so no partial line can peek out of the frame.
    bodyH: maxLines * BODY_LINE_H,
    maxLines,
  }
}

/** SVG collapses runs of whitespace; nbsp survives. Same trick tldraw's own exporter uses. */
function preserveSpaces(text: string): string {
  return text.replace(/\s/g, ' ')
}

interface MeasuredSpan {
  box: { x: number; y: number; w: number; h: number }
  text: string
}

/**
 * Fold the measurer's word-level spans back into lines. Spans that share a top
 * edge are one line; the browser has already decided where the breaks fall.
 */
function foldSpansIntoLines(spans: MeasuredSpan[], maxLines: number) {
  const lines: { y: number; h: number; text: string }[] = []
  for (const span of spans) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - span.box.y) < 0.5) {
      last.text += span.text
      last.h = Math.max(last.h, span.box.h)
    } else {
      lines.push({ y: span.box.y, h: span.box.h, text: span.text })
    }
  }

  const truncated = lines.length > maxLines
  const kept = lines.slice(0, maxLines).map((line) => ({ ...line, text: line.text.trim() }))
  if (truncated && kept.length > 0) {
    kept[kept.length - 1].text += '…'
  }
  return kept
}

export class GapShapeUtil extends ShapeUtil<GapShape> {
  static override type = 'gap' as const

  static override props: RecordProps<GapShape> = {
    w: T.number,
    h: T.number,
    label: T.string,
    facingId: T.string.nullable(),
    sourceId: T.string,
  }

  getDefaultProps(): GapShape['props'] {
    return {
      w: CARD_W,
      h: CARD_H,
      label: '',
      facingId: null,
      // E11: the readout names gaps `g-002`, not a tldraw nanoid.
      sourceId: '',
    }
  }

  // A gap occupies a card's footprint and wraps its quoted line the same way, so
  // it has to give when the row does; the layout is derived from w/h and reflows
  // honestly. Rotation is refused for the card's reason and one of its own:
  // position carries the meaning (§1), and a tilted hole stops reading as the
  // absence of the card next to it.
  override canResize() {
    return true
  }

  override hideRotateHandle() {
    return true
  }

  // §9 closes the loop by binding a Mine card to a Received card, and inside
  // DeltaView the gap *is* the Received card's only presence — the card it
  // stands in for is not drawn. Refusing the bind would make the one gesture
  // that removes a gap impossible in the view that shows it. `facingId` carries
  // the identity across, so the binding lands on the card, not on the hole.
  override canBind() {
    return true
  }

  // The label is the facing card's text, quoted. §9: shown greyed, not owned.
  // Editing it here would fork the quote from the card it belongs to — and a
  // gap is generated by the delta reconciler, so the edit would not survive the
  // next recompute anyway.
  override canEdit() {
    return false
  }

  override onResize(shape: GapShape, info: TLResizeInfo<GapShape>) {
    return resizeBox(shape, info, { minWidth: MIN_W, minHeight: MIN_H })
  }

  /**
   * Filled, deliberately, and it is the one place the shape is not empty.
   * `isFilled: false` would make only the hairline clickable — a 1px target for
   * the object this entire view exists to point at, and one an arrow could not
   * bind to by pointing inside it. Nothing is layered under a gap that a click
   * should reach instead. So: empty as paint, solid as a target.
   */
  override getGeometry(shape: GapShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  /** What the exporter must inline for a gap to survive leaving this app (§5.4). */
  override getFontFaces(): TLFontFace[] {
    return [
      {
        family: 'EB Garamond',
        src: { url: '/fonts/eb-garamond-latin-400-normal.woff2', format: 'woff2' },
        weight: '400',
        style: 'normal',
      },
      {
        family: 'JetBrains Mono',
        src: { url: '/fonts/jetbrains-mono-latin-500-normal.woff2', format: 'woff2' },
        weight: '500',
        style: 'normal',
      },
    ]
  }

  override getIndicatorPath(shape: GapShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  component(shape: GapShape) {
    const { w, h, label } = shape.props
    const l = gapLayout(w, h)

    return (
      <HTMLContainer className="ec-gap">
        {/*
          The frame is drawn, not bordered. A CSS border would hand the dash
          rhythm to the user agent and put the canvas out of step with the
          export; it would also give the container a border box and offset every
          absolutely positioned child by 1px from its SVG twin (E4).
        */}
        <svg
          className="ec-gap__frame"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          aria-hidden="true"
        >
          {gapFrame(w, h).map((line, i) => (
            <line
              key={i}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={TERRACOTTA}
              strokeWidth={1}
              strokeDasharray={line.dash}
            />
          ))}
        </svg>
        <div
          className="ec-gap__eyebrow"
          style={{ top: l.eyebrowTop, left: l.padX, width: l.textW, height: l.labelH }}
        >
          {GAP_LABEL}
        </div>
        <div
          className="ec-gap__body"
          style={{
            top: l.bodyTop,
            left: l.padX,
            width: l.textW,
            height: l.bodyH,
            lineHeight: `${BODY_LINE_H}px`,
            WebkitLineClamp: l.maxLines,
          }}
        >
          {label}
        </div>
      </HTMLContainer>
    )
  }

  /**
   * E10: CSS reaches the canvas only. Emitted as real SVG, with no ground rect
   * at all — the absence has to survive the export, and a hole filled in by the
   * exporter would be the one bug that destroys the figure's meaning.
   */
  override toSvg(shape: GapShape, _ctx: SvgExportContext) {
    const { w, h, label } = shape.props
    const l = gapLayout(w, h)

    const spans = label
      ? this.editor.textMeasure.measureTextSpans(label, {
          overflow: 'wrap',
          width: l.textW,
          height: l.bodyH,
          padding: 0,
          fontSize: BODY_SIZE,
          fontWeight: '400',
          fontFamily: BODY_FAMILY,
          fontStyle: 'normal',
          lineHeight: BODY_LEADING,
          textAlign: 'start',
          otherStyles: { 'font-feature-settings': FEATURES },
        })
      : []
    const lines = foldSpansIntoLines(spans, l.maxLines)

    return (
      <g>
        {gapFrame(w, h).map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={TERRACOTTA}
            strokeWidth={1}
            strokeDasharray={line.dash}
          />
        ))}
        {/*
          Terracotta is the warm alarm and it is spent only here. The eyebrow
          and the frame are the whole of it; the quoted line stays grey.
        */}
        <text
          x={l.padX}
          // Each span box is symmetric about the font's central baseline, so its
          // midpoint plus dominant-baseline="central" lands the text exactly
          // where the DOM puts it.
          y={l.eyebrowTop + l.labelH / 2}
          dominantBaseline="central"
          fontFamily={MONO_FAMILY}
          fontSize={LABEL_SIZE}
          fontWeight="500"
          letterSpacing={EYEBROW_TRACKING}
          fill={TERRACOTTA}
          style={{ fontFeatureSettings: FEATURES }}
        >
          {preserveSpaces(GAP_LABEL)}
        </text>
        <text
          fontFamily={BODY_FAMILY}
          fontSize={BODY_SIZE}
          fontWeight="400"
          dominantBaseline="central"
          fill={INK_4}
          style={{ fontFeatureSettings: FEATURES }}
        >
          {lines.map((line, i) => (
            <tspan key={i} x={l.padX} y={l.bodyTop + line.y + line.h / 2} dominantBaseline="central">
              {preserveSpaces(line.text)}
            </tspan>
          ))}
        </text>
      </g>
    )
  }
}
