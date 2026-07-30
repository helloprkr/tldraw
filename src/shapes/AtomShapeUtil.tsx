import { HTMLContainer, Rectangle2d, ShapeUtil, T, resizeBox, resolveLineHeightPx } from 'tldraw'
import type { RecordProps, SvgExportContext, TLFontFace, TLResizeInfo, TLShape } from 'tldraw'
import { ATOM_PIGMENT, ATOM_PIGMENT_HEX, ATOM_TYPES, CARD_H, CARD_W } from '../types'
import type { AtomType } from '../types'

/**
 * The card. BUILD.md §5.3: paper on paper — hairline border, a 1px top rule in
 * the atom pigment, a mono eyebrow, the fragment in Garamond, mono meta on the
 * baseline. No shadow, no stripe, 2px radius at most.
 *
 * 5.x registers custom shapes by augmenting the global props map rather than by
 * declaring a standalone TLBaseShape, so that `TLShape` narrows to this type
 * everywhere in the app. That augmentation lives in tldraw-shapes.d.ts, which
 * has to target @tldraw/tlschema — `tldraw` does not re-export the interface.
 */

export type AtomShape = TLShape<'atom'>

/**
 * The SVG export cannot read CSS custom properties, and the text measurer needs
 * the same family string the DOM resolves. These literals transcribe tokens.css;
 * they are not new values. Same posture as theme.ts.
 */
const PAPER_WARM = '#ebe2cf'
const BONE = '#d6c9ad'
const INK = '#1a1410'
const INK_4 = '#9a8a78'

const BODY_FAMILY = "'EB Garamond', 'Iowan Old Style', 'Charter', Georgia, serif"
const MONO_FAMILY = "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace"
/** tokens.css sets these on `body`; stating them explicitly keeps DOM, measurer and SVG in step. */
const FEATURES = "'kern', 'liga', 'onum', 'pnum'"

/** Every number below is a spacing token from tokens.css, not a taste. */
const PAD = 16 /* --s-4 */
const GAP_RULE = 12 /* --s-3, rule to eyebrow */
const GAP_LABEL = 12 /* --s-3, eyebrow to body */
const GAP_META = 4 /* --s-1, minimum clearance from body to baseline meta */
const RULE_H = 1
const LABEL_H = 16
const LABEL_SIZE = 12 /* --t-meta */
const BODY_SIZE = 17 /* --t-body-sm */
const BODY_LEADING = 1.5 /* --lh-normal */
/**
 * tldraw snaps line boxes to whole pixels because rendering engines disagree on
 * fractional ones, and it applies that snap inside the text measurer. Measuring,
 * the card, and the export must all use the snapped value or multi-line text
 * drifts between the canvas and the plate.
 */
const BODY_LINE_H = resolveLineHeightPx(BODY_SIZE, BODY_LEADING)

const MIN_W = 200
/** One body line is the floor: below it the card would not carry a fragment. */
const MIN_H = PAD + RULE_H + GAP_RULE + LABEL_H + GAP_LABEL + BODY_LINE_H + GAP_META + LABEL_H + PAD

interface AtomLayout {
  padX: number
  textW: number
  ruleY: number
  eyebrowTop: number
  labelH: number
  bodyTop: number
  bodyH: number
  maxLines: number
  metaTop: number
}

/**
 * One layout, consumed by both `component` and `toSvg`. The two renderings must
 * be pixel-identical — the M3 gate puts them side by side — so neither is
 * allowed its own idea of where anything sits.
 */
function atomLayout(w: number, h: number): AtomLayout {
  const eyebrowTop = PAD + RULE_H + GAP_RULE
  const bodyTop = eyebrowTop + LABEL_H + GAP_LABEL
  const metaTop = h - PAD - LABEL_H
  const available = Math.max(BODY_LINE_H, metaTop - GAP_META - bodyTop)
  const maxLines = Math.max(1, Math.floor(available / BODY_LINE_H))
  return {
    padX: PAD,
    textW: Math.max(1, w - PAD * 2),
    ruleY: PAD,
    eyebrowTop,
    labelH: LABEL_H,
    bodyTop,
    // Clamp to whole lines so no partial line can peek above the meta rule.
    bodyH: maxLines * BODY_LINE_H,
    maxLines,
    metaTop,
  }
}

function pad(n: number, width: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(width, '0')
}

function eyebrowText(atom: AtomType, ordinal: number): string {
  // Untyped cards say so and stop there. They should read as unfinished.
  return atom === 'untyped' ? 'UNTYPED' : `${atom.toUpperCase()} · ${pad(ordinal, 2)}`
}

function metaRight(ordinal: number): string {
  return `¶ ${pad(ordinal, 3)}`
}

