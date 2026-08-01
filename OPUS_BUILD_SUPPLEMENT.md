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

### E17. Two relations, one binding type (M4, Jordan, 2026-07-31)

Compose's dependency arrows and DeltaView's correspondence arrows are both native `arrow` bindings, and they must never mix. A correspondence reaching `topo.ts` fabricates unsupported-claim warnings; a dependency reaching `delta.ts` silently marks a Received card as answered when nothing answers it.

The relation is stamped on the arrow shape's `meta` at creation and every consumer filters on it:

```ts
editor.createShape({ id, type: 'arrow', props: ARROW_PROPS, meta: { relation } })
```

`src/relations.ts` holds the vocabulary and the reader. `B` chooses by page: `dependency` on Compose, `correspondence` in the delta. **Arrows written before this rule carry no `relation` key and read as `dependency`**, which is what they were — the existing check fixtures carry no meta and still pass, which is that rule proving itself.

Any future relation drawn with an arrow gets a name here, never an implicit one.

### E18. §9's states table contradicts §9's prose (M4)

The table says a Received card is answered when it "has an **outbound** binding", and a Mine card is novel when it has no **inbound** one. That puts the arrow's tail on the Received card. But the same section glosses a binding as "*this* answers *that*", and `B` makes the current selection the arrow's **start** — Jordan selects his own card and clicks the received claim it answers.

Implemented: **the correspondence runs Mine (start) → Received (end)**. A Received card is answered when it is the *target*; a Mine card is novel when it is the *source* of none. The gloss and the interaction agree with each other and only two words in a table cell disagree. Taking the table literally would also make its two rows describe the same arrow twice, collapsing the asymmetry §9 is building.

Direction is strict, not "an edge either way": a backwards arrow then fails visibly (the hole stays open) instead of working silently and entrenching an inconsistent canvas.

### E19. A hole covers its card; the card is never moved (M4)

§16 forbids the canvas moving a card Jordan placed, and a computed state has no business rewriting his arrangement. So `reconcileGaps` creates the `GapShape` as the card's sibling at the card's own coordinates, and the card is **hidden** through `getShapeVisibility`, derived from the gaps present rather than stored on the card. Answering deletes the hole and the card reappears exactly where he left it.

Consequence for binding: in DeltaView the card behind a hole is not drawn, so §9's closing gesture can only land on the gap. `bind.ts` therefore accepts a gap as a target and resolves it through `facingId` to the real card. Without that, the one action that removes a hole is impossible in the view that displays holes.

### E20. The delta page is not the essay (M4)

DeltaView is its own tldraw page, so Compose's arrangement is never disturbed. That means `readout.ts` must scope the outline: **cards and frames on the delta page are excluded from `map.md`'s sections**, or Received and Mine would print as chapters of the essay. Gaps and tickets are collected from every page, because §9 requires a gap to become an open ticket wherever it lives.

### E21. `scripts/headless-eval.mjs` (M4, Jordan, 2026-07-31)

The browser gate is now a command, committed rather than improvised:

```
node scripts/headless-eval.mjs --essay test-essay --expr "<js>"
node scripts/headless-eval.mjs --essay test-essay --file step.js
```

Headless Chrome over CDP, no dependencies (node 23 has global `WebSocket` and `fetch`). Evaluates in the running app with top-level `await`, prints the result, exits non-zero if the expression throws — so a gate can depend on it. Vite serves ES modules, so `await import('/src/lib/delta.ts')` reaches the real code rather than a copy. It needs the dev server running and does not need the editor extension.

### E22. The fixture-desync gate step — mandatory from M5 (Jordan, 2026-07-31)

Twice now the committed evidence has failed to reproduce a gate claim. At M2 the committed `work/test-essay.tldr` predated the frames, so it did not produce the committed `map.md`. At M4 the same thing happened with the delta arrangement: the snapshot held three gaps and thirty-six atoms of accumulated gate debris, and a fresh readout added an `## Open tickets` section the committed file lacked. Same failure twice is a pattern, not an accident: a gate is driven from **live editor state**, and the live state is only evidence once it has been saved and the outputs regenerated from the saved file.

**Required before any milestone commit, in this order:**

1. Drive the gate, then **save the final arrangement** (blur, or an explicit write) so `work/<slug>.tldr` holds exactly what the gate claimed.
2. Verify the saved snapshot's census matches the claim — count the shapes, do not assume.
3. **Regenerate `out/` from the saved file**, via `npm run readout -- <slug>`.
4. `git diff` must then be **timestamp-only**. Anything else means the fixture and the outputs describe different canvases, and the gate is unproven.
5. Prove determinism at a fixed stamp: rerun with `--generated <same>` and diff to nothing.

A gate claim that a clean checkout cannot reproduce is a claim about a canvas that no longer exists.

### E23. No resolved-ticket state (M4, Jordan, 2026-07-31)

