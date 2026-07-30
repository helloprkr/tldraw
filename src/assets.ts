import { DEFAULT_EMBED_DEFINITIONS, LANGUAGES, iconTypes } from 'tldraw'
import type { TLUiAssetUrls } from 'tldraw'

/**
 * Local only (BUILD.md §2.6). Out of the box tldraw fetches its icon sprite,
 * translations, embed icons, and four typefaces from cdn.tldraw.com — roughly
 * forty requests off this machine on every load. Everything is redirected to
 * files in public/.
 *
 * The typefaces matter twice over: tldraw's own font faces are declared on the
 * document, and the SVG exporter embeds by walking document stylesheets and
 * fetching each source. Same-origin sources embed; cross-origin ones can fail
 * silently, which is exactly the failure §5.4 exists to prevent.
 */

const SPRITE = '/tldraw-assets/icons.svg'
const FONT_DIR = '/fonts'

/**
 * tldraw's four named families all resolve to ours. Any text tldraw renders on
 * its own — a frame label, an aria string — lands in the house type rather than
 * IBM Plex. tldraw asks for italic and bold cuts we do not carry in every
 * family; those fall back to the nearest cut we do.
 */
const fonts = {
  tldraw_mono: `${FONT_DIR}/jetbrains-mono-latin-400-normal.woff2`,
  tldraw_mono_italic: `${FONT_DIR}/jetbrains-mono-latin-400-normal.woff2`,
  tldraw_mono_bold: `${FONT_DIR}/jetbrains-mono-latin-500-normal.woff2`,
  tldraw_mono_italic_bold: `${FONT_DIR}/jetbrains-mono-latin-500-normal.woff2`,
  tldraw_serif: `${FONT_DIR}/eb-garamond-latin-400-normal.woff2`,
  tldraw_serif_italic: `${FONT_DIR}/eb-garamond-latin-400-italic.woff2`,
  tldraw_serif_bold: `${FONT_DIR}/eb-garamond-latin-600-normal.woff2`,
  tldraw_serif_italic_bold: `${FONT_DIR}/eb-garamond-latin-600-italic.woff2`,
  tldraw_sans: `${FONT_DIR}/eb-garamond-latin-400-normal.woff2`,
  tldraw_sans_italic: `${FONT_DIR}/eb-garamond-latin-400-italic.woff2`,
  tldraw_sans_bold: `${FONT_DIR}/eb-garamond-latin-600-normal.woff2`,
  tldraw_sans_italic_bold: `${FONT_DIR}/eb-garamond-latin-600-italic.woff2`,
  tldraw_draw: `${FONT_DIR}/instrument-serif-latin-400-normal.woff2`,
  tldraw_draw_italic: `${FONT_DIR}/instrument-serif-latin-400-italic.woff2`,
  tldraw_draw_bold: `${FONT_DIR}/instrument-serif-latin-400-normal.woff2`,
  tldraw_draw_italic_bold: `${FONT_DIR}/instrument-serif-latin-400-italic.woff2`,
}

const icons = Object.fromEntries(
  iconTypes.map((name) => [name, `${SPRITE}#${name}`])
) as TLUiAssetUrls['icons']

/**
 * English is tldraw's baked-in fallback, so the served file is an empty object
 * and every other locale points at the same file. This app is single-user and
 * English; no locale should reach across the network to prove it.
 */
const translations = Object.fromEntries(
  LANGUAGES.map((lang) => [lang.locale, '/tldraw-assets/en.json'])
) as TLUiAssetUrls['translations']

/**
 * Embeds are removed from this build, so these are never drawn. They are still
 * constructed and preloaded, so they still have to be local.
 */
const embedIcons = Object.fromEntries(
  DEFAULT_EMBED_DEFINITIONS.map((def) => [def.type, SPRITE])
) as TLUiAssetUrls['embedIcons']

export const assetUrls: TLUiAssetUrls = { fonts, icons, translations, embedIcons }
