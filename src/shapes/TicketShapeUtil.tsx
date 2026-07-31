import { useEffect, useRef } from 'react'
import {
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  T,
  resizeBox,
  resolveLineHeightPx,
  stopEventPropagation,
  useEditor,
  useValue,
} from 'tldraw'
import type { RecordProps, SvgExportContext, TLFontFace, TLResizeInfo, TLShape } from 'tldraw'
import { TICKET_KINDS } from '../delta-types'
import type { TicketKind } from '../delta-types'
import { CARD_W, TERRACOTTA } from '../types'
import './ticket.css'

/**
 * The ticket — BUILD.md §7 Stage 6. An open question, held on the canvas until
 * it closes. Built as a sibling of the card (§5.3) so the two read as one
 * system: same paper on paper, same hairline border, same mono eyebrow / body /
 * baseline-meta rhythm, same padding.
 *
 * Two marks differ, and both are terracotta — the hairline top rule and the
 * eyebrow, which reads the kind. §5.2 reserves that pigment for absence and
 * says the exclusivity is the whole point, so nothing else on this shape
 * carries it. Stage 6's reward signal is terracotta leaving the canvas; that
 * only works if terracotta means one thing.
 */

export type TicketShape = TLShape<'ticket'>

/**
 * The SVG export cannot read CSS custom properties, and the text measurer needs
 * the same family string the DOM resolves. These literals transcribe tokens.css;
 * they are not new values. Same posture as theme.ts and AtomShapeUtil.
 */
const PAPER_WARM = '#ebe2cf'
const BONE = '#d6c9ad'
const INK = '#1a1410'
const INK_4 = '#9a8a78'

const BODY_FAMILY = "'EB Garamond', 'Iowan Old Style', 'Charter', Georgia, serif"
const MONO_FAMILY = "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace"
/** tokens.css sets these on `body`; stating them explicitly keeps DOM, measurer and SVG in step. */
const FEATURES = "'kern', 'liga', 'onum', 'pnum'"

/**
 * The card's own rhythm, transcribed from the same spacing tokens. The two
 * shapes have to agree on every horizontal or a ticket parked beside a card
 * reads as a different kind of object rather than the same object holding a
 * question.
 */
const PAD = 16 /* --s-4 */
const GAP_RULE = 12 /* --s-3, rule to eyebrow */
const GAP_LABEL = 12 /* --s-3, eyebrow to body */
const GAP_META = 4 /* --s-1, minimum clearance from body to baseline meta */
const RULE_H = 1
const LABEL_H = 16
const LABEL_SIZE = 12 /* --t-meta */
const BODY_SIZE = 17 /* --t-body-sm */
const BODY_LEADING = 1.5 /* --lh-normal */
/** E4: the measurer snaps leading to whole pixels, so DOM, measurement and export must share it. */
const BODY_LINE_H = resolveLineHeightPx(BODY_SIZE, BODY_LEADING)

const MIN_W = 200
/** One body line is the floor: below it the ticket would not carry a question. */
const MIN_H = PAD + RULE_H + GAP_RULE + LABEL_H + GAP_LABEL + BODY_LINE_H + GAP_META + LABEL_H + PAD

/**
 * A card's width, so tickets sit in the same column as the cards they interrupt;
 * three body lines tall, because Jordan writes clausally and a question
 * truncated on arrival defeats the point of holding it in view. Shorter than a
 * card by design — a ticket is a note, not a fragment.
 */
const DEFAULT_LINES = 3
const DEFAULT_H = MIN_H + (DEFAULT_LINES - 1) * BODY_LINE_H

/** The printer's second-order reference mark. `¶ NNN` names a card's paragraph; a ticket has no ordinal, so it names itself. */
const REF_MARK = '†'

interface TicketLayout {
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
 * be pixel-identical — the plate export may include a ticket — so neither is
 * allowed its own idea of where anything sits.
 */
function ticketLayout(w: number, h: number): TicketLayout {
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

function eyebrowText(kind: TicketKind): string {
  return kind.toUpperCase()
}

/**
 * The meta band carries one thing: the ticket's stable id, so a line in map.md
 * can be walked back to the shape (E11). Empty until the id is assigned, which
 * leaves the band blank but the baseline where the card puts it.
 */
function metaRight(sourceId: string): string {
  const id = sourceId.trim()
  return id ? `${REF_MARK} ${id}` : ''
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

/**
 * The question, read or written. A card is transcribed from `inputs/` and can
 * only be read; a ticket has no file behind it, so this is the only place its
 * text can come from. The field replaces the display in the same box with the
 * same metrics, so nothing moves when editing starts or ends.
 */
function TicketText({ shape, layout }: { shape: TicketShape; layout: TicketLayout }) {
  const editor = useEditor()
  const isEditing = useValue('ticket is editing', () => editor.getEditingShapeId() === shape.id, [
    editor,
    shape.id,
  ])
  const rInput = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!isEditing) return
    const input = rInput.current
    if (!input) return
    if (editor.getContainer().ownerDocument.activeElement !== input) input.focus()
    // A question is extended, not replaced: land the caret at the end.
    input.setSelectionRange(input.value.length, input.value.length)
  }, [editor, isEditing])

  const box = {
    top: layout.bodyTop,
    left: layout.padX,
    width: layout.textW,
    height: layout.bodyH,
    lineHeight: `${BODY_LINE_H}px`,
  }