Closed permanently. **Deletion is closure** — that is what makes §7 Stage 6's "progress is visible by subtraction" literal, and what keeps `N OPEN` legible at a glance.

Retention already exists and does not need a canvas state: `work/*.tldr` is committed to git (§7.3), so every deleted ticket is recoverable from history. **The canvas stays alarm-only; git is the archive.**

In particular, a "resolved but retained" ticket must never be styled by draining its terracotta to ink. That would put a non-alarm ticket on the canvas and break the one-meaning rule the counter depends on.

### E24. Agent lifecycle (Jordan, 2026-07-31, non-negotiable)

**No gate commit until every spawned agent and shell has reported or been killed.** Twice an agent's report arrived after the milestone commit, and each time its late edits had to be reconciled by hand. Confirm three things before committing: every agent has returned, the task list is empty, and the process table holds nothing but the dev server.

### E25. Verify the fixture, not a file downstream of it (M5)

E22's gate step failed on its first outing, and the way it failed is worth recording. At the M4 fix I rebuilt `work/test-essay.tldr`, regenerated `out/`, and then ran a stray `git stash`/`git stash pop` inside a verification command. The stash reverted the snapshot before `git add`, so the commit carried the regenerated `out/` and the **old** `work/`. The desync survived the fix that was meant to remove it.

It survived because the verification was aimed at the wrong artifact: the clean-clone check counted `UNANSWERED` boxes in the committed `map.md`, which is an *output*. It would have read 6 whether or not the snapshot that produced it was committed.

**The check has to run the generator, not read its output.** In a clean clone: run `npm run readout` and require the result to match the committed `out/` on everything but the timestamp. That is the only form of the check that can fail when `work/` and `out/` disagree.

Corollary: never run `git stash` in a verification path. Verification must not be able to change the tree it is verifying.

### E26. `⌘⇧C` is only free because M0 emptied it (M5 follow-up, Jordan, 2026-07-31)

Worth recording because the dependency is invisible at the call site. `corpus-wall` binds `cmd+shift+c,ctrl+shift+c`, and that key is available only because `copy-as-png` and `copy-as-json` — both of which tldraw 5.2.5 ships on exactly that chord — are deleted in `RELEASED_ACTION_SHORTCUTS`.

Nothing in `tldraw-config.ts` links the deletion to the binding except order in the file. **If either action is ever restored, the collision comes back**, and it comes back quietly: two handlers match the same keystroke, the registry fires the first one that matches, and the corpus wall stops opening for reasons that have nothing to do with the corpus wall.

The same reasoning covers `⌘D` (needs `duplicate` deleted) and `F` (needs the frame *tool* deleted, C5). Any future binding of a chord tldraw already uses gets the deletion and the binding reviewed together, never separately.

### E27. The strip carries the hole too (M5, Jordan, 2026-07-31)

§8 specifies `--ink-4` hatching for unclassified *segments* and says nothing about the mono sequence strip above the band. Ruled: **unclassified units render in the strip as well, in `--ink-4`**, as `—` in the position the atom name would have occupied.

The alternative was to omit them, which would have made the strip read as a complete sequence of whatever happened to be classified — an analysis that looks finished because its gaps are invisible. §8's stated purpose for the `--ink-4` hatch is that "the gaps in the analysis are as visible as the analysis," and a strip that hides them would work against the band directly beneath it. Printing the hole in both places makes the hole in the legend and the hole in the band one fact rather than two.

Approved as reasoned. `UNCLASSIFIED_MARK` in `BandShapeUtil.tsx`.

### E28. `0 OPEN` is the absent segment, and the count spans pages (M5 follow-up, Jordan, 2026-07-31)

Two rulings on §7 Stage 6's ticket counter.

**On zero.** Stage 6 says "when it reads `0 OPEN`, the map is clear." The counter omits any segment reading zero rather than printing `0 OPEN`, so that literal string never appears. This satisfies the requirement rather than dodging it: the same section states that "progress is visible by subtraction" and "the absence of alarm *is* the progress bar." A row of zeroes is an alarm that has learned to say nothing. **The segment's absence is how the canvas says the map is clear** — consistent with the existing zero-omission rule for `UNSUPPORTED`, and with terracotta being spent only where something is actually missing.

**On scope.** The count was scoped to the current page while `readout.ts` collects tickets from every page (E20). A ticket written on the delta page therefore appeared in `map.md` under `## Open tickets` and in no counter anywhere — the margin could read `2 OPEN` while the map carried three boxes, and it failed in the direction that hides work. `openTicketCount` now walks every page. `CARDS`, `UNTYPED` and `UNSUPPORTED` stay page-scoped, because those describe the arrangement in front of Jordan; an open question is open wherever he wrote it.

### E29. `?` cannot be bound as `?` (M5 follow-up)

Corrects supplement §4.2, which proposed `help-overlay` with `kbd: '?'` and hedged that the bare-key binding "may prove unreliable." It is not unreliable, it is impossible, and it fails silently in two separate places.

