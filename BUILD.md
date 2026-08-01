# BUILD.md — essay-canvas

**Executor:** Fable 5, working in Claude Code, inside this repo.
**Owner:** Jordan Parker.
**Status:** greenfield. Nothing exists yet except this file.

Read this whole document before writing code. Build in milestone order (M0 → M5). Stop at each milestone gate and report.

---

## 1. What this is

A local, single-user infinite canvas for composing essays spatially. Fragments come out of a folder as cards. Jordan clusters, types, and binds them by hand. The canvas writes an essay map back to markdown, and exports publication-ready figures in his own visual language.

It is **not** a whiteboard. It is **not** a diagramming tool. It is a *spatial editor for essay structure* whose output is (a) an outline and (b) a plate that ships with the published essay.

### The thesis that governs every decision

**Position means something.** On this canvas:

- **x-axis = abstraction.** Concrete on the left, abstract on the right.
- **y-axis = reading order.** Top is first.

Because placement carries meaning, dragging a card is an *editorial act*, and the file that comes out the other side is a real outline — not a picture of one. Any feature that would make position arbitrary is wrong for this build.

### What "done" looks like

Jordan drops twelve fragments of an idea into `inputs/`, runs one command, spends twenty minutes moving cards, presses `⌘E`, and gets an SVG that can go straight into an essay with no styling pass. That's the whole product.

---

## 2. Non-negotiables

Violating any of these means the milestone fails, regardless of what else works.

1. **Cream, not white. Warm near-black, not black.** `--paper: #f5efe2`, `--ink: #1a1410`. Pure white and pure black appear nowhere.
2. **No shadows on canvas objects.** Paper does not float. Shadows are permitted only on modals.
3. **Radius 0–2px.** Nothing is rounded beyond 2px. No pills.
4. **No gradients. No blur. No glassmorphism. No emoji.** Anywhere. Including in code comments that surface in UI, tooltips, and console output.
5. **One pigment per view.** Ink and paper do 90% of the work. Pigments are marginalia.
6. **Local only.** No server, no sync, no cloud, no telemetry, no account. Everything runs on `localhost` and writes to disk.
7. **The tldraw default look must be fully overridden.** See §5. If the app is recognizable as "a tldraw app," M0 has failed.

---

## 3. Stack and licensing

- **Vite + React + TypeScript.** React is a consequence of tldraw; it does not extend beyond this repo.
- **tldraw** (latest 4.x) via `npm install tldraw`.
- **Node 20+.**
- No backend. No database. Files on disk are the database.

### Licensing gate

tldraw is source-available, not open source. Its default license permits **development use only**; production requires a license key.

- **This build runs locally in dev. No key is needed. Do not add one.**
- **Do not deploy this app anywhere.** Not Vercel, not a preview URL, not a tunnel. If Jordan later wants the §12 Option 2 reader route live, that is production, and the licensing question opens then — not now.
- Exported SVG and PNG files are Jordan's own artwork and carry no tldraw obligation. Only the running app is licensed.

---

## 4. Repo layout

```
essay-canvas/
├── BUILD.md                     ← this file
├── package.json
├── vite.config.ts
├── index.html
├── inputs/                      ← Jordan's fragments. Source of truth.
│   └── <essay-slug>/
│       ├── 001-some-fragment.md
│       └── notes.md
├── corpus/                      ← essays for the corpus wall
│   ├── <slug>.md                ← raw essay, fresh-parse path
│   └── <slug>.assembly.json     ← pre-extracted atoms, file path
├── work/                        ← canvas state. Committed to git.
│   └── <essay-slug>.tldr
├── out/                         ← generated. Committed to git.
│   └── <essay-slug>/
│       ├── map.md               ← the outline, written by readout
│       ├── assembly.json        ← machine-readable atom program
│       └── figures/
│           ├── fig-01-the-delta.svg
│           ├── fig-01-the-delta@2x.png
│           └── figures.json     ← figure registry, numbering
├── public/
│   └── fonts/                   ← SELF-HOSTED woff2. See §5.4.
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── tokens.css               ← ported verbatim from colors_and_type.css
    ├── tldraw-overrides.css     ← the de-tldraw pass
    ├── shapes/
    │   ├── AtomShapeUtil.tsx
    │   ├── TicketShapeUtil.tsx
    │   ├── GapShapeUtil.tsx
    │   └── BandShapeUtil.tsx
    ├── views/
    │   ├── ComposeView.tsx      ← stages 1–6
    │   ├── DeltaView.tsx        ← visible absence
    │   └── CorpusWallView.tsx   ← the corpus wall
    ├── lib/
    │   ├── spread.ts
    │   ├── readout.ts
    │   ├── corpus.ts
    │   ├── exportFigure.ts
    │   ├── plate.tsx            ← the book-plate wrapper
    │   └── topo.ts              ← dependency sort + unsupported-claim check
    └── ui/
        ├── Toolbar.tsx
        └── Counter.tsx
```