  if (!isEditing) {
    return (
      <div
        className="ec-ticket__body ec-ticket__display"
        style={{ ...box, WebkitLineClamp: layout.maxLines }}
      >
        {shape.props.text}
      </div>
    )
  }

  return (
    <textarea
      ref={rInput}
      className="ec-ticket__body ec-ticket__input"
      style={box}
      value={shape.props.text}
      spellCheck={false}
      onChange={(e) => {
        editor.updateShape({ id: shape.id, type: 'ticket', props: { text: e.currentTarget.value } })
      }}
      // Pointer events inside the field place the caret; letting them through
      // would start a drag on the shape instead. Key events are deliberately
      // not stopped — Escape has to reach the editor to end editing.
      onPointerDown={stopEventPropagation}
      onTouchStart={stopEventPropagation}
      onTouchEnd={stopEventPropagation}
    />
  )
}

export class TicketShapeUtil extends ShapeUtil<TicketShape> {
  static override type = 'ticket' as const

  static override props: RecordProps<TicketShape> = {
    w: T.number,
    h: T.number,
    text: T.string,
    kind: T.literalEnum(...TICKET_KINDS),
    sourceId: T.string,
  }

  getDefaultProps(): TicketShape['props'] {
    return {
      w: CARD_W,
      h: DEFAULT_H,
      text: '',
      // The default question is the one Jordan asks of his own draft.
      kind: 'grill',
      // Assigned at creation by whoever presses T; numbering `t-001` needs to
      // see the page, which a default cannot (E11). Empty falls back to the
      // record id in the readout.
      sourceId: '',
    }
  }

  // A question longer than the ticket must stay reachable, and the layout is
  // derived from w/h, so it reflows honestly.
  override canResize() {
    return true
  }

  // Position carries meaning (§1) and the readout orders open items by
  // y-position, so a rotated ticket would corrupt the order of the map.
  override hideRotateHandle() {
    return true
  }

  // §6.3: an arrow means dependency between *atoms*, and the readout's graph is
  // built over atoms alone. A ticket is a question about the argument, not a
  // node in it; binding one would put a note into the dependency graph.
  override canBind() {
    return false
  }

  // The one predicate where the ticket parts company with the card. A card is
  // transcribed from `inputs/`, which is the source of truth and which the app
  // never writes to (§4) — editing it on canvas would silently fork it from the
  // file. A ticket has no file: Jordan authors it here with T (§11), so the
  // canvas *is* its source of truth and refusing to edit would make it
  // permanently blank.
  override canEdit() {
    return true
  }

  /** Whitespace on a question is noise the map would have to carry (§7 Stage 5 writes it one line). */
  override onEditEnd(shape: TicketShape) {
    const trimmed = shape.props.text.trim()
    if (trimmed !== shape.props.text) {
      this.editor.updateShape({ id: shape.id, type: 'ticket', props: { text: trimmed } })
    }
  }

  override onResize(shape: TicketShape, info: TLResizeInfo<TicketShape>) {
    return resizeBox(shape, info, { minWidth: MIN_W, minHeight: MIN_H })
  }

  override getGeometry(shape: TicketShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  /** What the exporter must inline for a ticket to survive leaving this app (§5.4). */
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

  override getIndicatorPath(shape: TicketShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  component(shape: TicketShape) {
    const { w, h, kind, sourceId } = shape.props
    const l = ticketLayout(w, h)

    return (
      <HTMLContainer className="ec-ticket">
        <div className="ec-ticket__rule" style={{ top: l.ruleY, left: l.padX, width: l.textW }} />
        <div
          key={`eyebrow-${kind}`}
          className="ec-ticket__eyebrow"
          style={{ top: l.eyebrowTop, left: l.padX, width: l.textW, height: l.labelH }}
        >
          {eyebrowText(kind)}
        </div>
        <TicketText shape={shape} layout={l} />
        <div
          className="ec-ticket__meta"
          style={{ top: l.metaTop, left: l.padX, width: l.textW, height: l.labelH }}
        >
          <span>{metaRight(sourceId)}</span>
        </div>
      </HTMLContainer>
    )
  }

  /**
   * E10: CSS reaches the canvas only, so every mark is emitted here as real SVG
   * with literal values. Nothing is drawn that `component` does not draw — no
   * placeholder for an empty question, because a mark that appears on canvas
   * and not in the plate is exactly the drift E10 rules out.
   */
  override toSvg(shape: TicketShape, _ctx: SvgExportContext) {
    const { w, h, text, kind, sourceId } = shape.props
    const l = ticketLayout(w, h)

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

    // Each span box is symmetric about the font's central baseline, so its
    // midpoint plus dominant-baseline="central" lands the text exactly where
    // the DOM puts it.
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
        <rect x={l.padX} y={l.ruleY} width={l.textW} height={RULE_H} fill={TERRACOTTA} />
        <text
          x={l.padX}
          y={labelBaseline(l.eyebrowTop)}
          dominantBaseline="central"
          fontFamily={MONO_FAMILY}
          fontSize={LABEL_SIZE}
          fontWeight="500"
          letterSpacing="0.12em"
          fill={TERRACOTTA}
          style={{ fontFeatureSettings: FEATURES }}
        >
          {preserveSpaces(eyebrowText(kind))}
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
            <tspan key={i} x={l.padX} y={l.bodyTop + line.y + line.h / 2} dominantBaseline="central">
              {preserveSpaces(line.text)}
            </tspan>
          ))}
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
          {preserveSpaces(metaRight(sourceId))}
        </text>
      </g>
    )
  }
}