`getHotkeysStringFromKbd` runs first and still honors tldraw's **legacy** modifier sigils, in which `?` means *alt*. It computes `alt = kbd.includes('?')`, strips the character with `kbd.replace(/[!?$]/g, '')`, and is left with an empty key, so `parseShortcut` returns `null`, `parsed.length === 0`, and `register` returns without adding anything. Even had it survived, `matchesEvent` opens with `if (e.shiftKey !== parsed.shift) return false`, and `?` is Shift+`/` on a US layout while `'?'` parses with `shift: false`.

**The working binding is `kbd: 'shift+/'`.** `getEventKey` folds `?` back to `/` through `SHIFT_KEY_TO_BASE` when shift is held, so the shifted keystroke matches. Verified in the running app: `?` opens the overlay, `?` and Escape both close it.

General rule: a `kbd` string containing `!`, `?` or `$` is being read as the legacy format. Never put those characters in a shortcut expecting them to be literal keys.

### E30. Ruling — the selection handle stays 8px (M5 follow-up)

§5.5 row 3 asks for `var(--ink)` square handles at **6px**. Shipped: square, 0 radius, ink stroke, paper fill, **8px**. Ruled acceptable, because the size is not reachable and the alternatives are worse than the miss.

`handleSize` is a local `const handleSize = 8 / zoom` inside the private `_computeSelectionState` of `SelectionForegroundOverlayUtil`. The util's public options are `{ lineWidth, zIndex }` only, so `.configure()` cannot reach it, and TypeScript refuses a subclass that redeclares the private method (`TS2415`). The only remaining routes are copying roughly 200 of the file's 477 lines into a subclass, or monkey-patching — and both would also distort the crop handles, the mobile rotate puck and the text-resize bars, all of which derive from the same local. Both break on any 5.2.x patch.

Two notes. The paper fill is not a miss but E2's existing ruling, which already describes "paper-filled square handles." And `6` does appear in that file — as `hitTargetSize = 6 / zoom`, the invisible hit target — so §5.5's "6px" looks like a transcription of the constant tldraw exposes to pointer maths rather than one it ever exposed to paint.

### E31. Opening an essay must clear the undo history (M5 follow-up)

A data-loss bug of the same family as E12, reached by a different road, and found by probing `⌘Z` during the final sweep rather than by anything failing.

`openEssay` called `loadSnapshot` and then `createShapes` for new fragments. Neither is preceded by a history mark, so both sat on the undo stack. **The first `⌘Z` after opening an essay therefore unwound past them and emptied the canvas** — measured at eighteen shapes to zero on the test fixture, from a single undo. Autosave would then have written that empty store to `work/<slug>.tldr` within thirty seconds.

E12's guard cannot catch this. It asks whether the store is ready, and a store that undo has just emptied is ready; it is simply empty.

`editor.clearHistory()` now runs at the end of `openEssay`, which is what tldraw's own documentation prescribes when loading a document. `⌘Z` remains tldraw's default per §11 — it just no longer has the essay's arrival behind it to undo into. Re-verified: one undo now reverses one edit, and further undos are no-ops with all eighteen shapes standing.

The general rule, third time it has come up: **anything that puts an essay on the canvas is not an edit, and must not be reachable by any mechanism that reverses edits.**

### E32. The delta reconciles on change, not on entry (M5 follow-up)

`reconcileGaps` ran only from `openDeltaView`, so it only ran on `⌘D`. §9's closing gesture — "binding a Mine card to a Received card converts the gap back to a normal card" — therefore appeared to do nothing: the arrow landed, and the hole stayed until the view was re-entered.

Worse, the two indicators §9 exists to keep in agreement disagreed. `DeltaCounter` recomputes from the store on every change, so it dropped to `6 UNANSWERED` the instant the arrow landed while seven holes were still drawn. A counter and a canvas driven by different triggers will always find a moment to contradict each other.

`src/ui/DeltaReconciler.tsx` now reconciles whenever the correspondence graph changes. It renders nothing. Its signature is the *wanted* state — which holes should exist, which cards are novel — and neither quantity is derived from the holes or the marks themselves, so reconciling cannot change its own input and the loop settles in one pass; `reconcileGaps` returns before touching the store when there is nothing to do.

The same pass also closed §9's third state, which had never been rendered at all: `NOVEL_MARK` was declared in `delta-types.ts` and had **zero consumers**, so a Novel Mine card was pixel-identical to an answering one. It survived the M4 gate because the committed arrangement has `novel = 0`. Novelty is now stamped on the card's `meta` by the same reconciliation and read by both `component()` and `toSvg()` — on the record rather than recomputed at each edge, because E10 rules that anything appearing in an exported figure has to be reachable from the shape itself.

