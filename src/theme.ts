import { DEFAULT_THEME } from 'tldraw'
import type { TLTheme, TLThemeColors, TLThemeFont } from 'tldraw'

/**
 * The canvas chrome tldraw draws to a raster context — selection outline, resize
 * corners, brush, snap lines — reads its colors from the theme record, not from
 * CSS custom properties. So tokens.css cannot reach it. These literals are the
 * same values as tokens.css; they are transcribed, not invented.
 *
 * tokens.css remains the single source for anything the DOM renders.
 */
const PAPER = '#f5efe2'
const PAPER_WARM = '#ebe2cf'
const INK = '#1a1410'
const INK_3 = '#6b5a4c'
const BONE = '#d6c9ad'
const OCHRE = '#c08a3e'
const MARKER_BG = 'rgb(192 138 62 / 0.22)'

const FONT_DIR = '/fonts'

const displayFont: TLThemeFont = {
  fontFamily: "'Instrument Serif', Georgia, serif",
  faces: [
    {
      family: 'Instrument Serif',
      src: { url: `${FONT_DIR}/instrument-serif-latin-400-normal.woff2`, format: 'woff2' },
      weight: '400',
      style: 'normal',
    },
  ],
}

const bodyFont: TLThemeFont = {
  fontFamily: "'EB Garamond', Georgia, serif",
  faces: [
    {
      family: 'EB Garamond',
      src: { url: `${FONT_DIR}/eb-garamond-latin-400-normal.woff2`, format: 'woff2' },
      weight: '400',
      style: 'normal',
    },
  ],
}

const monoFont: TLThemeFont = {
  fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
  faces: [
    {
      family: 'JetBrains Mono',
      src: { url: `${FONT_DIR}/jetbrains-mono-latin-400-normal.woff2`, format: 'woff2' },
      weight: '400',
      style: 'normal',
    },
  ],
}

/** Chrome colors, applied identically to both color modes: the app has one look. */
const chrome = {
  text: INK,
  background: PAPER,
  negativeSpace: PAPER,
  solid: PAPER_WARM,
  cursor: INK,
  noteBorder: BONE,
  snap: OCHRE,
  selectionStroke: INK,
  selectionFill: 'transparent',
  brushFill: MARKER_BG,
  brushStroke: INK_3,
  selectedContrast: PAPER,
  laser: OCHRE,
} satisfies Partial<TLThemeColors>

function paint(base: TLThemeColors): TLThemeColors {
  // Every named shape color collapses to ink on paper. Color on this canvas is
  // semantic and lives in our own shapes; tldraw's palette must never introduce
  // a hue we did not choose.
  const inked = Object.fromEntries(
    Object.entries(base).map(([key, value]) => {
      if (typeof value === 'string') return [key, value]
      return [
        key,
        {
          ...value,
          solid: INK,
          semi: PAPER_WARM,
          pattern: BONE,
          fill: INK,
          linedFill: PAPER_WARM,
          frameHeadingStroke: BONE,
          frameHeadingFill: PAPER,
          frameStroke: BONE,
          frameFill: PAPER,
          frameText: INK,
          noteFill: PAPER_WARM,
          noteText: INK,
          highlightSrgb: MARKER_BG,
          highlightP3: MARKER_BG,
        },
      ]
    })
  ) as TLThemeColors

  return { ...inked, ...chrome }
}

export const essayTheme: TLTheme = {
  ...DEFAULT_THEME,
  fonts: {
    ...DEFAULT_THEME.fonts,
    draw: displayFont,
    sans: bodyFont,
    serif: bodyFont,
    mono: monoFont,
  },
  colors: {
    light: paint(DEFAULT_THEME.colors.light),
    dark: paint(DEFAULT_THEME.colors.dark),
  },
}
