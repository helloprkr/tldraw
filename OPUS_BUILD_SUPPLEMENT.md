# OPUS_BUILD_SUPPLEMENT.md — verified facts and binding decisions for the essay-canvas build

**Executor:** Opus 5, working in Claude Code, inside this repo.
**Spec:** `BUILD.md`. **This document:** corrections, verified APIs, and pre-made decisions.
**Prepared by:** Fable 5, 2026-07-30, after scaffolding this repo and verifying every API claim below against the installed `tldraw@5.2.5` package.

## 0. Authority order and how to use this document

1. Where this document and BUILD.md disagree on **API facts, versions, file paths, or mechanics**, this document wins — every claim here was verified against the installed package.
2. Where they disagree on **design intent** (colors, spacing, what the product is), BUILD.md and `Brand/README.md` win. Nothing in this document overrides §2 Non-negotiables.
3. BUILD.md says "Executor: Fable 5." That is stale. You (Opus 5) are the executor. Everywhere BUILD.md says "Fable," read "Opus."

**Your local ground truth for tldraw APIs** is inside this repo, already installed:

- `node_modules/tldraw/DOCS.md` — 20k-line SDK reference generated for exactly 5.2.5.
- `node_modules/tldraw/dist-cjs/index.d.ts` and `node_modules/@tldraw/editor/dist-cjs/index.d.ts` — the real type signatures.

**Rule: before using any tldraw API not already verified in this document, grep those two files first.** Do not code from memory of tldraw 2.x/3.x/4.x — several APIs were renamed or re-semanticized in 5.x. Example recipes:

```bash
grep -n "methodName(" node_modules/@tldraw/editor/dist-cjs/index.d.ts
grep -n "^### " node_modules/tldraw/DOCS.md        # section index
```

## 1. State of the repo when you start

Already done — do not redo:

- Branch `main` on `https://github.com/helloprkr/tldraw` holds a **vanilla, untouched** tldraw starter: Vite 7 + React 19 + TypeScript, `tldraw` pinned to exactly `5.2.5` (`package-lock.json` committed). `npm install && npm run dev` shows the stock tldraw whiteboard. `npm run build` passes clean.
- `BUILD.md`, `Brand/`, and this file are committed on `main`.
- Branch `essay-canvas` exists, starting at the same commit as `main`. **All of your work happens on `essay-canvas`.**

Environment facts: Node 23 (tldraw 5.x requires ≥22.12), npm 10, macOS, dev server on `http://localhost:5173`.

### Git workflow (binding)

- `git checkout essay-canvas` before writing anything. Never commit to `main`. Never force-push anything.
- One commit per milestone, minimum, at each gate: message `M<k>: <one-line scope> — gate: <one-line result>`, ending with the trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Intermediate commits inside a milestone are fine.
- Push `essay-canvas` to `origin` after each milestone commit.
- `npm run build` must pass before every milestone commit.

## 2. Corrections to BUILD.md — read before writing code

| # | BUILD.md says | Reality in this repo |
|---|---|---|
| C1 | §3: "tldraw (latest 4.x)" | **5.2.5**, pinned, installed. Jordan chose this deliberately. Do not downgrade, do not change the pin. |
| C2 | §6.2: ShapeUtils implement "`getIndicatorPath`" | Name is right in 5.x, but the semantics are not what 4.x's `indicator()` was: `getIndicatorPath(shape)` returns a **`Path2D`** (or `{ path, clipPath?, additionalPaths? }` or `undefined`) — **not JSX**. The old `indicator()` is a deprecated no-op stub. See §3.1 below. |
| C3 | §10: `editor.toImage({ ids, format: 'svg', background: true, padding: 0, scale: 1 })` | Wrong signature and wrong method for SVG. Real API: `editor.toImage(idsOrShapes, opts)` — **two arguments**, and `toImage` is raster-only (`'png' | 'jpeg' | 'webp'`; `'svg'` via toImage is not the SVG path you want). SVG export is **`editor.getSvgString(idsOrShapes, opts)`**. See §3.3. |
| C4 | §5: "`colors_and_type.css`" (implied repo root) | It lives at **`Brand/colors_and_type.css`**. Copy from there to `src/tokens.css`, verbatim except the font `@import` line (see §5). `Brand/README.md` is the brand brief BUILD.md references. |
| C5 | §11: `F` frames the selection | tldraw 5.x binds `f` to the frame *tool*, and ships a built-in **`frame-selection`** action (default `cmd+shift+f`) that wraps the selection in a frame. Implement BUILD.md's `F` by rebinding that existing action to `f` after deleting the frame tool. Helpers `removeFrame(editor, ids)` and `fitFrameToContent(editor, id)` are exported from `tldraw`. See §4. |
| C6 | §11: keys `1`–`4`, `0`, `T`, `B` | Number keys and letters are grabbed by default toolbar tools/actions. You must delete the default tools/actions that hold them in `overrides` before your bindings will fire. See §4. |
| C7 | §7 Stage 1: "`npm run spread` … opens the canvas" | BUILD.md never says how a browser app reads `inputs/` and writes `out/`/`work/` on disk. That architecture is specified in §6 of this document. Follow it exactly; do not invent an alternative. |
| C8 | §5.5: "remove … every piece of tldraw branding permitted by the trademark guidelines" | The **"made with tldraw" watermark is not removable** — it is license-governed, appears in unlicensed dev builds, and hiding it violates the license. Leave it. Everything else listed in §5.5 (share menu, style panel, etc.) is a UI component slot and is fair game. See §4. |