**Rule:** `inputs/` is never written to by the app. Ever. It is Jordan's material. All generated output goes to `out/`, all canvas state to `work/`.

---

## 5. The design system port

The brand system is fully specified in `colors_and_type.css` and `README.md` (Jordan Parker — Cultural Architect). **Follow it exactly. The brief's words win over any design instinct.** Governing metaphor: *printer's ink on uncoated paper.* The screen is a sheet of cream stock under a reading lamp.

### 5.1 Tokens

Copy `colors_and_type.css` into `src/tokens.css` **verbatim**. Do not edit values. Do not add tokens. If something needs a color that isn't there, it's the wrong color.

### 5.2 Atom types → pigments

Four atom types, four pigments. This mapping is derived from the pigments' stated jobs in `README.md` and is not up for reinterpretation:

| Atom | Pigment | Hex | Why |
|---|---|---|---|
| `claim` | oxblood | `#5a1f1a` | "deep marker, scholarly" — the load-bearing assertion |
| `move` | ochre | `#c08a3e` | "the highlighter" — a rhetorical action performed on the reader |
| `figure` | lapis | `#2a3f6b` | README: "rare — for diagrams and scientific figures" |
| `stance` | moss | `#5d6a4a` | "cool counterweight" — where the writer stands |
| *(absence / ticket)* | terracotta | `#b5532e` | "warm alarm, energetic" — reserved. See §9. |

**Terracotta is reserved for absence.** It never types an atom. When Jordan sees terracotta on the canvas, it means *something is missing here.* That exclusivity is the whole point — do not spend it on decoration.

### 5.3 Card anatomy

A card is paper on paper. Concretely:

```
┌──────────────────────────────────┐   ← 1px solid var(--bone), radius 2px
│ ═══════════════════════════════  │   ← 1px top rule in the atom pigment
│ CLAIM · 04                       │   ← JetBrains Mono 12px, UPPER, 0.12em tracked,
│                                  │      color = the atom pigment
│ The received view treats         │   ← EB Garamond 17px / 1.5, color var(--ink)
│ attention as a resource to be    │
│ spent. It is closer to a         │
│ digestive capacity.              │
│                                  │
│ 2026-07-30            ¶ 003     │   ← Mono 12px, var(--ink-4), baseline meta
└──────────────────────────────────┘
   background: var(--paper-warm)  ·  NO shadow  ·  NO left stripe
```

**Explicitly forbidden:** a left-border accent stripe. `README.md` lists "rounded-corner cards with a left-border accent stripe" as an anti-pattern. The atom type is carried by the **mono eyebrow label** and the **hairline top rule**, which is a printer's convention, not a UI stripe.

Untyped cards get no top rule and an eyebrow reading `UNTYPED` in `--ink-4`. They should look *unfinished*, because they are.

### 5.4 Fonts — self-host them

Do **not** load fonts from the Google Fonts CDN.

tldraw's export pipeline embeds fonts by walking document stylesheets, fetching the `@font-face` sources, and inlining them as data URLs. Cross-origin CDN fonts will fail that fetch and the exported SVG will silently fall back to a system serif. The plates would then look wrong everywhere they're published, which defeats the entire purpose of §10.

1. Download woff2 for Instrument Serif (400, 400 italic), EB Garamond (400/500/600 + italics), JetBrains Mono (400/500).
2. Put them in `public/fonts/`.
3. Declare `@font-face` with local `/fonts/...` paths in `tokens.css`, replacing the `@import` line.
4. **Verify at M3:** open an exported `.svg` in a browser with the dev server stopped. If the type is still Garamond, embedding worked.

