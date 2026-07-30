import { HTMLContainer, Rectangle2d, ShapeUtil, T, resolveLineHeightPx } from 'tldraw'
import type { Editor, RecordProps, SvgExportContext, TLFontFace, TLShape } from 'tldraw'
import {
  COLOPHON,
  PLATE_CAPTION_LEADING,
  PLATE_CAPTION_SIZE,
  PLATE_DOUBLE_RULE_H,
  PLATE_PAD,
  PLATE_RULE_GAP,
} from '../figure-types'
import { CARD_H, CARD_W } from '../types'
import './plate.css'

/**
 * The plate — BUILD.md §10. A book plate: cream ground, hairline border, the
 * printer's double rule, a mono caption, the colophon bottom right.
 *
 * The plate draws only its own chrome. The figure is the cloned shapes laid on
 * top of it by the export orchestration, so the plate never knows what it wraps
 * and nothing about the figure can change how the chrome is laid out.
 */

export type PlateShape = TLShape<'plate'>

/**
 * The SVG export cannot read CSS custom properties, and the text measurer needs
 * the same family string the DOM resolves. These literals transcribe tokens.css;
 * they are not new values. Same posture as theme.ts and AtomShapeUtil.
 */
const PAPER = '#f5efe2'
const BONE = '#d6c9ad'
const INK_3 = '#6b5a4c'
const INK_4 = '#9a8a78'

const MONO_FAMILY = "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace"
/** tokens.css sets these on `body`; stating them explicitly keeps DOM, measurer and SVG in step. */
const FEATURES = "'kern', 'liga', 'onum', 'pnum'"

/** --tk-wider, the uppercase mono label tracking. */
const CAPTION_TRACKING = '0.12em'
/** --tk-wide. The colophon is a mark, not a label; it recedes. */
const COLOPHON_TRACKING = '0.04em'

/**
 * E4: the measurer snaps leading to whole pixels, so the DOM, the measurement
 * and the export must all take the line box from the same call or the lines
 * break in one place and land in another.
 */
const LINE_H = resolveLineHeightPx(PLATE_CAPTION_SIZE, PLATE_CAPTION_LEADING)

/** A plate with nothing in it: one card, one caption line. Export overwrites both. */
const DEFAULT_W = CARD_W + PLATE_PAD * 2
const DEFAULT_H = CARD_H + PLATE_PAD * 2 + footHeight(1)

/**
 * Everything from the double rule down: the rule, the gap, the caption, the
 * colophon line, the bottom margin. The export orchestration sizes the plate
 * with this — `h = figureHeight + PLATE_PAD * 2 + captionHeight(...)` — which
 * leaves the same 48px margin above the figure, below it, and under the
 * colophon, and puts the rule exactly one margin below the figure.
 */
function footHeight(captionLines: number): number {
  return (
    PLATE_DOUBLE_RULE_H +
    PLATE_RULE_GAP +
    Math.max(1, captionLines) * LINE_H +
    LINE_H +
    PLATE_PAD
  )
}

interface PlateLayout {
  padX: number
  /** Wrap measure for the caption, and the width the colophon is flushed against. */
  textW: number
  /** Top of the first of the two hairlines. The rule runs the full width, edge to edge. */
  ruleY: number
  captionTop: number
  colophonTop: number
}

/**
 * One layout, consumed by both `component` and `toSvg`. The two renderings must
 * be pixel-identical — the M3 gate puts them side by side — so neither is
 * allowed its own idea of where anything sits. The whole block hangs from the
 * bottom edge, which is why the caption can grow without moving the colophon.
 */
function plateLayout(w: number, h: number, captionLines: number): PlateLayout {
  const ruleY = h - footHeight(captionLines)
  const captionTop = ruleY + PLATE_DOUBLE_RULE_H + PLATE_RULE_GAP
  return {
    padX: PLATE_PAD,
    textW: Math.max(1, w - PLATE_PAD * 2),
    ruleY,
    captionTop,
    colophonTop: captionTop + Math.max(1, captionLines) * LINE_H,
  }
}

