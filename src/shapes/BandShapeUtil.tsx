import { HTMLContainer, Rectangle2d, ShapeUtil, T } from 'tldraw'
import type { Editor, RecordProps, SvgExportContext, TLFontFace, TLShape } from 'tldraw'
import { BAND_H, BAND_LABEL_W, BAND_STRIP_H, BAND_W } from '../corpus-types'
import type { UnitAtom } from '../corpus-types'
import { ATOM_PIGMENT, ATOM_PIGMENT_HEX, isAtomType } from '../types'
import './band.css'

/**
 * One essay as a band — BUILD.md §8. The x-axis is normalized position through
 * the essay and each segment's width is its share of the words, so two writers'
 * rhythms can be compared as images rather than read as lists.
 *
 * This is the one shape allowed to use pigment as an *area fill* (errata E5).
 * Everywhere else pigment is a mark; here it is the diagram.
 *
 * The band's own marks — ground, segments, hatch, the double rule — are built
 * once by `bandBody` and rendered by both `component` and `toSvg` from that same
 * element tree, so the canvas and the export cannot describe different geometry.
 * Only the two runs of type are laid out per path, and both take their string
 * and their box from the shared layout and the shared fit.
 */

export type BandShape = TLShape<'band'>

/**
 * The SVG export cannot read CSS custom properties, and the text measurer needs
 * the same family string the DOM resolves. These literals transcribe tokens.css;
 * they are not new values. Same posture as theme.ts and AtomShapeUtil.
 */
const PAPER = '#f5efe2'
const BONE = '#d6c9ad'
const INK = '#1a1410'
const INK_3 = '#6b5a4c'
const INK_4 = '#9a8a78'

const DISPLAY_FAMILY = "'Instrument Serif', 'Cormorant Garamond', 'EB Garamond', Georgia, serif"
const MONO_FAMILY = "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace"
/** tokens.css sets these on `body`; stating them explicitly keeps DOM, measurer and SVG in step. */
const FEATURES = "'kern', 'liga', 'onum', 'pnum'"

/** §8, literally: pigment at 85%, unclassified at 25%. */
const SEGMENT_OPACITY = 0.85
const UNCLASSIFIED_OPACITY = 0.25

/** The printer's chapter break: `3px double var(--ink-3)`, drawn as two hairlines. */
const DOUBLE_RULE_H = 3
const RULE_GAP = 12 /* --s-3, rule to strip */

const TITLE_SIZE = 20 /* --t-h3 */
const TITLE_TRACKING = '-0.02em' /* --tk-tight; display type is set tight */
const STRIP_SIZE = 12 /* --t-meta */
const STRIP_TRACKING = '0.12em' /* --tk-wider, the uppercase mono label tracking */

/**
 * The whole row: the title's margin plus the band, and the double rule's band
 * plus the atom strip plus the 64px band. Exported because the wall stacks these
 * with `BAND_GAP` between and needs the row's real size to do it. The height is
 * the same whether or not the essay is Jordan's: a band that grew by 15px when
 * `mine` flipped would move every band under it, and the rule marks a boundary
 * between bands, not a property of one band's box.
 */
export const BAND_SHAPE_W = BAND_LABEL_W + BAND_W
export const BAND_SHAPE_H = DOUBLE_RULE_H + RULE_GAP + BAND_STRIP_H + BAND_H

/** The hatch tile. A hairline diagonal per tile, so the pitch is 8/√2 ≈ 5.7px. */
const HATCH_TILE = 8
/**
 * The tile's own anti-diagonal plus the two corner stubs its neighbours need:
 * a pattern tile clips its contents, so without these the stroke would be cut
 * back at each corner and the hatch would read as dashes rather than as lines.
 */
const HATCH_LINES = [
  `M 0 ${HATCH_TILE} L ${HATCH_TILE} 0`,
  'M -1 1 L 1 -1',
  `M ${HATCH_TILE - 1} ${HATCH_TILE + 1} L ${HATCH_TILE + 1} ${HATCH_TILE - 1}`,
]

/** The sequence strip's punctuation. Nbsp so SVG cannot collapse it away. */
const STRIP_SEP = '\u00a0\u00b7\u00a0'
const STRIP_MORE = '\u00a0\u2026'
/**
 * What an unclassified unit contributes to the strip. It contributes something,
 * not nothing: skipping it would print a rhythm the essay does not have, and §8
 * is built on unclassified units being as visible as classified ones. An em rule
 * in --ink-4 — the same ink the hatched segment is filled with — holds the unit's
 * place in the sequence and ties the hole in the strip to the hole in the band.
 */