### 5.5 The de-tldraw pass

tldraw ships an opinionated look that violates most of §2. `src/tldraw-overrides.css` must kill all of it. Checklist — every line must be verified visually, not assumed:

| tldraw default | Replace with |
|---|---|
| White/grey canvas | `var(--paper)` |
| Blue selection outline | `var(--ink)`, 1.5px, no glow |
| Blue selection handles | `var(--ink)` squares, 0 radius, 6px |
| Rounded UI panels, 8px+ radius | 0–2px, `var(--bg-2)`, 1px `var(--bone)` |
| Drop shadows on panels/menus | none — hairline rules instead |
| Inter / system sans in UI | `var(--font-mono)` uppercase for labels, `var(--font-body)` for content |
| Blue focus rings | 2px `var(--ink)` outline, 2px offset |
| Spring/bounce animations | `var(--ease-out)`, `var(--dur-2)`/`var(--dur-3)` |
| Grid dots | hairline grid, `var(--bone)` at 40% opacity |
| Default arrow color | `var(--ink-3)`, 1px, small solid head |
| Style panel with color swatches | **remove entirely** — color is semantic here, not chosen |

Also remove from the UI: the shape tools Jordan doesn't need (geo, draw, laser, highlighter, note), the "share" menu, the zoom-percentage dropdown, and every piece of tldraw branding permitted by the trademark guidelines to be removed.

**M0 gate:** screenshot the empty canvas. If it reads as a tldraw app rather than a page from a notebook, iterate before moving on.

### 5.6 Motion

Fades only. `--dur-2` (220ms) for hovers and selections, `--dur-3` (420ms) for camera moves. `--ease-out` everywhere. No springs, no bounces, no kinetic type. Camera moves on `zoomToSelection` use `{ animation: { duration: 420, easing: <ease-out> } }`.

---

## 6. Data model

### 6.1 Input format

Each file in `inputs/<essay-slug>/` is one fragment. Optional YAML frontmatter:

```markdown
---
atom: claim          # claim | move | figure | stance | untyped (default)
frame: "Ground"      # optional pre-assigned section
id: f-003            # stable id; generated from filename if absent
---

The received view treats attention as a resource to be spent.
It is closer to a digestive capacity.
```

Additionally, a file named `notes.md` is split on `---` horizontal rules into multiple fragments, each inheriting the file's frontmatter. This is the low-friction path: Jordan pastes a wall of thinking, separates with `---`, done.

### 6.2 Shape types

Four custom `ShapeUtil`s. Each implements `getDefaultProps`, `getGeometry`, `component`, `getIndicatorPath`, and — critically — **`toSvg`**, because the default `foreignObject` fallback produces fragile exports.

```ts
// AtomShape — the card
{ w, h, atom: AtomType, text: string, sourceId: string, created: string, ordinal: number }

// TicketShape — an open question. Terracotta.
{ w, h, text: string, kind: 'grill' | 'research' | 'trial' }

// GapShape — a hole. See §9.
{ w, h, label: string, facingId: string | null }

// BandShape — one essay's atom sequence. See §8.
{ w, h, title: string, segments: Array<{ atom: AtomType, weight: number }> }
```

### 6.3 Bindings

Arrows between atoms mean **dependency**: "this claim needs that one to land first." Use tldraw's native arrow bindings — they stay attached through move, resize, and reparenting, which is exactly the behavior needed and not worth reimplementing.

### 6.4 State on disk

Canvas state is a `.tldr` file — a JSON store snapshot with a schema version, so it migrates forward across tldraw releases. `work/<essay-slug>.tldr` is committed to git. This gives Jordan version history of an essay's *structure*, not just its sentences.

---

## 7. The eight stages

Each stage is a buildable feature with an acceptance criterion. Build them in order; they compose.

### Stage 0 — Capture (out of scope)

Capture stays in Obsidian and Raycast. This app begins when a pile of fragments has already decided it wants to be an essay. **Build nothing here.**

### Stage 1 — Spread

`npm run spread -- <essay-slug>`

Reads `inputs/<essay-slug>/*.md`, creates one AtomShape per fragment, lays them out in a loose grid ordered by filename, opens the canvas.

