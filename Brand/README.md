# Jordan Parker — Cultural Architect

> "A cultural architect is one who designs the conditions under which culture metabolizes."

This is the design system for **Jordan Parker**, an independent researcher and writer cultivating a practice he calls **Cultural Architecture** — discourse, writing, and media that runs along the seams between AI, mathematics, physics, psychology, evolutionary psychology, ecology, culture, and what he names *emergent abundance*.

The work is essayistic, cross-disciplinary, and unhurried. The visual identity is built to match: a system that reads like a private notebook printed on good paper — confident, scholarly, warm. Not corporate. Not techno-optimist. Not minimalist-for-its-own-sake. The reference points are **Stewart Brand's Whole Earth Catalog**, **Stripe Press's book design**, **The New York Review of Books**, and the marginalia traditions of 16th–18th c. printed scholarship.

## Sources

No external assets, codebases, or Figma files were provided for this build. The system below is a from-first-principles proposal based on Jordan's positioning as a "Cultural Architect." If reference material exists (past site, Notion, prior decks, commissioned typography), please attach via the **Import** menu and I'll reconcile.

---

## CONTENT FUNDAMENTALS

### Voice
The voice is **first-person, essayistic, and unhurried**. Jordan writes as a thinker mid-thought, not as an authority delivering verdicts. Sentences are long, often clausal, with em-dashes used liberally. Aphoristic punctuation lands at the ends of paragraphs.

> "I keep returning to the same question, in different rooms, with different tools. The question is what holds — what holds a culture, what holds a self, what holds the field of attention. Everything else is method."

### Tone register
Three modes coexist, signaled by context:

1. **Essay mode** — long, clausal, comma-rich. The default for longform.
2. **Note mode** — fragmentary, declarative, marginalia. Dated, often a single sentence.
3. **Address mode** — for talks and broadcasts. First-person plural, slightly elevated. *"We are not in a crisis of meaning. We are in a crisis of metabolism — meaning is arriving faster than we can digest it."*

### Pronouns & address
- "I" in essays. The reader is implied, not named.
- "You" reserved for direct provocations. *"You already know this. The question is what you do with the knowing."*
- "We" only when speaking culturally / generationally. Never the editorial "we."

### Casing
- **Sentence case** everywhere except mono labels.
- **UPPERCASE** mono is used as eyebrow/meta only — section markers, dates, categories. Never for headlines.
- Titles capitalize like a sentence: "On the metabolism of attention," not "On The Metabolism Of Attention."

### Punctuation
- Em-dashes — yes, frequently, no surrounding spaces.
- Oxford comma — yes.
- Curly quotes "always" and 'never' straight.
- Italics for emphasis, never bold in body. Bold reserved for UI.
- One space after a period.

### Emoji & symbols
- **No emoji.** Anywhere. This is a system that predates emoji.
- Typographic dingbats are welcome: **❦**, **§**, **¶**, **※**, **†**, **‡**, **◊**.
- Mathematical symbols appear naturally in body text without ceremony: *e*, *π*, ∂, ∇, ≈.

### Vocabulary
Recurring concepts to be set as proper nouns when first introduced: *Cultural Architecture*, *emergent abundance*, *metabolism*, *attention field*, *the seam*, *the practice*. After first use, lowercase.

Words to avoid: *innovate*, *disrupt*, *unlock*, *leverage*, *ecosystem* (when not literal), *journey*, *space* (as in "the AI space"), *deep dive*, *thought leader*.

Words to embrace: *practice*, *discipline*, *attend*, *metabolize*, *seam*, *figure*, *ground*, *carry*, *hold*, *tend*.

### Examples by surface

- **Tweet:** *"Most of what is called thinking is just well-rehearsed retrieval."*
- **Essay title:** *"On the metabolism of attention"* / *"What a culture cannot digest"* / *"Notes from the seam"*
- **Newsletter subject:** *"Field notes — week 17"* (no exclamation, no preview text gimmicks)
- **CTA:** *"Read the essay"* — never *"Read more →"* or *"Learn more"*

---

## VISUAL FOUNDATIONS

### The governing metaphor
**Printer's ink on uncoated paper.** Every visual decision proceeds from this. The screen is not a glowing surface; it is a sheet of cream stock under a reading lamp. This forces warmth, restraint, and weight in the right places.

### Color
A warm-earth palette, anchored by ink and paper, with pigments used as **marginalia** — never as the main event.