## 3. Verified tldraw 5.2.5 API reference

Everything in this section was read from the installed package's `.d.ts` files on 2026-07-30. Import everything from `'tldraw'` unless noted.

### 3.1 Custom shapes

Minimal compile-ready pattern (this exact shape compiles against 5.2.5):

```tsx
import { ShapeUtil, TLBaseShape, RecordProps, T, Rectangle2d, HTMLContainer } from 'tldraw'

type AtomShape = TLBaseShape<'atom', {
  w: number; h: number; atom: string; text: string
  sourceId: string; created: string; ordinal: number
}>

export class AtomShapeUtil extends ShapeUtil<AtomShape> {
  static override type = 'atom' as const
  static override props: RecordProps<AtomShape> = {
    w: T.number, h: T.number, atom: T.string, text: T.string,
    sourceId: T.string, created: T.string, ordinal: T.number,
  }
  getDefaultProps(): AtomShape['props'] { /* … */ }
  getGeometry(shape: AtomShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }
  component(shape: AtomShape) { return <HTMLContainer>{/* card DOM */}</HTMLContainer> }
  getIndicatorPath(shape: AtomShape) {          // Path2D, NOT JSX
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
  override toSvg(shape: AtomShape, ctx: SvgExportContext) { /* return SVG ReactElement — see §3.4 */ }
  override getFontFaces(shape: AtomShape): TLFontFace[] { /* see §5 — required for export font embedding */ }
}
```

- Register via `<Tldraw shapeUtils={[AtomShapeUtil, TicketShapeUtil, GapShapeUtil, BandShapeUtil]} …/>`. The `shapeUtils` / `components` / `overrides` props must be defined **outside the component or memoized** (the types warn about this; ignoring it causes remounts).
- Useful overridable predicates (all exist on `ShapeUtil`): `canEdit`, `canResize`, `canBind(opts)`, `canSnap`, `hideRotateHandle`. Grep before assuming any others.
- Behavior flags note: `canBind` receives a `TLShapeUtilCanBindOpts` object, not a shape.

### 3.2 Bindings (Stage 4, `B` key)

An "arrow between atoms" is one `arrow` shape plus **two binding records**:

```ts
import { createShapeId } from 'tldraw'
const arrowId = createShapeId()
editor.createShape({ id: arrowId, type: 'arrow', props: {} })
editor.createBinding({ type: 'arrow', fromId: arrowId, toId: sourceAtomId,
  props: { terminal: 'start', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false } })
editor.createBinding({ type: 'arrow', fromId: arrowId, toId: targetAtomId,
  props: { terminal: 'end', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false } })
```

Graph queries for `topo.ts`: `editor.getBindingsFromShape(shape, 'arrow')`, `getBindingsToShape`, `getBindingsInvolvingShape`. `fromId` is always the **arrow**; the atoms are `toId` on the two terminals — reconstruct dependency edges by pairing an arrow's `start` and `end` bindings.

### 3.3 Export (Stage 7, `⌘E`)

```ts
// SVG — returns { svg: string, width, height } | undefined
const svgResult = await editor.getSvgString(ids, { background: true, padding: 0, scale: 1 })

// PNG — returns { blob, width, height }; format lives in opts; pixelRatio 2 = @2x
const pngResult = await editor.toImage(ids, { format: 'png', background: true, padding: 0, scale: 1, pixelRatio: 2 })
```

- First argument is `TLShapeId[] | TLShape[]`. There is no `ids:` option field.
- `padding` accepts a number or `'auto'`; when exporting a single frame, padding is skipped (the frame is the boundary).
- `toImage` **throws** on failure; `getSvgString` resolves `undefined`. Handle both.
- Font embedding: the exporter's `FontEmbedder` walks **document stylesheets**, fetches each `@font-face` src, and inlines it as a data URL. This is exactly why §5.4's self-hosting rule exists — same-origin `/fonts/...` URLs embed; CDN fonts fail silently. Custom shapes must also implement `getFontFaces(shape): TLFontFace[]` (family/src.url/weight/style) so the editor knows which faces the shape needs.

### 3.4 `toSvg` and text