- Grid: 320px cards, 48px gutters (`--s-7`), ~5 columns, wrapping.
- Cards are **untyped** on arrival unless frontmatter says otherwise.
- Re-running `spread` on an existing `.tldr` **adds only new fragments** and places them in a staging column to the left of the canvas at x = -600. It never moves or deletes existing cards. Jordan's arrangement is sacred.
- Camera fits all shapes on open.

**Acceptance:** twelve fragments become twelve readable cards, all visible without scrolling, in under two seconds.

### Stage 2 — Cluster and frame

Manual dragging plus frames.

- `F` with a selection → wraps it in a tldraw frame.
- Frame title: Instrument Serif italic, 20px, `var(--ink)`, editable in place.
- Frame background `var(--paper)`, 1px `var(--bone)` border, no fill tint, no shadow.
- Frames are the essay's sections. Their **vertical order on canvas is section order.**

**Acceptance:** naming a frame "Ground" makes `## Ground` appear in `map.md` on the next readout, with the frame's cards under it.

### Stage 3 — Type the atoms

Keys `1`/`2`/`3`/`4` set atom type on the current selection. `0` untypes.

- Works on multi-select — type six cards at once.
- Applies the pigment top rule and eyebrow label immediately, `--dur-2` fade.
- A persistent counter in the bottom-left margin: `18 CARDS · 4 UNTYPED` in mono, `--ink-3`. Untyped count in `--terracotta` when non-zero.

**Acceptance:** selecting three cards and pressing `1` types all three, and the counter decrements by three.

### Stage 4 — Bind dependencies

- `B` then click a target → binds from selection to target.
- Arrows are `--ink-3`, 1px, small solid head. Not pigmented.
- `src/lib/topo.ts` runs a topological sort over the binding graph.
- **Unsupported-claim check:** if a card appears above a card it depends on, draw a terracotta hairline underline beneath the offending card and list it in the counter: `2 UNSUPPORTED`. This is the canvas telling Jordan his reading order is wrong before he writes a word.

**Acceptance:** binding A→B, then dragging A above B, surfaces the unsupported warning within one frame; dragging it back clears it.

### Stage 5 — Read out

`⌘R` (and `npm run readout -- <essay-slug>`)

Walks the store and writes `out/<essay-slug>/map.md` plus `assembly.json`.

```markdown
---
essay: on-the-metabolism-of-attention
generated: 2026-07-30T14:02:11Z
source: work/on-the-metabolism-of-attention.tldr
cards: 18
untyped: 0
---

# On the metabolism of attention

## Ground

1. **[stance]** The received view treats attention as a resource to be spent. `f-003`
2. **[claim]** It is closer to a digestive capacity. `f-007`

## The seam

3. **[move]** Grant the resource model its strongest case first. `f-011`

## Open tickets

- [ ] What does "metabolize" cost us if attention has no waste product? `t-001`
- [ ] UNANSWERED — the received view's account of satiety `g-002`

## Assembly program

stance → claim → move(concede) → figure → claim → move(turn) → claim
```

Rules:

- Frames become `##` headings, ordered by frame **y-position**.
- Cards within a frame are ordered by **y-position**, then x.
- Unframed cards go under `## Unplaced` at the end.
- Every card carries its stable id so the map can be traced back to the canvas and back to `inputs/`.
- `assembly.json` mirrors this machine-readably for the essay-assembly skill.
- **Never** write into `inputs/`.

**Acceptance:** dragging a card from the third frame to the first, then `⌘R`, moves that line to the first section of `map.md`. The spatial act *is* the edit.

### Stage 6 — Write against the map

No build work. Jordan writes prose in Obsidian with the canvas open on the second screen. Two supports:

- **Ticket shapes** (`T`) hold open questions in terracotta. Their count appears in the counter: `3 OPEN`. When it reads `0 OPEN`, the map is clear.
- **Progress is visible by subtraction.** The canvas should get quieter as the essay firms up — terracotta disappearing is the reward signal. Do not add a progress bar; the absence of alarm *is* the progress bar.

### Stage 7 — Export the figure

`⌘E` on a selection. See §10 for the full plate spec.

### Stage 8 — Commit the snapshot