const UNCLASSIFIED_MARK = '—'

interface BandLayout {
  /** Top of the first of the two hairlines. Only drawn when the essay is Jordan's. */
  ruleY: number
  stripTop: number
  stripH: number
  bandTop: number
  bandH: number
  /** The band's left edge, which is also the right edge the title aligns to. */
  bandX: number
  bandW: number
}

/**
 * One layout, consumed by both `component` and `toSvg`, and by the hit helper
 * the margin panel uses. The band hangs from the bottom edge so it keeps §8's
 * 64px whatever the row's height is, and everything else stacks above it.
 */
function bandLayout(w: number, h: number): BandLayout {
  const bandH = Math.min(BAND_H, h)
  const bandTop = Math.max(0, h - bandH)
  return {
    ruleY: 0,
    stripTop: Math.max(0, bandTop - BAND_STRIP_H),
    stripH: BAND_STRIP_H,
    bandTop,
    bandH,
    bandX: BAND_LABEL_W,
    bandW: Math.max(1, w - BAND_LABEL_W),
  }
}

/**
 * §8 never guesses. Anything that is not one of the four pigmented types — null,
 * `untyped`, or a name this build does not know — is unclassified and is drawn
 * as a hole. It is never coerced to a type and never dropped from the sequence.
 */
function classify(atom: string | null): UnitAtom {
  return atom !== null && isAtomType(atom) && atom !== 'untyped' ? atom : null
}

export interface BandSegmentRect {
  index: number
  /** Left edge relative to the band rect; add `BAND_LABEL_W` for shape space. */
  x: number
  w: number
  atom: UnitAtom
}

/**
 * Segment geometry. `BandSegment[]` from corpus-types is assignable to the
 * parameter, as is the shape's own props, so the parent can lay a band out
 * before it creates one.
 *
 * The running edge is rounded, not each width: that is what makes the widths sum
 * to exactly `bandW`, with no seam of paper between two segments and no overhang
 * at the right end. Weights are divided by their total, so a caller that hands
 * over raw word counts still gets a correct band rather than a broken one.
 */
export function bandSegmentRects(
  segments: readonly { atom: string | null; weight: number }[],
  bandW: number
): BandSegmentRect[] {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.weight), 0)
  const rects: BandSegmentRect[] = []
  let accumulated = 0
  let edge = 0
  for (let i = 0; i < segments.length; i++) {
    accumulated += Math.max(0, segments[i].weight)
    // An assembly whose units all weigh nothing still has units. Equal shares are
    // the only reading of no information that keeps every one of them clickable.
    const next =
      total > 0
        ? Math.round((accumulated / total) * bandW)
        : Math.round(((i + 1) / segments.length) * bandW)
    rects.push({ index: i, x: edge, w: next - edge, atom: classify(segments[i].atom) })
    edge = next
  }
  return rects
}

/**
 * Which segment a point in shape space falls in, or null for the margin, the
 * strip, and the rule. §8 requires clicking a segment to scroll its source text
 * into a margin panel, and a later pass types the clicked segment with 1–4; this
 * is the whole of what either needs:
 *
 *   bandSegmentIndexAt(shape, editor.getPointInShapeSpace(shape, point))
 *
 * A segment whose rounded width came out at zero cannot be hit — it occupies no
 * pixels, so there is nothing to click.
 */
export function bandSegmentIndexAt(
  shape: BandShape,
  point: { x: number; y: number }
): number | null {
  const { w, h, segments } = shape.props
  const l = bandLayout(w, h)
  if (point.y < l.bandTop || point.y > l.bandTop + l.bandH) return null
  const x = point.x - l.bandX
  if (x < 0 || x > l.bandW) return null
  let hit: number | null = null
  for (const rect of bandSegmentRects(segments, l.bandW)) {
    if (rect.w <= 0) continue
    if (x < rect.x) break
    hit = rect.index
  }
  return hit
}