/** §10's label, verbatim: `FIG. 3 — THE DELTA BETWEEN RECEIVED AND MINE`. */
export function plateCaptionText(figureNumber: number, caption: string): string {
  const written = caption.trim()
  const label = `FIG. ${figureNumber}`
  return written ? `${label} — ${written.toUpperCase()}` : label
}

function colophonText(paragraph: string): string {
  const ref = paragraph.trim()
  return ref ? `${COLOPHON} ¶ ${ref}` : COLOPHON
}

/** SVG collapses runs of whitespace; nbsp survives. Same trick tldraw's own exporter uses. */
function preserveSpaces(text: string): string {
  return text.replace(/\s/g, ' ')
}

interface CaptionLine {
  y: number
  h: number
  text: string
}

/**
 * Replay the browser's own line breaking for the caption. The measurer renders
 * the string with these exact styles and reports word-level spans; spans that
 * share a top edge are one line.
 *
 * Verified against 5.2.5: with `overflow: 'wrap'` the measurer lays the element
 * out at `min-content` height and never reads `opts.height`, so the caption is
 * measured whole and is never truncated.
 */
function measureCaption(editor: Editor, text: string, width: number): CaptionLine[] {
  const spans = editor.textMeasure.measureTextSpans(text, {
    overflow: 'wrap',
    width,
    height: 0,
    padding: 0,
    fontSize: PLATE_CAPTION_SIZE,
    fontWeight: '500',
    fontFamily: MONO_FAMILY,
    fontStyle: 'normal',
    lineHeight: PLATE_CAPTION_LEADING,
    textAlign: 'start',
    otherStyles: { 'font-feature-settings': FEATURES, 'letter-spacing': CAPTION_TRACKING },
  })

  const lines: CaptionLine[] = []
  for (const span of spans) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - span.box.y) < 0.5) {
      last.text += span.text
      last.h = Math.max(last.h, span.box.h)
    } else {
      lines.push({ y: span.box.y, h: span.box.h, text: span.text })
    }
  }
  return lines.map((line) => ({ ...line, text: line.text.trim() }))
}

/**
 * The caption block height for a plate `plateW` wide — the double rule, the gap
 * above the caption, every caption line the string wraps onto, the colophon,
 * and the bottom margin. The export orchestration adds it to the figure's
 * height and the two margins, so a caption of any length gets the room it needs
 * and is never truncated:
 *
 *   h = figureHeight + PLATE_PAD * 2 + captionHeight(caption, n, editor, plateW)
 *
 * `plateW` is not optional: the caption wraps, so its height cannot be known
 * without the measure it wraps to.
 */
export function captionHeight(
  caption: string,
  figureNumber: number,
  editor: Editor,
  plateW: number
): number {
  const text = plateCaptionText(figureNumber, caption)
  const lines = measureCaption(editor, text, Math.max(1, plateW - PLATE_PAD * 2))
  return footHeight(lines.length)
}

export class PlateShapeUtil extends ShapeUtil<PlateShape> {
  static override type = 'plate' as const

  static override props: RecordProps<PlateShape> = {
    w: T.number,
    h: T.number,
    caption: T.string,
    figureNumber: T.number,
    paragraph: T.string,
  }

  getDefaultProps(): PlateShape['props'] {
    return {
      w: DEFAULT_W,
      h: DEFAULT_H,
      caption: '',
      figureNumber: 0,
      paragraph: '',
    }
  }

  // A plate is generated, not designed (§10). Its height is computed from its
  // caption and the figure it was cut around, so dragging a corner would put
  // the double rule somewhere the export never intended; its caption comes from
  // the ⌘E prompt and figures.json, so editing it on canvas would fork the
  // figure from its registry entry; nothing depends on a plate, so binding an
  // arrow to one would put a wrapper into the readout's dependency graph; and a
  // rotated plate cannot be a page in a book.
  override canResize() {
    return false
  }

  override canEdit() {
    return false
  }

  override canBind() {
    return false
  }

  override hideRotateHandle() {
    return true
  }