Verified both directions: deleting one correspondence opens a seventh hole, marks its Mine card `※`, and reads `7 UNANSWERED · 1 NOVEL · DELTA 8`; drawing it again closes the hole, clears the mark, and returns the hidden card, with no `⌘D` in between.

### E33. Small departures from §10's letter (M5 follow-up)

Four items found in the final sweep, none worth changing behavior for, all recorded so they are deviations rather than drift.

1. **The `⌘E` prompt has two fields, not one.** §10 says "a one-field prompt". The second is the optional `¶` reference, which §10 itself requires for the colophon ("plus the essay's paragraph reference, if given"). There is nowhere else to author it, so the two sentences cannot both be satisfied literally; the colophon wins and the field stays optional.
2. **`getSvgString` is called with `background: false`**, where §10's call passes `background: true`. C3 authorizes the method change but not the flag. It is correct here: the plate's own `--paper` rect spans the full viewBox, so a background the exporter painted would be invisible underneath it, and asking for one would only risk a second ground of a different color.
3. **The toast said `FIG. 01 EXPORTED`** while the plate said `FIG. 1`. §10's example is unpadded in both places. Fixed rather than logged as a deviation — the zero padding belongs to the filename, where it sorts.
4. **Correction to §4.2 and C5:** `cmd+e` is *not* tldraw's default "export image" in 5.2.5. No default action or tool holds it; the only `cmd+e` in the package is an inert label inside the keyboard-shortcuts dialog, which is nulled. No deletion was needed and none should be added.

### E34. Frame headings in plates — tldraw hard-codes Arial for SVG (Finalize, Jordan, 2026-07-31)

**Upstream cause.** `node_modules/tldraw/dist-cjs/lib/shapes/frame/frameHelpers.js:60` reads `fontFamily: isSvg ? "Arial" : "Inter, sans-serif"`. The frame heading's export font is not a theme value, not a font slot, and not reachable through `assetUrls` — it is a literal, chosen per-path. `FrameShapeUtil.toSvg` then draws the heading in a chip with `rx: 4`.

So every plate cut from a selection containing a frame shipped its **section titles in Arial**, unembedded, inside a 4px-radius chip — while the canvas showed those same titles correctly in Instrument Serif italic 20px, because there the font comes from CSS on `.tl-frame-heading`. Two failures at once: §5.4's silent-fallback failure, on someone else's machine, and a radius §2.3 forbids. It was invisible until a figure was opened somewhere else, and the committed `fig-01` did not catch it because that figure was cut from four bare cards with no frame in the selection.

**Ruling — render them, matching the canvas.** Section titles are content, not chrome: a figure of an argument spine whose sections are unnamed has lost the map. Omission is already available by selecting cards without their frame, so building an omit option would duplicate a choice the selection model already provides.

`src/shapes/SectionFrameUtil.tsx` subclasses `FrameShapeUtil` and overrides **`toSvg` only** — the canvas was already right — plus `getFontFaces`, without which the embedder never fetches the italic face and the title falls back to a system serif one step further along. The heading is drawn as text alone: tldraw's chip is a hit target for dragging a frame by its title, which is a canvas affordance with no meaning in a printed figure.

**Parity is defined at zoom 1**, and that is not a shortcut. The canvas heading is scaled by `1/zoom` so it stays legible while zooming, so a fixed-scale export can only agree with it at one zoom — the one where a page unit is a CSS pixel. Measured against the running canvas there: the 24px heading box spans -28 to -4 from the frame's top edge and the text's line box spans -32.875 to +1.125, both centred on -16, which is why a single constant places the text. The three numbers behind it (`--tl-frame-height: 24`, `FRAME_HEADING_NOCOLORS_OFFSET_X: -7`, `FRAME_HEADING_OFFSET_Y: 4`) are transcribed with the same posture as the token literals in `AtomShapeUtil`.

Verified the E14 way, against the artifact rather than the intention. Exported a selection of a frame and its six cards: `grep -c Arial` = **0**, `grep -c 'rx="4"'` = **0**, 21 embedded `data:font` faces, and the heading emitted as `<text x="-7" y="-16" dominant-baseline="central" font-family="'Instrument Serif'…" font-size="20" font-style="italic" fill="#1a1410">The seam</text>`. Canvas measured x = -6.875 and centre y = -15.875 against the export's -7 and -16 — **0.125px on both axes**, which is `getBoundingClientRect` sub-pixel rounding and an order of magnitude inside the tolerance E4 set for the card. Opened from `file://` with the dev server stopped and **zero listeners on 5173** confirmed before, during and after: `Instrument Serif italic 400 loaded`, alongside EB Garamond and JetBrains Mono.

That trio is the first time §10's M3 gate has been satisfied in full. Until now no exported figure contained Instrument Serif at all, because the only shapes that declare it are the band and the frame label, and no gate had ever exported either.

The verification figure was deliberately **not** committed. It was cut to prove the export, not to become part of the fixture Jordan runs the Plate Test against; `out/` is back to exactly what M5 committed.