/** SVG collapses runs of whitespace; nbsp survives. Same trick tldraw's own exporter uses. */
function preserveSpaces(text: string): string {
  return text.replace(/\s/g, ' ')
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

export class AtomShapeUtil extends ShapeUtil<AtomShape> {
  static override type = 'atom' as const

  static override props: RecordProps<AtomShape> = {
    w: T.number,
    h: T.number,
    atom: T.literalEnum(...ATOM_TYPES, 'untyped'),
    text: T.string,
    sourceId: T.string,
    created: T.string,
    ordinal: T.number,
  }

  getDefaultProps(): AtomShape['props'] {
    return {
      w: CARD_W,
      h: CARD_H,
      atom: 'untyped',
      text: '',
      sourceId: '',
      created: '',
      ordinal: 0,
    }
  }

  // A fragment longer than the card must stay reachable, and the layout is
  // derived from w/h, so it reflows honestly. Size carries no meaning here —
  // position does (BUILD.md §1) — so rotation is refused outright: a rotated
  // card would corrupt the x/y semantics the readout reads.
  override canResize() {
    return true
  }

  override hideRotateHandle() {
    return true
  }

  // Stage 4 binds arrows between atoms to mean dependency (§6.3).
  override canBind() {
    return true
  }

  // inputs/ is the source of truth and the app never writes to it (§4). Editing
  // text on canvas would silently fork the card from its fragment on disk.
  override canEdit() {
    return false
  }

  override onResize(shape: AtomShape, info: TLResizeInfo<AtomShape>) {
    return resizeBox(shape, info, { minWidth: MIN_W, minHeight: MIN_H })
  }

  override getGeometry(shape: AtomShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  /** What the exporter must inline for a card to survive leaving this app (§5.4). */
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

  override getIndicatorPath(shape: AtomShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  component(shape: AtomShape) {
    const { w, h, atom, text, created, ordinal } = shape.props
    const l = atomLayout(w, h)
    const pigment = ATOM_PIGMENT[atom]

    return (
      <HTMLContainer className="ec-atom">
        {pigment && (
          <div
            key={`rule-${atom}`}
            className="ec-atom__rule"
            style={{ top: l.ruleY, left: l.padX, width: l.textW, background: pigment }}
          />
        )}
        <div
          key={`eyebrow-${atom}`}
          className="ec-atom__eyebrow"
          style={{
            top: l.eyebrowTop,
            left: l.padX,
            width: l.textW,
            height: l.labelH,
            color: pigment ?? 'var(--ink-4)',
          }}
        >
          {eyebrowText(atom, ordinal)}
        </div>
        <div
          className="ec-atom__body"
          style={{
            top: l.bodyTop,
            left: l.padX,
            width: l.textW,
            height: l.bodyH,
            lineHeight: `${BODY_LINE_H}px`,
            WebkitLineClamp: l.maxLines,
          }}
        >
          {text}
        </div>
        <div
          className="ec-atom__meta"
          style={{ top: l.metaTop, left: l.padX, width: l.textW, height: l.labelH }}
        >
          <span>{created}</span>
          <span>{metaRight(ordinal)}</span>
        </div>
      </HTMLContainer>
    )
  }

  /**
   * The plate has to survive being opened somewhere else entirely (§10), so the
   * card is emitted as real SVG rather than a foreignObject. SVG text does not
   * wrap: the editor's text measurer replays the browser's own line-breaking and
   * we place each resulting line ourselves.
   */
  override toSvg(shape: AtomShape, _ctx: SvgExportContext) {
    const { w, h, atom, text, created, ordinal } = shape.props
    const l = atomLayout(w, h)
    const pigment = ATOM_PIGMENT_HEX[atom]

    const spans = text
      ? this.editor.textMeasure.measureTextSpans(text, {
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

    // Each span box is symmetric about the font's central baseline, whether the
    // browser reports the line box or the content box — so its midpoint plus
    // dominant-baseline="central" lands the text exactly where the DOM puts it.
    const labelBaseline = (top: number) => top + l.labelH / 2

    return (
      <g>
        <rect
          x={0.5}
          y={0.5}
          width={Math.max(0, w - 1)}
          height={Math.max(0, h - 1)}
          rx={2}
          fill={PAPER_WARM}
          stroke={BONE}
          strokeWidth={1}
        />
        {pigment && (
          <rect x={l.padX} y={l.ruleY} width={l.textW} height={RULE_H} fill={pigment} />
        )}
        <text
          x={l.padX}
          y={labelBaseline(l.eyebrowTop)}
          dominantBaseline="central"
          fontFamily={MONO_FAMILY}
          fontSize={LABEL_SIZE}
          fontWeight="500"
          letterSpacing="0.12em"
          fill={pigment ?? INK_4}
          style={{ fontFeatureSettings: FEATURES }}
        >
          {preserveSpaces(eyebrowText(atom, ordinal))}
        </text>
        <text
          fontFamily={BODY_FAMILY}
          fontSize={BODY_SIZE}
          fontWeight="400"
          dominantBaseline="central"
          fill={INK}
          style={{ fontFeatureSettings: FEATURES }}
        >
          {lines.map((line, i) => (
            <tspan
              key={i}
              x={l.padX}
              y={l.bodyTop + line.y + line.h / 2}
              dominantBaseline="central"
            >
              {preserveSpaces(line.text)}
            </tspan>
          ))}
        </text>
        <text
          x={l.padX}
          y={labelBaseline(l.metaTop)}
          dominantBaseline="central"
          fontFamily={MONO_FAMILY}
          fontSize={LABEL_SIZE}
          fontWeight="400"
          letterSpacing="0.04em"
          fill={INK_4}
          style={{ fontFeatureSettings: FEATURES }}
        >
          {preserveSpaces(created)}
        </text>
        <text
          x={w - l.padX}
          y={labelBaseline(l.metaTop)}
          textAnchor="end"
          dominantBaseline="central"
          fontFamily={MONO_FAMILY}
          fontSize={LABEL_SIZE}
          fontWeight="400"
          letterSpacing="0.04em"
          fill={INK_4}
          style={{ fontFeatureSettings: FEATURES }}
        >
          {preserveSpaces(metaRight(ordinal))}
        </text>
      </g>
    )
  }
}