`toSvg(shape, ctx)` returns an SVG `ReactElement` (or `null` / a `Promise` of either). SVG `<text>` does not wrap — you must break lines yourself. Use the editor's text measurer (`this.editor.textMeasure`): `measureText(text, opts)` and `measureTextSpans(text, opts)` exist on it; grep `TLMeasureTextSpanOpts` in `@tldraw/editor`'s `.d.ts` for the exact options (width, font, size, lineHeight, etc.) before using. Render each measured line as a `<tspan>` or absolutely-positioned `<text>`. Keep `component()` and `toSvg()` visually identical — the M3 gate compares them.

### 3.5 Persistence (Stages 5, 8)

```ts
import { getSnapshot, loadSnapshot } from 'tldraw'
const { document, session } = getSnapshot(editor.store)   // document → work/<slug>.tldr
loadSnapshot(editor.store, { document })
```

- Persist the **document** part to `work/<slug>.tldr` (pretty-printed JSON, trailing newline, stable key order — Jordan diffs these in git).
- The snapshot includes schema versions and migrates forward on load — do not hand-modify its structure.
- `parseTldrawJsonFile`, `serializeTldrawJson`, `TLDRAW_FILE_EXTENSION` (`'.tldr'`) also exist in `tldraw` if needed.
- Do **not** also pass `persistenceKey` (that turns on IndexedDB persistence — disk is our database, per BUILD.md §2.6).
- Autosave: every 30s and on `blur`, via `PUT /api/work/<slug>` (§6). Node-side scripts read the same file — the readout logic must be a pure function over the snapshot JSON (§6).

### 3.6 Camera

```ts
import { EASINGS } from 'tldraw'
editor.zoomToFit({ animation: { duration: 420, easing: EASINGS.easeOutCubic } })
editor.zoomToSelection({ animation: { duration: 420, easing: EASINGS.easeOutCubic } })
```

`easing` is a **function** `(t: number) => number`, not a CSS string. `EASINGS.easeOutCubic` is the closest match to the brand's `--ease-out` curve; use it for all camera moves (§5.6 durations still apply: 420ms camera, 220ms hovers via CSS).

### 3.7 Frames (Stage 2)

- Programmatic: `editor.createShape({ type: 'frame', x, y, props: { w, h, name: 'Ground' } })`. The title is the `name` prop; empty names render as "Frame".
- Helpers exported from `tldraw`: `removeFrame(editor, ids)`, `fitFrameToContent(editor, id, opts)`.
- The `F`-key wrap behavior: rebind the existing `frame-selection` action (verified id, defined in the actions context) — see §4.
- Frame title styling is DOM: target `.tl-frame-heading` / `.tl-frame-label` classes in `tldraw-overrides.css` (verify exact class names in `node_modules/tldraw/tldraw.css` when you get there — `grep -n "frame" node_modules/tldraw/tldraw.css`).

## 4. UI removal and the keyboard map — exact mechanism

### 4.1 Component slots

`<Tldraw components={...}/>` accepts `TLComponents`; **`null` hides a slot**. Set exactly these to `null` for BUILD.md §5.5's removal list: `StylePanel` (color swatches — semantic color lives in our shapes), `SharePanel`, `PageMenu`, `NavigationPanel` (zoom dropdown + minimap), `ZoomMenu`, `Minimap`, `MainMenu`, `ActionsMenu`, `QuickActions`, `HelpMenu`, `DebugPanel`, `DebugMenu`, `KeyboardShortcutsDialog` (replaced by the custom `?` overlay), `RichTextToolbar`, `ImageToolbar`, `VideoToolbar`, `CursorChatBubble`, `HelperButtons`, `PeopleMenu`, `UserPresenceEditor`, `FollowingIndicator`, `A11y` stays (accessibility — keep it).

Keep **`Toasts`** and **`Dialogs`** (the ⌘E caption prompt and `FIG. N EXPORTED` toast use them — hooks `useToasts()` → `addToast({...})` and `useDialogs()`, both verified exports). Replace **`Toolbar`** with the custom minimal `ui/Toolbar.tsx`; use the **`TopPanel`** slot (empty by default) if a top-margin strip is needed; render the §7 counter in a slot or as a sibling overlay — your choice, but no floating panels (hairline-ruled margins only).

There is also a `hideUi` prop — do **not** use it; it kills Toasts/Dialogs too.

### 4.2 Tools and shortcuts

Mechanism: the `overrides` prop (`TLUiOverrides`), whose `tools(editor, tools, helpers)` and `actions(editor, actions, helpers)` functions receive the full registries as plain objects. Verified shortcut string format: `'cmd+shift+d,ctrl+shift+d'` (comma = platform alternatives; plain letters/digits allowed).