### E35. Ticket ids were allocated against one page (Finalize, 2026-07-31)

`nextTicketId()` built its set of taken ids from `editor.getCurrentPageShapes()`. Tickets live on every page. `readout.ts` collects them from the whole store on purpose (E20) and the margin counter counts them the same way (E28) — **allocation was the third place that had to agree, and it was the one that did not.**

Repro, run through the real `T` key in the running app: press `T` on Compose and get `t-001`; switch to the delta page and press `T`; the scan cannot see across, so `t-001` is handed out a second time. `map.md` then carries two `## Open tickets` lines under one id, and the trace from a line in the map back to the shape on the canvas — the thing E11 added `sourceId` to preserve — is gone for both of them.

`usedTicketIds` now walks `getPages()` → `getPageShapeIds()` → `getShape()`, which is the same walk `Counter.tsx` makes for `openTicketCount`, deliberately, so the two read as one decision rather than two that happen to agree. Allocation order is unchanged: the lowest free `t-NNN` wins, so a deleted ticket's id is reused, which is what E23 means by deletion being closure.

Verified after the fix, same repro: `t-001` on Compose, `t-002` on the delta page, two distinct lines in `map.md`.

`scripts/check-tickets.ts` is the regression guard, and it earns its place by failing against the old implementation rather than merely passing against the new one — with the page-scoped body restored, 6 of its 12 cases fail, including `three presses, three ids in order` returning `["t-001","t-001","t-002"]`. It is its own suite rather than a case inside an existing one because `tickets.ts` is editor-facing, and the other suites' stated worth is that they prove the pure core runs outside a browser (§6.2); importing tldraw into one of them would spend that proof to save a file.

**Gap ids are not affected, and this was checked rather than assumed.** `g-*` ids are derived, not allocated: `gapSourceId()` computes `g-` plus the facing card's own `sourceId`, with no scan and no counter, so there is no set that can be under-scoped. Its inputs are store-wide already.

### E36. A frame is a section boundary, not a viewport — supersedes E14 (UX, Jordan, 2026-07-31)

From Jordan's first real session: a card overhanging its frame was drawn amputated — cut mid-sentence, and where it hung off the top, cut above the eyebrow, so the card lost the one mark that says what kind of atom it is.

**E14 examined this and got the diagnosis right but the verdict wrong.** It concluded the export was faithfully reproducing the canvas, and it was: `editor.getShapeMask` and the exporter's SVG clip path both read from `util.getClipPath()`, so the two agreed exactly. What E14 did not ask is whether the thing they agreed on was correct. Parity was holding while both halves were wrong, which is the failure mode parity checks are least able to see.

**Ruling: paper never hides words.** A frame marks where a section begins and ends; it is not a window onto the section. A card that has grown past its frame is telling Jordan something true about the essay's shape, and answering that by cutting the card in half destroys precisely the information he needs to act on it. §16 forbids the canvas quietly rewriting an arrangement he made; hiding half of it is the same sin said louder.

`SectionFrameUtil.getClipPath()` returns `undefined`, which is the documented opt-out. Because one hook feeds the canvas mask and the exporter's clip path alike, the fix lands on both paths at once — parity by construction rather than by agreement, which is E10's rule paying for itself a second time.

Verified with a card pushed 82px above its frame's top edge: `getShapeMask` returns `null`, `getClipPath` returns `null`, the exported SVG contains **zero** `clip-path` attributes and zero `<clipPath>` definitions, the eyebrow survives into the export, and the canvas screenshot shows the whole card — pigment rule, eyebrow, body and meta line intact.

One second mechanism was checked before calling it done, because removing a clip is worthless if something else crops the same pixels. `FrameShapeUtil.isExportBoundsContainer()` returns true, so a frame in the selection sets the export's boundary — which could have cropped the overhang at the viewBox instead. It does not: exporting the frame with a card hanging 92px above it produced `viewBox="-40 468 1120 632"`, starting at the card's top rather than the frame's and standing 632 tall against the frame's 540, which is the frame plus the overhang exactly. The bounds expand to hold what escapes.

E14's diagnostic advice still stands and is still useful: comparing `getShapePageBounds` against `getShapeMask` is how you tell a clipping problem from a rendering one. Only its conclusion — that the clipping was correct because it was faithful — is withdrawn.

**The general lesson is about parity, not frames.** Parity between canvas and export is a check on *consistency*, and a consistency check cannot see a fault that both sides share. Every rule in this build that forces one source to feed both paths — E10's display values, E15's plate shape, E8's single serializer — buys agreement, not correctness. Agreement is worth having because it makes a fault appear in both places at once instead of hiding in one; it is not evidence that there is no fault.

### E37. The rename state was ours to break (UX, 2026-07-31)

Double-clicking a section title showed a title that appeared doubled and heavier, on a ground that did not match the canvas, inside a box the display state does not have. Four causes, and **two of them were this repo's own overrides regressing behavior tldraw had right**:

1. **The doubling was ours.** tldraw sets `.tl-frame-label__editing { color: transparent }` to hide the static text node while the input is live. The de-tldraw pass then restored `color: var(--ink)` on `.tl-frame-label` at equal specificity but later in the cascade, un-hiding it — so the title printed twice, the second copy 5px low, which reads as a heavier, taller face rather than as two copies.
2. **The second focus ring was ours.** `.tl-container :focus-visible` at (0,2,0) put a 2px ink outline around the input, because a text field matches `:focus-visible` on a plain mouse click, not only from the keyboard.
3. tldraw's own `background-color: var(--tl-color-panel)` gave the input paper-warm where display is paper.
4. tldraw's own `box-shadow: inset 0 0 0 1.5px var(--tl-color-selected)` drew a ring display does not have.

The font was never wrong: the input already computed `Instrument Serif italic 20px` in `--ink`. It only looked wrong because two copies of it were overlapping.

Fixed by specificity, no `!important`. The ground stays painted rather than transparent on purpose — tldraw flips the heading to `overflow: visible` while editing so a long title can grow past its box, and an unpainted overflow would drop the tail onto bare canvas. It is painted `var(--paper)`, the same value `theme.ts` already gives the heading as `negativeSpace`, so the box is seamless rather than announcing itself.

Verified at runtime rather than in the stylesheet: with the frame in its editing state, the input computes byte-identically to the display input on family, size, style, weight and colour; the static label computes `rgba(0, 0, 0, 0)`; box-shadow is `none`; the focus outline is `none`. The only visible difference between reading a title and renaming it is a caret and the selection highlight.

The lesson worth keeping: **an override that repaints a property tldraw uses as a state signal will silently disable that state.** `color: transparent` was not decoration; it was how the editing state hid the text underneath it.

### E38. Discoverability, and one caveat about marginalia in plates (UX, Jordan, 2026-07-31)

Jordan did not build this app. Everything it does is on a key, and a key is only a feature if you already know it is there. Three affordances, one principle — nothing new is added to what the app *can* do, only to what it *shows*:

- **A custom context menu**, right-click anywhere on the canvas. Selection-aware: typing, framing, binding, exporting and deleting when something is selected; tickets, readout, the two views, save and the keyboard map when nothing is. Brand-styled — `--bg-2`, hairline bone, 2px radius, mono uppercase labels with the shortcut right-aligned in `--ink-4`, and a restrained `--shadow-lift` rather than the modals' `--shadow-deep`, because a menu that casts a modal's shadow is claiming to be a modal.
- **`? KEYS` in the bottom-left counter strip**, always present and clickable. The margin strip is pointer-transparent so it never steals a click meant for the paper, so this one element takes its pointer events back. It renders even on an empty canvas: the way into the map is the one thing that must not depend on there already being something on the canvas.
- **The marginalia row in the `?` overlay**, documenting a discovery rather than a feature.

**Every row invokes the same action the key invokes**, read from the actions registry by id — so §8's reinterpretation of `1`-`4` on the corpus wall and E17's dependency-versus-correspondence branch come along for free, because those branches live inside the action rather than beside it. The shortcut a row prints is read from the same registry entry it calls, so a rebinding cannot leave the menu lying. One exception is documented in the code: `help-overlay` is bound `shift+/` (E29), which tldraw's formatter would print as `⇧/`, so the row passes a literal escape to print `?` — the key §11 names and the key Jordan presses.

Verified end to end rather than by inspection: with a card selected, the menu's `Type as claim` row moved the card from `untyped` to `claim` and closed the menu; with nothing selected, `New ticket` created a ticket and put it straight into edit mode, which is exactly what `T` does.

**Ruling — double-clicking empty paper makes a tldraw text shape, and it stays.** It is marginalia. `readout.ts` collects atoms, frames, tickets and gaps and knows nothing about text shapes, so a note never reaches `map.md` or `assembly.json` — verified against Jordan's own two notes. That is correct and deliberate: an annotation is not an atom, and a canvas that forced every scribble into the outline would stop being a place to think.

**The caveat, which is new and matters.** A text shape included in a `⌘E` selection exports inside a **`<foreignObject>`** — the exact mechanism BUILD.md §6.2 and §10 single out as fragile, and the reason all five custom shapes implement `toSvg` by hand. Measured on a real export: the note renders correctly from `file://` with the fonts embedded, so it is not broken in a browser. But §10's warning is about *other* renderers, and Substack is the named one. So: **marginalia is safe on the canvas and in the map; it is a risk inside a published plate.** The practical advice is to leave notes out of an exported selection. Whether the app should refuse them, warn, or say nothing is a §15-class decision and is Jordan's, not mine.


### E40. A view you cannot leave is a trap (UX, Jordan, 2026-07-31)

