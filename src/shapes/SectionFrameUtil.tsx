import { FrameShapeUtil } from 'tldraw'
import type { SvgExportContext, TLFontFace, TLShape } from 'tldraw'

/**
 * Essay sections, BUILD.md §7 Stage 2: a frame is a section, and its title is
 * set in Instrument Serif italic 20px in `--ink`.
 *
 * The canvas already renders that correctly, through CSS on `.tl-frame-heading`.
 * The export did not. tldraw's `frameHelpers.js` hard-codes the heading font for
 * SVG — `fontFamily: isSvg ? 'Arial' : 'Inter, sans-serif'` — and draws it in a
 * 4px-radius chip. A plate cut from a selection that included a frame therefore
 * shipped its section titles in unembedded Arial at a radius §2.3 forbids, on
 * whatever machine opened it. That is precisely the failure §5.4 exists to
 * prevent, and it is invisible until the figure is opened somewhere else.
 *
 * So only `toSvg` is overridden here. This is E10's rule applied to a shape we
 * did not write: anything that must appear in an exported figure has to come
 * from a display value, a shape prop, or `toSvg` output — never from CSS, which
 * the exporter does not consult.
 *
 * The heading is drawn as text alone. tldraw's chip is a hit target for
 * dragging a frame by its title, which is a canvas affordance with no meaning
 * in a printed figure, and its 4px radius could not survive §2.3 anyway.
 */

/**
 * These transcribe tokens.css and theme.ts; they are not new values. The same
 * posture as AtomShapeUtil — the SVG path cannot read CSS custom properties,
 * and the text measurer needs the identical family string the DOM resolves.
 */
const INK = '#1a1410'
const PAPER = '#f5efe2'
const BONE = '#d6c9ad'
const DISPLAY_FAMILY = "'Instrument Serif', 'Cormorant Garamond', 'EB Garamond', Georgia, serif"
/** tokens.css sets these on `body`; stating them explicitly keeps DOM, measurer and SVG in step. */
const FEATURES = "'kern', 'liga', 'onum', 'pnum'"

const HEADING_SIZE = 20
const HEADING_LEADING = 1.7

/**
 * Where the canvas puts the heading, in page units at zoom 1.
 *
 * `--tl-frame-height` is the 24px heading box; `FrameShapeUtil` offsets it by
 * -7 across and 4 above the frame's top edge. Those three numbers are divided
 * by zoom on canvas so the title stays legible while zooming, which means the
 * canvas and a fixed-scale export can only agree at one zoom — and zoom 1 is
 * the one where a page unit is a CSS pixel. That is the parity this matches,
 * and it is the same parity M1 established for the card.
 *
 * Measured against the running canvas at zoom 1: the heading's 24px box spans
 * -28 to -4 from the frame top, and the text's line box spans -32.875 to
 * +1.125. Both are centred on -16, which is why one number places the text.
 */
const HEADING_BOX_H = 24
const HEADING_OFFSET_X = -7
const HEADING_OFFSET_Y = 4
const HEADING_CENTER_Y = -(HEADING_BOX_H + HEADING_OFFSET_Y) + HEADING_BOX_H / 2

/** tldraw's own placeholder for an unnamed frame. Kept so the two paths agree. */
const UNNAMED = 'Frame'

/** SVG collapses runs of whitespace; nbsp survives. Same trick tldraw's exporter uses. */
function preserveSpaces(text: string): string {
  return text.replace(/\s/g, ' ')
}

export class SectionFrameUtil extends FrameShapeUtil {
  /**
   * A section frame does not clip its children.
   *
   * `BaseFrameLikeShapeUtil.getClipPath` returns the frame's own vertices, so a
   * card overhanging the edge was drawn amputated — cut mid-sentence, and if it
   * hung off the top, without the eyebrow that says what kind of atom it is.
   * E14 examined that and ruled the export faithful, which it was: both paths
   * read their mask from `getClipPath` through `editor.getShapeMask`, so the
   * figure was reproducing the canvas exactly. The clipping itself was the
   * defect, and it was wrong in both places at once.
   *
   * The ruling: **a frame is a section boundary, not a viewport.** Paper does
   * not hide words. A section that has grown past its own edge is telling
   * Jordan something true about the essay's shape, and the canvas answering by
   * cutting the card in half destroys exactly the information he needs — §16 is
   * explicit that the canvas must never quietly rewrite what he placed, and
   * hiding half of it is a louder version of the same sin.
   *
   * Returning undefined is the documented way to opt out. Because one hook
   * feeds both the canvas mask and the exporter's SVG clip path, parity holds
   * by construction rather than by agreement (E10). This supersedes E14's
   * diagnostic note; see E36.
   */
  override getClipPath(): undefined {
    return undefined
  }

  /**
   * What the exporter must inline for a section title to survive leaving this
   * app (§5.4). Without the italic face declared here the embedder never fetches
   * it, and the title falls back to a system serif in the published figure —
   * the same silent failure, one step further along.
   */
  override getFontFaces(): TLFontFace[] {
    return [
      {
        family: 'Instrument Serif',
        src: { url: '/fonts/instrument-serif-latin-400-italic.woff2', format: 'woff2' },
        weight: '400',
        style: 'italic',
      },
    ]
  }

  override toSvg(shape: TLShape<'frame'>, _ctx: SvgExportContext) {
    const { w, h, name } = shape.props
    const title = (name.trim() === '' ? UNNAMED : name).trim()

    // Measured, not guessed: the same measurer the canvas lays the title out
    // with, so a title too long for its frame truncates at the same word in
    // both. Truncation width is the frame itself — a section title that ran
    // past its own section would be lying about what it labels.
    const spans = this.editor.textMeasure.measureTextSpans(title, {
      overflow: 'truncate-ellipsis',
      width: Math.max(0, w),
      height: HEADING_BOX_H,
      padding: 0,
      fontSize: HEADING_SIZE,
      fontWeight: '400',
      fontFamily: DISPLAY_FAMILY,
      fontStyle: 'italic',
      lineHeight: HEADING_LEADING,
      textAlign: 'start',
      otherStyles: { 'font-feature-settings': FEATURES },
    })
    const written = spans.map((span) => span.text).join('')

    return (
      <g>
        {/* §7 Stage 2: paper ground, 1px bone, no fill tint, no shadow. The
            values match theme.ts's frameFill and frameStroke, which is what the
            canvas draws. */}
        <rect x={0} y={0} width={w} height={h} rx={0} ry={0} fill={PAPER} stroke={BONE} strokeWidth={1} />
        {/* Centred with dominant-baseline, the way every other shape in this
            repo places text: a span box is symmetric about the font's central
            baseline, so its midpoint lands the glyphs where the DOM puts them
            without needing the font's ascent and descent. */}
        <text
          x={HEADING_OFFSET_X}
          y={HEADING_CENTER_Y}
          dominantBaseline="central"
          fontFamily={DISPLAY_FAMILY}
          fontSize={HEADING_SIZE}
          fontStyle="italic"
          fontWeight="400"
          fill={INK}
          style={{ fontFeatureSettings: FEATURES }}
        >
          {preserveSpaces(written)}
        </text>
      </g>
    )
  }
}