`npm run save -- <essay-slug>` writes `work/<slug>.tldr`, then `git add work/ out/`.

Autosave to `.tldr` every 30s and on blur. Do not autocommit — Jordan commits.

**Acceptance:** `git log -p work/<slug>.tldr` shows a readable history of the essay's structure changing over time.

---

## 8. Component: the corpus wall

**What it's for.** Jordan's signature-extraction runs currently produce a grammar he reads as a list. This renders it. Three essays by one writer become three horizontal bands; his own essay becomes a fourth. The difference between another writer's rhythm and his stops being an analysis and becomes an image.

**Route:** `⌘⇧C` → `CorpusWallView`.

**Two input paths, both required.**

1. **File path.** Reads `corpus/*.assembly.json` — output of the essay-assembly skill. Schema:
   ```json
   { "slug": "its-so-over", "title": "It's so over",
     "units": [ { "atom": "stance", "words": 84 }, { "atom": "move", "words": 133 } ] }
   ```
2. **Fresh parse.** `npm run corpus -- --parse corpus/<slug>.md` splits the essay into paragraph units, counts words, and writes `<slug>.assembly.json` with `"atom": null` for every unit. It does **not** guess atom types — classification is a judgment, not a heuristic. Unclassified units render as `--ink-4` hatched segments so the gaps in the analysis are as visible as the analysis.

   Classification then happens either in-canvas (click a segment, press 1–4, which writes back to the JSON) or by a Claude Code pass over the file. Both must round-trip.

**Rendering.**

- One `BandShape` per essay, full width, 64px tall, stacked with `--s-7` between.
- x-axis is normalized position 0→1 through the essay; segment width is proportional to word count.
- Segment fill: the atom pigment at ~85% opacity. Unclassified: `--ink-4` at 25% with a hairline hatch.
- Essay title in the left margin, Instrument Serif italic, right-aligned to the band.
- Above each band, a mono strip of the atom sequence: `STANCE · MOVE · CLAIM · MOVE · FIGURE …`
- **Jordan's own essay is the bottom band, separated by a `3px double` rule in `--ink-3`** — the printer's convention for a chapter break, used here to mark the shift from *studied* to *mine*.
- Clicking a segment scrolls the source text into a margin panel.

**This is the one place multiple pigments appear together.** It's a diagram, and README permits pigments in diagrams. Everywhere else, one pigment per view.

**Acceptance:** three bands load in under a second, and Jordan can answer "does this writer open on stance or on figure?" in four seconds without reading a word.

---

## 9. Component: visible absence

**What it's for.** Absence is invisible in prose and obvious in space. Jordan's wayfinder method opens with "find the delta." This makes the delta a thing on a canvas.

**Route:** `⌘D` → `DeltaView`. Operates on the current essay.

**Layout.** Two frames, fixed:

- Left frame, titled **"Received"** — the position Jordan is arguing with.
- Right frame, titled **"Mine"** — his own atoms.
- Bindings across the gap mean *correspondence*: "this answers that."

**The three computed states.**

| State | Condition | Rendering |
|---|---|---|
| **Answered** | Received card has an outbound binding | normal card, both sides |
| **Unanswered** | Received card has **no** outbound binding | replaced by a `GapShape` |
| **Novel** | Mine card has **no** inbound binding | normal card, marked `※` in the eyebrow |

**GapShape** is the point of the whole component. It is a *hole*, drawn:

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    ← 1px dashed var(--terracotta)
                                       NO fill — the paper shows through
   UNANSWERED

   the received view's account
   of satiety                          ← var(--ink-4), the facing card's text
                                          shown greyed, not owned
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

Empty. Unfilled. Terracotta hairline. It should read as a missing tooth.

**The counter**, bottom-right margin, mono, `--ink-3`:

```
7 UNANSWERED · 3 NOVEL · DELTA 10
```

`UNANSWERED` in terracotta when non-zero.

**Closing the loop:** on `⌘R`, every gap is written into `map.md` under `## Open tickets` as `- [ ] UNANSWERED — <label>`. Absence becomes a to-do without Jordan transcribing anything. Binding a Mine card to a Received card converts the gap back to a normal card and removes the ticket on next readout.

**Acceptance:** with ten Received cards and four bindings, the view shows six gaps, the counter reads `6 UNANSWERED`, and `map.md` gains six unchecked boxes.