Jordan opened the corpus wall and could not get back. There was no route to the essay canvas from either view: `⌘D` and `⌘⇧C` opened their page and did nothing when pressed on it, `Escape` was unclaimed, the context menu offered every command except the way out, and pages are invisible in this build (`PageMenu` is null) so there was nothing on screen to click. The exit was refreshing the browser tab — which USING.md had written down as advice, which is the tell: a workaround documented as a feature is a missing feature.

Worse, neither view said what it was. A page named `Corpus` reads as a page named nothing; arriving on one looked like the essay having changed under you.

Three routes home, one label, and all four of them speak through the same action:

- **The view keys became toggles.** `⌘D` on the delta returns; `⌘⇧C` on the wall returns. The branch tests the view the key *names*, never "am I away" — written the sloppy way, `⌘⇧C` pressed on the delta would go home instead of crossing to the wall. `scripts/check-views.ts` has a `crossing` section that exists only to fail against that version.
- **`Escape`, when there is nothing else to close.**
- **`Back to essay  Esc`, first row of the context menu**, on both views and in both selection states — a right-click on the wall lands on a band and a right-click in the delta lands on a card, so being away from the essay is not a fact about what is selected.
- **A margin strip, top-left**: `DELTA VIEW · ESC RETURNS`, `CORPUS WALL · ESC RETURNS`. Nothing on the essay canvas: home needs no sign, and a margin that always carries a line stops being read (§9's counter follows the same rule). Naming the surface without naming the exit would only have made being stranded legible.

Page identity moved into `src/lib/views.ts`, so "which surface is this" and "which page is home" cannot drift apart; `isDeltaPage` and `isCorpusPage` are kept where their callers expect them and now both read from `currentView`. Home is found by **elimination** — the first page that is not one of the two named views — because the only two names this app controls are the two it is eliminating. The camera is not touched on the way back: pages keep their own, so Jordan returns to the canvas he left rather than to a fitted view of it.

**The finding worth keeping is about Escape, and it cost a runtime measurement to see.** Binding `esc` in the actions registry is one line, and it is wrong. tldraw's shortcut manager listens on `document.body` in the **bubble** phase and guards itself with `getEditingShapeId()`; the editor's own state machine listens on the **container**, which is a descendant of the body. So the container has already ended the edit by the time the body asks whether an edit is in progress. Measured, with a card in edit mode on the delta page: one `Escape` both closed the text editor *and* jumped to the essay canvas, eating the keystroke Jordan pressed to stop typing. Nothing in the stylesheet or the registry shows this; only pressing the key does.

The fix is phase, not logic. `src/ui/EscapeRoute.tsx` listens in the **capture** phase on the container's document, where "was something open when this key went down" is still the truth, and every exclusion then falls out of reading that state early: `menus.hasAnyOpenMenus()` covers the context menu, the caption prompt and the `?` overlay in one question, because tldraw registers dialogs there too; `getEditingShapeId()` covers a card being typed into; a text-field check covers the frame-rename input. Bind mode needs no clause at all — `bind.ts` listens on `window` in capture and stops propagation, and window capture runs before document capture, so cancelling a bind can never also navigate. The event is neither prevented nor stopped, so `Escape` keeps doing its ordinary work on the way past.

That listener calls the registered `back-to-essay` action rather than `returnToEssay`, so the key and the menu row remain one implementation — E38's rule holds. What it costs is E38's other rule: `back-to-essay` is the one action in the registry with no `kbd`, so its menu row **states** its key rather than reflecting it. That is a real weakening of "the shortcut printed is the shortcut bound", and it is written down in `ContextMenu.tsx` beside the exception rather than left for someone to discover.

Verified at runtime from both views by all three routes, and on all four exclusions: `Escape` closes the context menu and stays; closes the `?` overlay and stays; ends a card edit and stays; and pressed again with nothing open, returns. Crossing was verified in both directions — `⌘⇧C` on the delta opens the wall, `⌘D` on the wall opens the delta. On the essay canvas the strip is absent, the menu has no return row, and `Escape` does nothing.

**The general lesson: a guard that reads shared state is only as correct as the moment it reads it.** `getEditingShapeId()` was the right question asked too late. When two listeners on the same event both mutate and inspect the same state, the phase they run in *is* the logic.

### E41. M6 pre-build rulings (Fable, by Jordan's delegation, 2026-07-31)

`M6_GENERATIVE.md` §13 lists five decisions Fable does not make. Jordan delegated
them ("use your best judgement", 2026-07-31, before the M6 build began). Each is
his to overturn; none is entrenched in a schema.

1. **All six forms survive.** Two are wholesale reuse (`delta`, `band`) and the
   real cut lives in `/draw`'s standing instruction to skip forms that do not
   fit — an unused form costs nothing, an unbuilt one is a gap Jordan cannot
   fill by waking up. He cuts after the Trace Test with evidence instead of
   before it without.
2. **`field`'s y-axis is model-declared**, poles labeled, per §5.3's own text.
   The trace review gate is where a wrong axis dies, and it dies in seconds.
3. **`/trace` may propose tensions Jordan has not noticed**, only between units
   that both carry spans, and each proposal is marked `"proposed": true` so the
   review can delete them wholesale. "At most dialectic" permits naming a
   tension; resolving one stays forbidden. The Trace Test's pass condition —
   "shows him something he hadn't already seen" — is exactly this clause.
4. **Compiled canvases land in `work/` beside hand-built ones.** §2 decides it:
   the generative path and the manual path produce the same kind of object, and
   a `work/generated/` would fork the instrument in the filesystem after M6
   went to the trouble of not forking it in the vocabulary.
5. **No fifth atom type** — was never open (§13.5 states it as a refusal).

Implementation rulings made under the same delegation, recorded because they
shape code:

6. **Spans are located by code, not by the model.** The `/trace` skill writes a
   verbatim `quote` per unit; `npm run trace -- --resolve <slug>` finds each
   quote in its context file and mints `start`/`end`. Character arithmetic is
   precision, and §1's division of labor sends precision to code. A quote that
   does not resolve verbatim, or resolves ambiguously, fails loudly and stays
   unresolved — lint's `unfounded` then refuses it a canvas.
7. **Skill format.** This repo has no skill files (`BUILD.md`'s essay-assembly
   skill lives outside it). `/trace` and `/draw` land as
   `.claude/skills/<name>/SKILL.md`, invocable in Claude Code; their
   deterministic halves are npm scripts like every existing command.
8. **No graph library.** dagre would be a new dependency, which §9.4 forbids.
   `genealogy` and `mechanism` use a hand-rolled longest-path layering —
   deterministic, ~100 lines, and its output is testable.
9. **Edge labels are not rendered in M6.** The relation kinds live in the scene
   and the trace, not as canvas text. Lint's `collision` check is implemented
   and vacuously passes until labels exist, so adding them later meets a gate
   that already works.
10. **The `band` form emits `corpus/<slug>.assembly.json`** from trace units —
    atom per unit, weight from span length — and M5's wall renders it against
    the corpus with zero new canvas code. Classification here is not guessing:
    the atoms come out of a trace Jordan has reviewed, which is the judgment §8
    requires. One band still compares nothing; the wall is what makes it a
    comparison.
11. **Fixture policy.** `context/test-trace/` is committed synthetic fixture
    material, and its trace may carry `reviewed: true` as scaffolding — it is
    not Jordan's idea and the gates need a reviewed trace to exercise `/draw`
    and the compiler. **No trace of Jordan's real material is ever marked
    reviewed by the machine.** The real-essay trace committed for the M6.1 gate
    stays `reviewed: false` until he reads it.

### E42. A generated essay opens with no inputs/ at all (M6.2)

`openEssay` read `inputs/<slug>/` unconditionally and threw on the plugin's
404, so a canvas that exists only as `work/<slug>.tldr` — which is what the M6
compiler produces — could never be opened. `readInputsOrNull` now returns null
for a missing folder and `openEssay` proceeds with zero fragments, provided
the work file exists. A slug with *neither* is still refused loudly: opening a
typo as a blank canvas would invite autosave to mint an empty work file under
the wrong name, which is E12's failure wearing a new hat.

Also recorded: the spine's dependency rail is drawn with **elbow arrows bound
to the cards' right edges** — no new shape. They carry `meta.relation:
"trace"` (the trace kind rides in `meta.kind`), and `trace` joined the
vocabulary in `src/relations.ts` per E17's standing rule. Without that entry,
`relationOf`'s legacy fallback would have read every generated rail as a
dependency and topo.ts would have raised unsupported-claim warnings on pages
the compiler had just laid out. Verified live: a compiled spine page reports
zero dependency edges and zero unsupported marks.

### E43. Deterministic fractional indices come from the library's own test path (M6.2)

§6.3 rule 3 (use the library's index utilities) and E22.5 (same input, same
bytes) collided: `@tldraw/utils` picks its key generator at import time, and
the default path **jitters** — `getIndicesAbove(null, 2)` returns different
keys on every run, a collision defense for concurrent writers. The compiler is
a single writer whose gate is byte-stability, so `compile-deps.ts` sets
`NODE_ENV=test` before importing, which is the library's own switch to the
plain `generateNKeysBetween`. Still the library's mint, still validated keys —
just the deterministic branch of it. Hand-rolling indices remains forbidden.

One eval-side note for future gates (not an app bug): after editing a source
file while the dev server runs, Vite pins `?t=` HMR URLs inside the app's
module graph, so a bare `await import('/src/lib/x.ts')` from headless-eval can
get a **second module instance** whose module-level state (e.g. `openEssay`'s
`ready` flag) is fresh. A gate that drives module state must call the module's
own entry points in the same eval rather than assuming it shares the app's
instance.