- **Paper (cream)** is the default background, never pure white.
- **Ink** is a warm near-black (#1a1410), never pure black.
- **Ochre** is the primary accent, used like a highlighter pencil — for marks, links in dark contexts, the wordmark serif.
- **Oxblood** is the link color in body text, a tradition older than the web.
- **Terracotta** signals warmth and energy; reserved.
- **Moss** is the cool counterweight, used for ecological and natural references.
- **Lapis** is rare, reserved for diagrams and scientific figures.

Full palette in `colors_and_type.css`. **Rule of thumb:** ink and paper do 90% of the work. A single pigment per page. Never two saturated pigments adjacent.

### Type
- **Display:** *Instrument Serif* — high-contrast, italic-leaning. Use for titles, the wordmark, pull quotes. Set large, set generously, set with tight tracking.
- **Body:** *EB Garamond* — set at **19px** with **1.7 line-height**. Long measures (62ch). Old-style numerals on. The body is the system.
- **Mono:** *JetBrains Mono* — only as a **label** (meta, eyebrow, caption). Always uppercase, always wide-tracked (~0.12em), always smaller than the body.

Italics are used heavily — for emphasis, for the dropped voice, for marginalia. Bold is reserved for UI moments (button labels, active nav).

### Spacing & rhythm
- 4px base scale, but the system breathes at the high end (96, 128, 192).
- **Generous whitespace is the signature.** A heading sits in space. A pull quote gets a paragraph's worth of air above and below.
- Reading column locked to ~62ch. Wide layouts use a 12-column grid with a narrow center text column and a wide margin for marginalia.

### Backgrounds
- Solid paper cream is the default.
- **No gradients.** Ever. Not in backgrounds, not in buttons, not behind images.
- Full-bleed imagery is acceptable on talks/essays but rare — when used, the image is treated like a plate in a book, with a caption set in mono below.
- **Repeating patterns** are welcome but only as printer's-marbling-style textures, hairline grids for diagrams, or hand-drawn rules. Never digital noise textures.

### Animation & motion
- **Slow, considered, never playful.** Easing leans `cubic-bezier(0.2, 0.6, 0.2, 1)` — long out-curves.
- Fades are the default. **No bounces, no springs, no kinetic type.**
- Page transitions are 420–680ms cross-fades.
- Hover transitions are 120ms.
- Reading-progress and scroll-linked motion are welcome when they reveal structure (e.g. a tracker in the margin showing what section you're in).

### Hover & press states
- **Hover (links):** color shifts from `--link` (oxblood) to `--link-hover` (terracotta). No underline change.
- **Hover (buttons):** background darkens 6–8% via OKLCH or an explicit pressed token. No scale, no shadow change.
- **Press:** translateY(1px), nothing more.
- **Focus:** a 2px ink outline with 2px offset. Always visible. This is a system that respects the keyboard.

### Borders, rules, shadows
- **Hairline rules in ink** are the structural element — between sections, around figures, under section headers. 1px solid `--rule` (a warm bone), or 1.5px solid ink for emphasis.
- **Double rules** (`3px double`) for chapter breaks and important figure captions — a printer's convention.
- **Shadows are almost never used.** Paper does not float. Reserved exclusively for: (1) modals, (2) the rare lifted card in a UI context. When used, shadows are warm (tinted with ink) and never blue.

### Cards
- **Cards are paper on paper.** A card is `--bg-2` or `--bg-3` (a slightly darker paper) on `--bg-1`, with a hairline rule, no shadow, no radius (or 2px max). They are sections of stock pinned to the page, not floating containers.

### Corner radii
- **2–4px maximum.** The system rounds reluctantly.
- Buttons are 2px. Cards are 0–2px. Inputs are 2px. Images and figures are sharp-cornered. **No pill-shaped anything** except tags in dense lists (and even then, rarely).

### Transparency & blur
- Transparency is used **only** for the highlighter effect (`--marker-bg`) and for protection gradients on full-bleed images.
- **No backdrop-filter blur.** No glassmorphism. Paper does not blur.

### Imagery
- **Warm, slightly desaturated, with grain when photographic.**
- Diagrams and figures in ink-and-paper or ink-and-ochre. Treat figures like book plates: numbered, captioned in mono.
- Classical/Renaissance references (etchings, scientific illustrations from the public domain) are welcome.
- **Avoid:** stock photography, AI-generated imagery, anything glossy, anything with synthetic gradients.

### Layout rules
- **The margin is sacred.** Sidenotes, dates, section markers, and figure references live in a left or right margin set in mono, at 13px, tracked wide.
- Fixed elements are rare. A thin top-of-page metadata bar is the only persistent UI; navigation is contextual and inline.
- Footers are typographic — colophon-style, set in mono, sentence-cased.

### What this system avoids (anti-patterns)
- Gradient backgrounds (especially blue/purple)
- Emoji
- Rounded-corner cards with a left-border accent stripe
- Drop-shadowed buttons
- Glassmorphism / backdrop blur
- AI-generated decorative imagery
- "Hero illustrations" of abstract shapes
- Animated bouncy springs
- Bold sans-serif everywhere
- Centered everything
- Dark mode by default (a separate dark variant may exist but cream-on-ink is **the** brand)

---

## ICONOGRAPHY

This system prefers **typographic symbols** and **diagrammatic icons** over UI icons.

### Approach in order of preference
1. **Typographic dingbats** — ❦ ※ § ¶ † ‡ ◊ → ← — these are real type, set inline with text. First choice for ornaments, dividers, list markers, navigation arrows.
2. **Lucide icons** (via CDN) — used sparingly for unavoidable UI moments (menu, close, copy-link). Stroke weight 1.5px to match the hairline rule system. Color always inherits from text — never accent-colored.
3. **Hand-drawn diagrammatic SVG** — for the marginalia of essays (a small index pointing at a paragraph, a hand-traced circle around a figure number). These exist in `assets/marginalia/` as a small library.

### What we do NOT do
- **No emoji.** Anywhere. Including in body text, social posts, or UI.
- **No filled material-style icons.** No glyphs in colored circles.
- **No icon fonts** other than Lucide-via-CDN. No FontAwesome, no Material Icons.
- **No flag icons, no avatars-with-initials-in-gradient-circles.**

### Logo & wordmark
The wordmark is **typographic**, set in Instrument Serif italic. There is no graphical mark. The full lockup pairs the name with the role:

```
Jordan Parker
CULTURAL ARCHITECT
```

— name set in Instrument Serif italic, role in JetBrains Mono uppercase, wide-tracked. The monogram form is **JP** in Instrument Serif italic, used only for favicons and avatar contexts. See `assets/logos/`.

### Lucide via CDN
```html
<script src="https://unpkg.com/lucide@latest"></script>
<i data-lucide="arrow-right"></i>
<script>lucide.createIcons();</script>
```

⚠️ **Flagged substitution:** Lucide is used as the substitute UI icon system because no proprietary icon set was provided. If Jordan commissions a custom set or has a preferred system, swap it in `ui_kits/*/icons.*`.

---

## INDEX

This system lives at the project root. Key files and folders:

```
/
├── README.md                  ← you are here
├── SKILL.md                   ← agent instructions for using this system
├── colors_and_type.css        ← all CSS variables and base semantic styles
├── fonts/
│   └── README.md              ← font choices + substitution notes
├── assets/
│   ├── logos/                 ← wordmark, monogram, favicon
│   ├── marginalia/            ← hand-drawn SVG ornaments (drawn here)
│   └── plates/                ← imagery placeholders (book-plate style)
├── preview/                   ← cards rendered in the Design System tab
│   ├── type-*.html
│   ├── color-*.html
│   ├── spacing-*.html
│   ├── components-*.html
│   └── brand-*.html
├── ui_kits/
│   ├── website/               ← personal site (homepage, essay index, about)
│   ├── reader/                ← longform essay reading layout
│   └── README.md
└── slides/
    ├── index.html             ← deck shell with all slide types
    ├── TitleSlide.jsx
    ├── ChapterSlide.jsx
    ├── QuoteSlide.jsx
    ├── DiagramSlide.jsx
    └── ClosingSlide.jsx
```

### Quick links

- **Foundations:** [`colors_and_type.css`](./colors_and_type.css)
- **Skill manifest:** [`SKILL.md`](./SKILL.md)
- **Personal site kit:** [`ui_kits/website/index.html`](./ui_kits/website/index.html)
- **Essay reader kit:** [`ui_kits/reader/index.html`](./ui_kits/reader/index.html)
- **Slide deck:** [`slides/index.html`](./slides/index.html)

---

## DEFAULTS APPLIED (no questions answered)

Because the question form timed out, the following defaults were chosen — flag any you want changed and I'll revise:

| Decision | Default chosen |
|---|---|
| Archetype | Editorial + cybernetic (Stewart Brand × Stripe Press × NYRB) |
| Color mood | Warm earth — cream, ink, ochre, oxblood, moss |
| Type | Instrument Serif (display) + EB Garamond (body) + JetBrains Mono (meta) |
| Tone | First-person essayistic, aphoristic; no emoji |
| Mark | "Jordan Parker" wordmark + "Cultural Architect" tagline |
| Surfaces built | Personal site, essay reader, talk slide deck |
| Variations | One cohesive direction (no parallel explorations) |