---

## 10. Component: the house visual language

**What it's for.** Most essayists ship text. If every essay Jordan publishes carries a figure in a consistent, unmistakable visual grammar — generated, not designed — that becomes a brand asset that costs nothing per essay after this build. The plate wrapper is the asset. Build it once, correctly.

### The plate

`README.md`: *"Treat figures like book plates: numbered, captioned in mono."* Literally:

```
┌────────────────────────────────────────────┐
│                                            │   ← 1px solid var(--bone)
│           [ the selected shapes ]          │      ground: var(--paper)
│                                            │      padding: var(--s-7) = 48px
│                                            │
├════════════════════════════════════════════┤   ← 3px double var(--ink-3)
│ FIG. 3 — THE DELTA BETWEEN RECEIVED        │   ← JetBrains Mono 12px,
│ AND MINE                                   │      UPPER, 0.12em, var(--ink-3)
│                                    JWP ¶ 26│   ← colophon mark, var(--ink-4)
└────────────────────────────────────────────┘
```

- The double rule under the figure and above the caption is the printer's convention from README. It is the single most recognizable element. Do not lose it.
- Caption is authored by Jordan in a one-field prompt on `⌘E`, sentence-cased in the field, rendered uppercase.
- Figure number auto-increments per essay from `out/<slug>/figures/figures.json`.
- Colophon mark bottom-right: `JWP` plus the essay's paragraph reference, if given.

### Export mechanics

`⌘E` on a selection:

1. Clone the selected shapes into an offscreen plate group with the wrapper.
2. `editor.toImage({ ids, format: 'svg', background: true, padding: 0, scale: 1 })`.
3. Also `format: 'png', scale: 2` — **always emit both.** SVG for Substack and the reader kit; PNG for X, which will not render SVG.
4. Write to `out/<slug>/figures/fig-NN-<caption-slug>.{svg,png}`.
5. Append to `figures.json`: number, caption, shape ids, timestamp, source `.tldr` hash.
6. Copy the SVG path to clipboard and show a mono toast: `FIG. 3 EXPORTED`.

### Export correctness — verify, don't assume

- Every custom `ShapeUtil` implements `toSvg`. The `foreignObject` fallback is fragile across renderers and will break in Substack.
- Fonts must be self-hosted (§5.4) or embedding silently fails.
- **M3 gate:** stop the dev server, open the exported SVG in a fresh browser profile. If it renders in Instrument Serif, EB Garamond, and JetBrains Mono, with cream ground and the double rule intact, the plate is real. If it renders in Times, fix the embedding before proceeding.

---

## 11. Keyboard map

Print this in a `?` overlay set in mono.

| Key | Action |
|---|---|
| `1` `2` `3` `4` | type selection: claim / move / figure / stance |
| `0` | untype selection |
| `T` | new ticket (terracotta) |
| `F` | frame the selection |
| `B` | bind: selection → next click |
| `⌘E` | export figure from selection |
| `⌘R` | readout → `map.md` |
| `⌘D` | delta view (visible absence) |
| `⌘⇧C` | corpus wall |
| `⌘S` | save `.tldr` |
| `?` | this overlay |

Everything else is tldraw's default (space-drag pan, scroll zoom, `⌘Z` undo).

---

## 12. Clew posture

Two options were considered. **Option 1 is the current posture. Option 2 is specified but must not be built.**

### Option 1 — Nothing *(active)*

essay-canvas and Clew stay entirely separate.

Concretely, for Fable: **no imports from the Clew repo, no shared packages, no reads or writes into the Clew vault or the RabbitHole folder, no reference to Clew's schema.** This repo knows nothing about Clew.

*Benefit:* zero coupling. Clew's substrate decision stays untouched while Jordan learns whether spatial composition actually changes how he writes. If the answer is no, nothing was spent. If the answer is yes, that answer arrives before it can distort a product decision. It also keeps tldraw's licensing entirely outside the product.

### Option 2 — Export target only *(specified, DO NOT BUILD)*

Clew's published tree renders *to* a read-only tldraw canvas for the "learn how the author sees" page. Clew's editing core is never touched; tldraw is a renderer at the end of the pipe.