function hatchPatternId(shapeId: string): string {
  // Ids live in one document: the wall holds every band at once and an export can
  // hold several, so the shape's own id is the only guaranteed-unique key.
  return `ec-band-hatch-${shapeId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

/**
 * Every mark on the band except the two runs of type. `component` puts this in
 * an inline `<svg>` and `toSvg` puts it in a `<g>`; it is the same element tree
 * both times, which is the only way a hatch, an opacity and a double rule are
 * guaranteed to be the same on the canvas and in the plate. A CSS
 * `repeating-linear-gradient` could do none of it: §2.4 forbids gradients, and
 * CSS reaches the canvas only (E10).
 */
function bandBody(shape: BandShape) {
  const { w, h, segments, mine } = shape.props
  const l = bandLayout(w, h)
  const hatch = hatchPatternId(shape.id)

  return (
    <>
      <defs>
        <pattern
          id={hatch}
          patternUnits="userSpaceOnUse"
          width={HATCH_TILE}
          height={HATCH_TILE}
        >
          <rect
            width={HATCH_TILE}
            height={HATCH_TILE}
            fill={INK_4}
            fillOpacity={UNCLASSIFIED_OPACITY}
          />
          {HATCH_LINES.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={INK_4} strokeWidth={1} />
          ))}
        </pattern>
      </defs>
      {/*
        §8's chapter break, and the only place the wall says anything about
        authorship. Two 1px rects with a 1px gap rather than one 3px stroke: the
        DOM and the SVG then cannot resolve `double` differently, and the rule
        cannot quietly collapse into a thick line (E15). It runs the full row,
        margin included — a chapter break separates everything below it from
        everything above, not just the diagram.
      */}
      {mine && (
        <g>
          <rect x={0} y={l.ruleY} width={w} height={1} fill={INK_3} />
          <rect x={0} y={l.ruleY + DOUBLE_RULE_H - 1} width={w} height={1} fill={INK_3} />
        </g>
      )}
      {/*
        The band carries its own paper. Both fills are translucent, so without a
        stated ground they would composite against whatever the export happened
        to sit on and the figure's colours would depend on where it was opened.
      */}
      <rect x={l.bandX} y={l.bandTop} width={l.bandW} height={l.bandH} fill={PAPER} />
      {bandSegmentRects(segments, l.bandW).map((rect) => {
        const pigment = rect.atom ? ATOM_PIGMENT_HEX[rect.atom] : null
        return (
          <rect
            key={rect.index}
            x={l.bandX + rect.x}
            y={l.bandTop}
            width={rect.w}
            height={l.bandH}
            fill={pigment ?? `url(#${hatch})`}
            fillOpacity={pigment ? SEGMENT_OPACITY : 1}
          />
        )
      })}
      {/*
        A hairline around the diagram, in the house's own rule colour. Without it
        a hatched unit at either end has no edge, and the band's extent — which
        is the axis the whole comparison is read against — becomes a guess.
      */}
      <rect
        x={l.bandX + 0.5}
        y={l.bandTop + 0.5}
        width={Math.max(0, l.bandW - 1)}
        height={Math.max(0, l.bandH - 1)}
        fill="none"
        stroke={BONE}
        strokeWidth={1}
      />
    </>
  )
}

interface StripRun {
  text: string
  /** null paints --ink-4: separators, the ellipsis, and unclassified units alike. */
  atom: UnitAtom
}

function tokenFor(atom: UnitAtom): string {
  return atom ? atom.toUpperCase() : UNCLASSIFIED_MARK
}

function measureStrip(editor: Editor, text: string): number {
  return editor.textMeasure.measureText(text, {
    fontStyle: 'normal',
    fontWeight: '500',
    fontFamily: MONO_FAMILY,
    fontSize: STRIP_SIZE,
    lineHeight: 1,
    maxWidth: null,
    padding: '0px',
    otherStyles: { 'font-feature-settings': FEATURES, 'letter-spacing': STRIP_TRACKING },
  }).w
}

/**
 * The strip, cut to the band's width. §8's own example ends in an ellipsis, and
 * that is the right answer: the strip is an index of the opening rhythm, not a
 * transcript, and the band underneath is the complete record — nothing is lost
 * by stopping. Shrinking the type would break the one mono label size the system
 * has, and wrapping would break the 20px strip and the row's height with it.
 */