  override getGeometry(shape: PlateShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  /** What the exporter must inline for a plate to survive leaving this app (§5.4). */
  override getFontFaces(): TLFontFace[] {
    return [
      {
        family: 'JetBrains Mono',
        src: { url: '/fonts/jetbrains-mono-latin-400-normal.woff2', format: 'woff2' },
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

  override getIndicatorPath(shape: PlateShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  component(shape: PlateShape) {
    const { caption, figureNumber, paragraph } = shape.props

    // The foot is laid out in flow, anchored to the bottom edge, so the caption
    // grows upward exactly as plateLayout computes it — no measurement on the
    // render path, and the browser that breaks these lines is the same one the
    // measurer replays for the export.
    return (
      <HTMLContainer className="ec-plate">
        <div className="ec-plate__foot" style={{ bottom: PLATE_PAD }}>
          <div className="ec-plate__rule" />
          <div
            className="ec-plate__caption"
            style={{
              marginTop: PLATE_RULE_GAP,
              marginLeft: PLATE_PAD,
              marginRight: PLATE_PAD,
              lineHeight: `${LINE_H}px`,
            }}
          >
            {plateCaptionText(figureNumber, caption)}
          </div>
          <div
            className="ec-plate__colophon"
            style={{
              marginLeft: PLATE_PAD,
              marginRight: PLATE_PAD,
              lineHeight: `${LINE_H}px`,
            }}
          >
            {colophonText(paragraph)}
          </div>
        </div>
      </HTMLContainer>
    )
  }

  /**
   * E10: CSS reaches the canvas only. Every mark on the plate is emitted here
   * as real SVG with literal values, because the plate exists to be opened
   * somewhere else entirely (§10) — Substack, a reader kit, a fresh browser
   * profile with the dev server stopped.
   */
  override toSvg(shape: PlateShape, _ctx: SvgExportContext) {
    const { w, h, caption, figureNumber, paragraph } = shape.props
    const text = plateCaptionText(figureNumber, caption)
    const lines = measureCaption(this.editor, text, Math.max(1, w - PLATE_PAD * 2))
    const l = plateLayout(w, h, lines.length)

    return (
      <g>
        <rect x={0} y={0} width={w} height={h} fill={PAPER} />
        {/*
          The double rule: `3px double var(--ink-3)` is two hairlines with a 1px
          gap between them, the printer's chapter break. Two rects, not one 3px
          stroke — a single thick line is the one way to lose the most
          recognizable element in the house language.
        */}
        <rect x={0} y={l.ruleY} width={w} height={1} fill={INK_3} />
        <rect x={0} y={l.ruleY + PLATE_DOUBLE_RULE_H - 1} width={w} height={1} fill={INK_3} />
        {/*
          Painted last, over the rule ends, because on canvas the hairline
          border is an ::after overlay — a real border would shift every child
          by 1px against its SVG twin (E4).
        */}
        <rect
          x={0.5}
          y={0.5}
          width={Math.max(0, w - 1)}
          height={Math.max(0, h - 1)}
          fill="none"
          stroke={BONE}
          strokeWidth={1}
        />
        <text
          fontFamily={MONO_FAMILY}
          fontSize={PLATE_CAPTION_SIZE}
          fontWeight="500"
          letterSpacing={CAPTION_TRACKING}
          fill={INK_3}
          style={{ fontFeatureSettings: FEATURES }}
        >
          {/*
            Each span box is symmetric about the font's central baseline, so its
            midpoint plus dominant-baseline="central" lands the line exactly
            where the DOM puts it.
          */}
          {lines.map((line, i) => (
            <tspan
              key={i}
              x={l.padX}
              y={l.captionTop + line.y + line.h / 2}
              dominantBaseline="central"
            >
              {preserveSpaces(line.text)}
            </tspan>
          ))}
        </text>
        <text
          x={w - l.padX}
          y={l.colophonTop + LINE_H / 2}
          textAnchor="end"
          dominantBaseline="central"
          fontFamily={MONO_FAMILY}
          fontSize={PLATE_CAPTION_SIZE}
          fontWeight="400"
          letterSpacing={COLOPHON_TRACKING}
          fill={INK_4}
          style={{ fontFeatureSettings: FEATURES }}
        >
          {preserveSpaces(colophonText(paragraph))}
        </text>
      </g>
    )
  }
}