*Benefit:* readers get a real pannable spatial artifact instead of a flat image, and Clew gains nothing to maintain — the adapter is one-way and stateless.

Contract, so it's ready if Jordan calls for it:

```json
{
  "thread": { "id": "…", "title": "…", "audience": "…", "published": "…" },
  "nodes": [
    { "id": "n-1", "species": "main|branch|definition|note|document",
      "title": "…", "body": "…", "parentId": null,
      "move": "crux|promote|cite|null", "lens": "unpack|push|counter|connect|sharpen|ground|null",
      "created": "…", "excerpt": "…" }
  ],
  "strings": [ { "fromId": "n-1", "toId": "n-2", "anchor": { "x": 0.5, "y": 1.0 } } ]
}
```

The adapter would map species → shape type, lens → pigment, run a tidy tree layout, and mount `<Tldraw readOnly cameraOptions={{ constraints: … }} />` with all tools removed.

**Two gates before any of this exists:** (1) Jordan's explicit go, and (2) the licensing question in §3, because a public reader route is production use.

---

## 13. Build order

Report at each gate. Do not proceed past a failed gate.

| M | Scope | Gate |
|---|---|---|
| **M0** | Scaffold, tokens, self-hosted fonts, full de-tldraw pass. ~6 files, mostly CSS. | Screenshot the empty canvas. It must not read as a tldraw app. |
| **M1** | `AtomShapeUtil` with `toSvg`, `spread.ts`, typing keys, counter. ~4 files, ~350 lines. | Twelve fragments → twelve typed cards, counter accurate. |
| **M2** | Frames, bindings, `topo.ts`, `readout.ts`. ~4 files, ~400 lines. | Drag a card between frames → `map.md` order changes. |
| **M3** | `plate.tsx`, `exportFigure.ts`, figure registry, SVG + PNG. ~3 files, ~300 lines. | Exported SVG opens correctly with the dev server **stopped**. |
| **M4** | `GapShapeUtil`, `TicketShapeUtil`, `DeltaView`, ticket→map wiring. ~4 files, ~350 lines. | Six unbound Received cards → six gaps → six checkboxes in `map.md`. |
| **M5** | `BandShapeUtil`, `corpus.ts` both paths, `CorpusWallView`, segment classification round-trip. ~4 files, ~450 lines. | Four bands render; classifying a segment writes back to JSON. |
| **M6** | Generative trace → scene → canvas. See `M6_GENERATIVE.md`. | Trace Test (§10) passes. |

---

## 14. The Plate Test

The acceptance ritual. Jordan runs it; Fable does not sign off on it.

1. Drop twelve fragments of a live idea into `inputs/<slug>/`.
2. `npm run spread -- <slug>`.
3. Cluster, frame, type, and bind for twenty minutes without opening this document.
4. `⌘R`, read `map.md`. Does it look like an outline he'd actually write from?
5. `⌘E` on the argument spine. Write the caption.
6. Open the SVG beside a draft in the reader kit.

**Pass condition:** the figure looks like it belongs in the essay without a styling pass, and the map is worth writing from.

If step 3 feels like data entry rather than thinking, the build is wrong regardless of what passed.

---

## 15. Decisions Fable does not make

Flag these and stop; do not choose.

1. Whether atom types stay at four, or split (`ground` and `figure` may want separating).
2. Whether the x-axis abstraction gradient gets a visible ruler in the margin, or stays an unmarked convention.
3. Whether `work/*.tldr` belongs in git or in `.gitignore` with only `out/` committed.
4. Anything in §12 Option 2.
5. Any addition to the token set in §5.1.

---

## 16. Notes to Fable

- The brand system is a real system with real rules, not a mood. When in doubt, re-read `README.md` and `colors_and_type.css` rather than inventing.
- The nearest failure mode is building a competent generic canvas app and painting it cream. The tell will be rounded corners, drop shadows, a color picker, and blue focus rings surviving in one corner of the UI. Hunt them.
- Second failure mode: features that make position arbitrary — auto-layout that reorders on its own, snapping so aggressive it overrides intent, any "tidy up" button. The canvas must never move a card Jordan placed.
- Prefer boring, deterministic, on-disk. No cleverness in persistence.
- Terracotta means absence. Guard it.