1. In `tools`: `delete` every default tool except `select` and `hand` (and `zoom` if registered as a tool). This frees `f`, `t`, `d`, `e`, `n`, digits, etc., and empties the toolbar of geo/draw/laser/highlighter/note per §5.5.
2. In `actions`:
   - Rebind `actions['frame-selection'].kbd = 'f'` (verified action id).
   - Delete or rebind defaults that collide with §11 (`cmd+e` is tldraw's default "export image" — delete it and register your own; check collisions by logging `Object.keys(actions)` on first run and grepping `node_modules/tldraw/dist-cjs/lib/ui/context/actions.js` for `id: "` / `kbd:`).
   - Register custom actions with ids `type-claim` (`kbd: '1'`), `type-move` (`'2'`), `type-figure` (`'3'`), `type-stance` (`'4'`), `untype` (`'0'`), `new-ticket` (`'t'`), `bind-mode` (`'b'`), `export-figure` (`'cmd+e,ctrl+e'`), `readout` (`'cmd+r,ctrl+r'`), `delta-view` (`'cmd+d,ctrl+d'`), `corpus-wall` (`'cmd+shift+c,ctrl+shift+c'`), `save-tldr` (`'cmd+s,ctrl+s'`), `help-overlay` (`'?'`).
   - `cmd+r`/`cmd+s`/`cmd+d` collide with browser defaults; your handlers must run `preventDefault` — actions registered through the overrides system handle key events through tldraw's shortcut manager, which does this. Verify each one actually fires in Chrome before calling a milestone done.
3. Use **one mechanism** for all shortcuts (the actions registry). No scattered `window.addEventListener('keydown')` handlers — except, if the `?` bare-key binding proves unreliable in the actions registry, a single documented listener for `?` alone is acceptable.

### 4.3 De-tldraw CSS pass (§5.5)

tldraw's entire theme is CSS custom properties scoped under `.tl-theme__light` (732 `tl-` rules in `node_modules/tldraw/tldraw.css`). Override the variables rather than fighting individual rules. In `src/tldraw-overrides.css` (imported **after** `tldraw/tldraw.css`):

```css
.tl-theme__light, .tl-theme__dark {
  --tl-color-background: var(--paper);
  --tl-color-selection-stroke: var(--ink);
  --tl-color-selection-fill: transparent;
  --tl-color-grid: color-mix(in srgb, var(--bone) 40%, transparent);
  --tl-color-panel: var(--bg-2);
  --tl-color-divider: var(--bone);
  --tl-color-text-0: var(--ink);
  --tl-color-text-1: var(--ink);
  --tl-color-focus: var(--ink);
  /* …walk the full --tl-color-* list: grep -o '\-\-tl-color-[a-z0-9-]*' node_modules/tldraw/tldraw.css | sort -u */
}
```

Both theme classes get the same values — the app has one look; there is no dark mode (brand: "cream-on-ink is the brand"). Force light at mount: `editor.user.updateUserPreferences({ colorScheme: 'light' })` (verify the exact preference key in the `.d.ts` first). Then hunt survivors visually per BUILD.md's M0 gate: selection handles (square, 0 radius, `--ink`), focus rings, panel radii/shadows, UI font. Handle/radius/shadow rules are ordinary `.tl-*`/`.tlui-*` selectors — override with equal-or-higher specificity, no `!important` unless a inline style forces it.

**Exception to "kill all tldraw look": the "made with tldraw" watermark stays (C8).**

## 5. Fonts — exact acquisition steps

Do this in M0. Every file name below is verified to exist in the named packages.

```bash
npm install -D @fontsource/instrument-serif @fontsource/eb-garamond @fontsource/jetbrains-mono
mkdir -p public/fonts
cp node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2 public/fonts/
cp node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2 public/fonts/
cp node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-{400,500,600}-{normal,italic}.woff2 public/fonts/
cp node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-{400,500}-normal.woff2 public/fonts/
```

Then in `src/tokens.css` (the verbatim copy of `Brand/colors_and_type.css`), **delete the single `@import url('https://fonts.googleapis.com…')` line** (line 7 — the only permitted edit) and prepend:

```css
@font-face { font-family: 'Instrument Serif'; src: url('/fonts/instrument-serif-latin-400-normal.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: 'Instrument Serif'; src: url('/fonts/instrument-serif-latin-400-italic.woff2') format('woff2'); font-weight: 400; font-style: italic; font-display: swap; }
@font-face { font-family: 'EB Garamond'; src: url('/fonts/eb-garamond-latin-400-normal.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: 'EB Garamond'; src: url('/fonts/eb-garamond-latin-400-italic.woff2') format('woff2'); font-weight: 400; font-style: italic; font-display: swap; }
@font-face { font-family: 'EB Garamond'; src: url('/fonts/eb-garamond-latin-500-normal.woff2') format('woff2'); font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: 'EB Garamond'; src: url('/fonts/eb-garamond-latin-500-italic.woff2') format('woff2'); font-weight: 500; font-style: italic; font-display: swap; }
@font-face { font-family: 'EB Garamond'; src: url('/fonts/eb-garamond-latin-600-normal.woff2') format('woff2'); font-weight: 600; font-style: normal; font-display: swap; }
@font-face { font-family: 'EB Garamond'; src: url('/fonts/eb-garamond-latin-600-italic.woff2') format('woff2'); font-weight: 600; font-style: italic; font-display: swap; }
@font-face { font-family: 'JetBrains Mono'; src: url('/fonts/jetbrains-mono-latin-400-normal.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: 'JetBrains Mono'; src: url('/fonts/jetbrains-mono-latin-500-normal.woff2') format('woff2'); font-weight: 500; font-style: normal; font-display: swap; }
```

Also commit the woff2 files (they're in `public/`, small, and required for the M3 embedding gate). In each custom `ShapeUtil.getFontFaces`, return the faces that shape renders, e.g. `{ family: 'EB Garamond', src: { url: '/fonts/eb-garamond-latin-400-normal.woff2' }, weight: '400', style: 'normal' }` — this is what makes the exporter embed them (§3.3).

## 6. Disk I/O architecture — the gap BUILD.md leaves open (C7)

The app is a browser SPA; `inputs/`, `work/`, `out/`, `corpus/` are on disk. The bridge is a **Vite dev-server middleware plugin** — no separate backend, consistent with §2.6 ("everything runs on localhost and writes to disk"; the Vite dev server is the only process).

### 6.1 The plugin

`vite.config.ts` gains a local plugin `essayFs()` (define it in `scripts/essay-fs-plugin.ts` or inline) using `configureServer(server)` middleware. Endpoints (all JSON unless noted):

| Method + path | Behavior |
|---|---|
| `GET /api/essays` | List slugs: directory names under `inputs/`. |
| `GET /api/inputs/:slug` | `[{ name, content }]` for every `*.md` in `inputs/<slug>/`, sorted by filename. Raw file contents — frontmatter parsing happens in shared browser-safe code. |
| `GET /api/work/:slug` | Contents of `work/<slug>.tldr`, or 404. |
| `PUT /api/work/:slug` | Write body to `work/<slug>.tldr` (mkdir -p `work/`). |
| `GET /api/corpus` | `[{ name, content }]` for `corpus/*.assembly.json` and `corpus/*.md`. |
| `PUT /api/corpus/:file` | Write an `*.assembly.json` back (segment-classification round-trip, §8). Only `*.assembly.json` writable. |
| `POST /api/out/:slug` | Body `{ files: [{ path, content?, contentBase64? }] }`; writes each under `out/<slug>/` (mkdir -p). `contentBase64` for PNG blobs. |

Hard rules, enforced **in the plugin**: reject any resolved path escaping the repo root or containing `..`; **refuse all writes under `inputs/`** (BUILD.md §4's sacred rule — enforce it in code, not convention); writes are atomic (write temp file, rename); `.tldr` and `.json` written pretty-printed with trailing newline.

### 6.2 Pure-core rule

`src/lib/spread.ts`, `readout.ts`, `topo.ts`, `corpus.ts`, and a small `frontmatter.ts` must be **pure**: no `fs`, no `fetch`, no DOM, no editor. They map data → data (e.g. `readout(snapshotDocument, opts) → { mapMd, assemblyJson }`). The browser wires them to `/api/*`; node scripts wire them to `fs`. This is what makes the dual paths (⌘R and `npm run readout`) provably identical — the M2/M5 gates test both paths produce byte-identical output.

Frontmatter: write the ~30-line parser yourself in `frontmatter.ts` (key: value strings, quoted strings, nothing nested — §6.1's schema needs no YAML library). `notes.md` splitting on `---` rules: split on lines that are exactly `---` **after** the closing frontmatter delimiter.

### 6.3 npm scripts

Add devDependency **`tsx`** (runs the TS pure core in node). Scripts:

| Script | Behavior |
|---|---|
| `npm run dev` | `vite` |
| `npm run spread -- <slug>` | `tsx scripts/spread-cli.ts <slug>`: verify `inputs/<slug>/` exists (fail loudly if not), then open `http://localhost:5173/?essay=<slug>` (`open` on macOS); if the dev server isn't up (probe with fetch), print the exact command to start it and exit 1. The actual spread/merge logic runs **in the app on load**: fetch inputs + work, diff fragment ids, place only new ones in the staging column at x = −600 (Stage 1 rules). |
| `npm run readout -- <slug>` | `tsx scripts/readout-cli.ts <slug>`: read `work/<slug>.tldr`, call pure `readout()`, write `out/<slug>/map.md` + `assembly.json`. |
| `npm run corpus -- --parse corpus/<slug>.md` | `tsx scripts/corpus-cli.ts`: paragraph-split, word-count, write `corpus/<slug>.assembly.json` with `"atom": null` per unit (§8: never guess types). |
| `npm run save -- <slug>` | `tsx scripts/save-cli.ts <slug>`: verify `work/<slug>.tldr` exists (the app's autosave writes it), then `git add work/ out/`. **No commit** — Jordan commits. |

In-app `⌘R` computes the same pure `readout()` from the live snapshot and POSTs to `/api/out/:slug`.

## 7. Pre-resolved decisions — do not stop for these

BUILD.md §15 lists decisions the executor must not make. Jordan has now made them; they are settled:

1. **Atom types stay at four** (claim/move/figure/stance). No splitting.
2. **No visible x-axis ruler.** The abstraction gradient stays an unmarked convention.
3. **`work/*.tldr` is committed to git** (Jordan chose this explicitly, 2026-07-30). No `.gitignore` entry for `work/`.
4. **§12 Option 2 stays unbuilt.** Option 1 (nothing) is the posture. Zero Clew references anywhere.
5. **No token additions** to `src/tokens.css`. If you need a value that isn't there, you are using the wrong value.

Still stop-and-flag: anything genuinely new that BUILD.md + this document don't cover and that changes product behavior. Pure implementation choices (file split, function names, plugin internals) are yours.

## 8. Milestone gates — verification commands

Follow BUILD.md §13 order. At each gate, in addition to BUILD.md's stated gate, run and report:

- **Every milestone:** `npm run build` (must pass, zero TS errors), then the gate check below, then commit + push (§1).
- **M0:** dev server up → screenshot empty canvas. Checks: no white anywhere (`--paper` ground), no blue selection, no default toolbar tools, watermark still present, fonts load from `/fonts/` (Network tab: zero requests to `fonts.googleapis.com` / `gstatic`). View source of the served page: the Google Fonts `@import` must be gone.
- **M1:** create `inputs/test-essay/` with 12 numbered fragment files (write them yourself — plain sentences, a few with `atom:` frontmatter, one `notes.md` with 3 `---`-separated sections — then delete the folder after M1 verification or keep as fixture; keep it: commit as `inputs/test-essay/`). `npm run spread -- test-essay` → 12+3 cards, camera fits, counter accurate, `1`–`4`/`0` retype multi-selections.
- **M2:** frame two groups, bind A→B, drag A above B → terracotta underline + `1 UNSUPPORTED` within one frame; `⌘R` then `npm run readout -- test-essay` → **byte-identical** `map.md` from both paths (`diff` them); drag card between frames → order flips in `map.md`.
- **M3:** `⌘E` a selection → both `fig-01-*.svg` and `fig-01-*@2x.png` in `out/test-essay/figures/`, `figures.json` row appended. **Stop the dev server**, open the SVG via `file://` in a browser: Instrument Serif + EB Garamond + JetBrains Mono render (not Times), cream ground, double rule intact. `grep -c "data:font" <fig>.svg` ≥ 1 proves embedding.
- **M4:** ten Received cards, four bindings → six `GapShape`s, counter `6 UNANSWERED`, `map.md` gains six `- [ ] UNANSWERED —` boxes; binding one converts gap → card and drops to five on next readout.
- **M5:** three `*.assembly.json` in `corpus/` (author two synthetic ones + parse one with `npm run corpus`) → bands render, unclassified hatched, click-segment + `1`–`4` writes back to the JSON on disk (verify with `git diff corpus/`), double rule above Jordan's own band.

Report each gate to Jordan in the format BUILD.md expects; the Plate Test (§14) is his, not yours.

## 9. Hard rules (recap + additions)

1. Never write into `inputs/` — enforced in the FS plugin, and nowhere else in code may `fs.write` target it.
2. Never remove or hide the tldraw watermark. Never add a license key. Never deploy.
3. Never commit to `main`; never force-push.
4. `tldraw` stays pinned at `5.2.5`. New deps allowed only: `@fontsource/*` (dev), `tsx` (dev). Anything else: stop and flag.
5. Pure white `#fff`/`#ffffff` and pure black `#000`/`#000000` appear nowhere in code you write — grep your own work before each commit: `git diff main...HEAD -- src/ | grep -iE "#fff|#000"` plus the staged diff, and justify every hit (tldraw internals excepted).
6. No emoji anywhere, including console output and code comments (§2.4 + brand).
7. When any tldraw API surprises you, grep `node_modules/tldraw/DOCS.md` and the `.d.ts` files (§0) — never guess from training memory, and never npm-install a different tldraw version to "check".

---

## 10. Errata — findings and rulings from the build itself

Appended by Opus 5 as milestones land. Same authority as the rest of this document: on API facts these correct BUILD.md; on design intent, Jordan's rulings below are final.

### E1. Custom shapes register through `@tldraw/tlschema`, not `tldraw` (M1)

§3.1's pattern is incomplete. Declaring a standalone `TLBaseShape` leaves the shape outside the `TLShape` union, so every `shape.type === 'atom'` narrowing fails to compile (`TS2677`, `TS2367`) and `editor.updateShapes` rejects the props.

5.2.5 registers custom shapes by **module-augmenting `TLGlobalShapePropsMap`**, and that interface is declared in `@tldraw/tlschema` and **is not re-exported by `tldraw` or `@tldraw/editor`**. Augmenting `'tldraw'` compiles silently and does nothing.

Working form — see `src/tldraw-shapes.d.ts`:

```ts
declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    atom: { w: number; h: number; atom: AtomType; /* … */ }
  }
}
```

Then `type AtomShape = TLShape<'atom'>`. Every later shape (Ticket, Gap, Band) goes in the same file.

### E2. The canvas chrome is not CSS (M0)

§4.3's variable-override recipe cannot reach the selection box, resize corners, brush, or snap lines. In 5.x those are drawn to a raster context from `editor.getCurrentTheme().colors[mode]` — a JS record. Ink selection and paper-filled square handles come from a custom theme passed as `themes={{ default: … }}`, in `src/theme.ts`. CSS variables still govern everything the DOM renders.

### E3. tldraw is not local by default (M0)

Out of the box the app fetched roughly forty assets per load from `cdn.tldraw.com`: the icon sprite, translations, eighteen embed icons, and all four of its typefaces. That contradicts BUILD.md §2.6, and the CDN `@font-face` rules sat on the document as cross-origin sources — the exact condition §5.4 says makes export embedding fail silently. All redirected to `public/` in `src/assets.ts`; load is now zero external requests. No new dependency.

### E4. `resolveLineHeightPx` governs text parity (M1)

tldraw's text measurer snaps line-height to whole pixels. A card whose CSS uses the unsnapped value drifts from its own export — 1.5px over four lines, enough to change where lines break. `component()` and `toSvg()` must both derive leading from `resolveLineHeightPx(fontSize, lineHeight)`, a public 5.2.5 export. Related: with a 1px border, absolutely-positioned children lay out against the padding box, so the border must be an `::after` overlay or every element sits 1px off its SVG twin.

### E5. Ruling — pigment on the compose canvas (M1, Jordan, 2026-07-30)

§2.5 "one pigment per view" and §5.2's four-pigment atom mapping appeared to conflict. Resolved:

- **§2.5 governs decoration and UI chrome.** §5.2/§5.3 are explicit that a typed card carries its atom pigment as a hairline rule and eyebrow — those are **semantic marks, not decoration**. The specific rule wins over the general one; Stage 3 would be unbuildable otherwise.
- **§8's "the one place multiple pigments appear together"** refers to pigment as **area fill** (band segments). That stays true.
- So: pigmented eyebrows and hairline rules on the compose canvas are correct. Pigment as a fill or wash remains corpus-wall-only.

### E6. Ruling — untyped eyebrow (M1, Jordan, 2026-07-30)

Reads bare `UNTYPED`, no ordinal. §5.3's literal wording and its stated intent agree: untyped cards should look unfinished. The ordinal still appears bottom-right as `¶ NNN`. Closed.

### E7. `@types/node` is a devDependency (M2, Jordan, 2026-07-30)

Approved as an exception to §9.4. Without it `scripts/` had zero type checking — `node:fs`, `process`, and `Buffer` all resolved to nothing, and the M2 gate turns on serialization details a silent type error would hide. `tsconfig.json` still includes only `src`; `scripts/` and `vite.config.ts` are checked by `tsconfig.scripts.json`, which `npm run build` now runs. It caught a real bug on first run.

### E8. One serializer, structurally (M2, Jordan, 2026-07-30)

§6.2's pure-core rule puts both readout paths through the same `readout()`. That is necessary but not sufficient: the **file-writing edges** must also share one serializer rather than each reaching for `JSON.stringify` or a template string. Key order, indent width, and the trailing newline are exactly where a byte-identical gate dies. `src/lib/serialize.ts` is the only place either path turns a value into bytes.

Corollary: `readout()` takes its `generated` timestamp as an argument. A clock read inside the pure core would make the function non-deterministic and the gate unprovable.

### E9. `InFrontOfTheCanvas` is screen space, not page space (M2)

Worth knowing before any later overlay. `DefaultCanvas` renders that slot into `.tl-canvas__in-front`, a **sibling** of `.tl-canvas` with `position:absolute; inset:0`. It is not inside the html layer, so children are positioned in **screen** pixels and do not track pan or zoom on their own.

`OnTheCanvas` is the page-space slot, but it renders *behind* shapes, which is wrong for a mark that must sit over the paper.

`src/ui/UnsupportedMarks.tsx` therefore stays in `InFrontOfTheCanvas` and applies the camera itself: an `inset:0` clipped wrapper holding a 0x0 `transform-origin:0 0` layer carrying `scale(z) translate(x,y)`. Inside that layer one CSS pixel is one page unit. **Moving the component to `OnTheCanvas` would double-transform it.**

### E10. Arrow paint must come from display values, not CSS (M2)

BUILD.md §5.5 wants dependency arrows at ink-3, 1px. Neither is reachable through arrow props: `theme.ts` collapses every named color to solid ink, and stroke width is `theme.strokeWidth (2) * STROKE_SIZES[size]` with a minimum multiplier of 1.

Restyling in CSS works on canvas and **silently fails on export** — `getSvgString`/`toImage` render shapes without the document stylesheet reaching their internals, so plates would ship 2px near-black arrows while the canvas showed 1px ink-3. `src/shapes/DependencyArrowUtil.ts` subclasses `ArrowShapeUtil` and overrides `options.getCustomDisplayValues` instead, which both paths go through. `options` is a class field on the parent, so it is amended in the constructor — a field initializer cannot see it and `super.options` is not accessible.

Generalization for M3 onward: **anything that must appear in an exported figure has to be a display value, a shape prop, or `toSvg` output. CSS reaches the canvas only.**

### E11. Open item for M4 — Ticket and Gap need a stable id (M2)

§6.2's `TicketShape` and `GapShape` prop lists carry no id, but §7's example map shows `t-001` and `g-002`. `readout.ts` reads `props.sourceId` when present and otherwise falls back to the record id with `shape:` stripped, so without a `sourceId` prop the map's ticket lines will carry tldraw nanoids. Add `sourceId` to both shapes in M4.

### E12. Autosave must never write before the essay is loaded, and never on teardown (M2 follow-up)

A real data-loss bug, found while regenerating the fixture. `startAutosave` saved on its teardown callback. React StrictMode mounts, unmounts, and remounts in development, so the unmount between the two mounts wrote the **empty** store over `work/<slug>.tldr` — and the remount then read back the file it had just destroyed. Symptom: an essay opens with its cards freshly spread and every frame, arrow, and binding gone.

Two guards, both in place:

1. `startAutosave(editor, slug, isReady)` refuses to write until `openEssay` has resolved.
2. It no longer saves on teardown. §7 Stage 8 names exactly two triggers, every 30s and on blur; teardown was never one of them. Saving on unmount reads whatever the store holds mid-teardown, which is the same failure in different clothes.

General rule for anything that writes to `work/`: **the only thing worse than losing thirty seconds of work is losing the file.** A save path that can run against a half-initialized store must be gated, not trusted.

Operational note that follows from this: a browser tab left open on `?essay=<slug>` owns that file and will overwrite it on blur. Park the tab before running any CLI that reads `work/`.

### E13. One stamp helper, second precision (M3 prep, Jordan, 2026-07-30)

`generated:` was written at millisecond precision by the in-app path and second precision by the CLI, so a committed fixture stopped matching a fresh run. BUILD.md §7's example is `2026-07-30T14:02:11Z` — seconds. `src/lib/stamp.ts` now holds the only formatter (`formatStamp`, pure) and the only clock read (`nowStamp`), and both edges call it. Same reasoning as E8: two edges formatting the same field independently is drift waiting to happen.

### E14. The exporter masks frame children, and that is correct (M3)

`getSvgJsx` builds an SVG clip path for any shape whose parent is a frame, whether or not the frame is itself in the export. During the M3 gate two cards came out with their pigment rules and eyebrows sliced off, which looked like an export bug. It was not: those cards genuinely overhung their frame's top edge, and tldraw clips frame children **on canvas** too. The export was faithfully reproducing what the canvas showed.

Diagnostic, when a figure looks cropped: compare `editor.getShapePageBounds(id)` against `editor.getShapeMask(id)`. If the bounds fall outside the mask, the card is hanging out of its frame and the canvas is clipping it as well — fix the arrangement, not the exporter.

Consequence worth knowing for §10: a figure cut from framed cards inherits their frames' clipping. If a future figure ever needs to escape that, clone the shapes onto the page first — which is what BUILD.md §10's "clone the selected shapes" would buy. It is not needed while cards sit inside their frames.

### E15. The plate is a shape, not a wrapper (M3)

Following E10, the book-plate wrapper is a real `plate` shape created behind the selection, exported with it by id, and deleted in a `history: 'ignore'` run so it never enters the undo stack or outlives the call. One geometry therefore produces the SVG and the PNG, and neither can drift from the canvas.

The double rule is two 1px rects with a 1px gap in `toSvg`, and two 1px borders on a 3px `border-box` div on canvas — deliberately not `border: 3px double`, so the DOM cannot resolve the gap differently from the SVG. Verified in the exported file: `<rect y="896" height="1" fill="#6b5a4c"/>` and `<rect y="898" .../>`.

Plate height is `figureHeight + PLATE_PAD * 2 + captionHeight(caption, n, editor, plateW)`. `plateW` is required because the caption wraps and its height cannot be known without the measure it wraps to.

### E16. Driving a gate without the browser extension (M3)

The Chrome extension dropped mid-gate. Exports need a real browser, so the run was finished by driving headless Chrome over CDP with no dependencies (node 23 has global `WebSocket` and `fetch`): launch with `--remote-debugging-port`, `PUT /json/new?<url>`, connect to `webSocketDebuggerUrl`, then `Runtime.evaluate` with `awaitPromise` against `await import('/src/lib/exportFigure.ts')`.

Useful beyond the outage: it makes the export gate reproducible without a human in the loop. The harness lives in the session scratchpad, not the repo.

Headless note: `--screenshot` renders the file and then sometimes hangs on shutdown. Poll for the output file and kill the process rather than waiting on exit.