function fitStrip(editor: Editor, atoms: UnitAtom[], maxW: number): StripRun[] {
  if (atoms.length === 0) return []

  const full = atoms.map(tokenFor).join(STRIP_SEP)
  const width = measureStrip(editor, full)

  let keep = atoms.length
  if (width > maxW) {
    // Mono: every character has the same advance, so the fit is a character count
    // and one measurement answers it for every prefix.
    const advance = width / full.length
    const capacity = Math.floor(maxW / advance) - STRIP_MORE.length
    let used = 0
    keep = 0
    for (const atom of atoms) {
      const cost = (keep > 0 ? STRIP_SEP.length : 0) + tokenFor(atom).length
      if (used + cost > capacity) break
      used += cost
      keep += 1
    }
  }

  const runs: StripRun[] = []
  for (let i = 0; i < keep; i++) {
    if (i > 0) runs.push({ text: STRIP_SEP, atom: null })
    runs.push({ text: tokenFor(atoms[i]), atom: atoms[i] })
  }
  if (keep < atoms.length) runs.push({ text: keep > 0 ? STRIP_MORE : '…', atom: null })
  return runs
}

/** SVG collapses runs of whitespace; nbsp survives. Same trick tldraw's own exporter uses. */
function preserveSpaces(text: string): string {
  return text.replace(/\s/g, ' ')
}

function measureTitle(editor: Editor, text: string): number {
  return editor.textMeasure.measureText(text, {
    fontStyle: 'italic',
    fontWeight: '400',
    fontFamily: DISPLAY_FAMILY,
    fontSize: TITLE_SIZE,
    lineHeight: 1,
    maxWidth: null,
    padding: '0px',
    otherStyles: { 'font-feature-settings': FEATURES, 'letter-spacing': TITLE_TRACKING },
  }).w
}

/**
 * The title, cut to its margin. Measured rather than clamped in CSS: the display
 * face is proportional, so `text-overflow: ellipsis` and a measured cut land on
 * different characters, and the canvas would then disagree with the plate by a
 * letter. One fit, both paths — the sibling shapes' rule, applied to a line that
 * does not wrap.
 */
function fitTitle(editor: Editor, title: string, maxW: number): string {
  const text = preserveSpaces(title.trim())
  if (!text) return ''
  if (measureTitle(editor, text) <= maxW) return text

  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measureTitle(editor, cut(text, mid)) <= maxW) lo = mid
    else hi = mid - 1
  }
  return cut(text, lo)
}

function cut(text: string, keep: number): string {
  return `${text.slice(0, keep).trimEnd()}…`
}

function paintVar(atom: UnitAtom): string {
  return (atom ? ATOM_PIGMENT[atom] : null) ?? 'var(--ink-4)'
}

function paintHex(atom: UnitAtom): string {
  return (atom ? ATOM_PIGMENT_HEX[atom] : null) ?? INK_4
}

export class BandShapeUtil extends ShapeUtil<BandShape> {
  static override type = 'band' as const

  static override props: RecordProps<BandShape> = {
    w: T.number,
    h: T.number,
    title: T.string,
    /**
     * `atom` is validated as a nullable string, not as the atom enum, because
     * the registered prop type is `string | null` and because a corpus file is
     * written by a CLI and edited by hand: an unknown type name should draw as
     * an unclassified unit, which is the truth about it, rather than make the
     * whole wall fail to load. `weight` is a plain number for the same reason —
     * `T.unitInterval` would reject a caller that passed raw word counts, and
     * `bandSegmentRects` normalizes those into a correct band instead.
     */
    segments: T.arrayOf(T.object({ atom: T.string.nullable(), weight: T.number })),
    mine: T.boolean,
    slug: T.string,
  }

  getDefaultProps(): BandShape['props'] {
    return {
      w: BAND_SHAPE_W,
      h: BAND_SHAPE_H,
      title: '',
      segments: [],
      mine: false,
      slug: '',
    }
  }

  // The band's size is data, not taste: its width is the axis every segment's
  // share is measured against and its height is §8's 64px, both generated from
  // the assembly file. Dragging a corner would say something about the essay
  // that the essay does not say. Rotation goes for the stronger version of the
  // same reason — the x-axis *is* normalized position through the essay, and a
  // tilted band has no such axis.
  override canResize() {
    return false
  }

  override hideRotateHandle() {
    return true
  }

  // Arrows mean dependency between atoms (§6.3) or correspondence across the
  // delta (E17). Neither relation has anything to say about an essay-sized
  // object, and an arrow bound to a band would walk into the readout's graph as
  // one of them.
  override canBind() {
    return false
  }

  // The title comes from `corpus/<slug>.assembly.json` and classification is
  // written back to that file by 1–4 on a selected segment (§8). Editing text on
  // the canvas would fork the band from the file it is a view of.
  override canEdit() {
    return false
  }

  /**
   * Filled: §8's click target is the segment, and a segment is interior. The
   * margin and the strip are inside the same rect deliberately — they are the
   * band's title and its sequence, so clicking either should select the band the
   * way clicking its bar does. `bandSegmentIndexAt` returns null there, which is
   * what tells the margin panel that no segment was asked for.
   */
  override getGeometry(shape: BandShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  /** What the exporter must inline for a band to survive leaving this app (§5.4). */
  override getFontFaces(): TLFontFace[] {
    return [
      {
        family: 'Instrument Serif',
        src: { url: '/fonts/instrument-serif-latin-400-italic.woff2', format: 'woff2' },
        weight: '400',
        style: 'italic',
      },
      {
        family: 'JetBrains Mono',
        src: { url: '/fonts/jetbrains-mono-latin-500-normal.woff2', format: 'woff2' },
        weight: '500',
        style: 'normal',
      },
    ]
  }

  override getIndicatorPath(shape: BandShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  component(shape: BandShape) {
    const { w, h, title, segments } = shape.props
    const l = bandLayout(w, h)
    const runs = fitStrip(this.editor, segments.map((segment) => classify(segment.atom)), l.bandW)
    const label = fitTitle(this.editor, title, l.bandX)

    return (
      <HTMLContainer className="ec-band">
        {/*
          Drawn, not styled. The band is a diagram: its fills, its hatch and its
          rule are geometry, and geometry that only exists in CSS does not reach
          the plate (E10). No border on the container either — a border box would
          offset both absolutely positioned runs of type 1px from their SVG
          twins (E4).
        */}
        <svg
          className="ec-band__body"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          aria-hidden="true"
        >
          {bandBody(shape)}
        </svg>
        <div
          className="ec-band__strip"
          style={{ top: l.stripTop, left: l.bandX, width: l.bandW, height: l.stripH }}
        >
          {runs.map((run, i) => (
            <span key={i} style={{ color: paintVar(run.atom) }}>
              {run.text}
            </span>
          ))}
        </div>
        {/* Right-aligned to the band: the title's right edge is the band's left edge. */}
        <div
          className="ec-band__title"
          style={{ top: l.bandTop, left: 0, width: l.bandX, height: l.bandH }}
        >
          {label}
        </div>
      </HTMLContainer>
    )
  }

  /**
   * E10: CSS reaches the canvas only. The body is the same element tree the
   * canvas draws; only the type is placed again, from the same layout and the
   * same fit, because SVG has no flexbox to centre it with.
   */
  override toSvg(shape: BandShape, _ctx: SvgExportContext) {
    const { w, h, title, segments } = shape.props
    const l = bandLayout(w, h)
    const runs = fitStrip(this.editor, segments.map((segment) => classify(segment.atom)), l.bandW)
    const label = fitTitle(this.editor, title, l.bandX)

    return (
      <g>
        {bandBody(shape)}
        {/*
          Each span box is symmetric about the font's central baseline, so the
          box's midpoint plus dominant-baseline="central" lands the line exactly
          where the flex-centred DOM box puts it.
        */}
        <text
          x={l.bandX}
          y={l.stripTop + l.stripH / 2}
          dominantBaseline="central"
          fontFamily={MONO_FAMILY}
          fontSize={STRIP_SIZE}
          fontWeight="500"
          letterSpacing={STRIP_TRACKING}
          style={{ fontFeatureSettings: FEATURES }}
        >
          {runs.map((run, i) => (
            <tspan key={i} fill={paintHex(run.atom)}>
              {run.text}
            </tspan>
          ))}
        </text>
        {label && (
          <text
            x={l.bandX}
            y={l.bandTop + l.bandH / 2}
            textAnchor="end"
            dominantBaseline="central"
            fontFamily={DISPLAY_FAMILY}
            fontSize={TITLE_SIZE}
            fontStyle="italic"
            fontWeight="400"
            letterSpacing={TITLE_TRACKING}
            fill={INK}
            style={{ fontFeatureSettings: FEATURES }}
          >
            {label}
          </text>
        )}
      </g>
    )
  }
}
