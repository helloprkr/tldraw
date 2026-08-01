# M6_GENERATIVE.md — trace and draw

**Extends:** `BUILD.md`. Read that first; this assumes M0–M5 are done and reuses their shape utils, tokens, plate wrapper, and export path.
**Executor:** Fable 5, in Claude Code, inside `essay-canvas/`.
**Patch to BUILD.md §13:** add one row —

| **M6** | Generative trace → scene → canvas. See `M6_GENERATIVE.md`. | Trace Test (§10) passes. |

---

## 1. What M6 adds

Today the canvas starts from fragments Jordan already wrote. M6 lets it start from a pile of context: an essay, some snippets, a few tweets, a half-formed idea. Claude Code reads the pile, traces the idea's structure, and drafts several diagrams from it.

**The claim that makes this possible:** a `.tldr` file is JSON. Claude Code writes files. So Claude Code can draw — not by moving a pointer, but by emitting records. The output is not a picture; it's shapes, on the same canvas, draggable.

**The division of labor, which governs every decision below:**

> **The model handles meaning. Code handles precision.**

Claude Code decides what the idea is and which form fits. It never computes a coordinate, never mints an id, never writes a `.tldr`. Every failure mode in §3 comes from violating that line.

---

## 2. Nothing new gets invented

M6 introduces **no new vocabulary.** The four atom types from `BUILD.md` §5.2 — `claim`, `move`, `figure`, `stance` — carry all the way through: context → trace → scene → canvas → `map.md`.

This is deliberate and load-bearing. Because the trace speaks in atoms, a traced idea can feed `spread` directly (`BUILD.md` §7 Stage 1) and become a hand-composable canvas of typed cards. The generative path and the manual path produce **the same kind of object.** M6 is a faster on-ramp to the existing instrument, not a second instrument.

Terracotta still means absence only. Nothing generated may claim it.

---

## 3. The four failure modes and their fixes

Build these fixes structurally. Do not attempt to prompt around them.

| Failure | Why it happens | Fix |
|---|---|---|
| Invalid `.tldr` | Records need exact id formats, fractional indices, per-shape prop schemas, a schema version. Hand-authored records fail validation or load blank. | Model writes `scene.json`. A deterministic compiler emits `.tldr`. §6. |
| Overlapping, drifting layout | Language models are unreliable at absolute coordinates. | The scene spec **has no coordinate fields.** Layout is computed. §5, §6.2. |
| Generic boxes and arrows | Open-ended visual generation regresses to the mean. | A closed vocabulary of six forms. The model picks and fills; it does not invent a layout. §5. |
| No feedback | Claude Code cannot see the canvas. | Deterministic lint pass reporting text. §7. Optional vision loop, §8. |

---

## 4. Pipeline

```
context/<idea-slug>/          essay.md, snippets, tweets — mixed, messy
        │
        │  /trace
        ▼
out/<idea-slug>/trace.json    structure only. no pictures. every claim
        │                     points at a span in a context file.
        │
        │  ◆ JORDAN REVIEWS AND CORRECTS ◆      ← the gate. §9.
        │
        │  /draw
        ▼
scenes/<idea-slug>/*.scene.json    form + nodes + edges. no coordinates.
        │
        │  npm run compile   (deterministic: layout, ids, records)
        ▼
work/<idea-slug>.tldr         valid tldraw scene, opens in essay-canvas
        │
        │  npm run lint  →  fix  →  recompile
        ▼
out/<idea-slug>/figures/*.svg + *.png     plate wrapper, house language
        │
        ▼
Jordan opens the canvas and moves things            ← the human rung
```

The gate exists because correcting a structural trace takes two minutes and correcting six wrong diagrams takes an hour. Put the review where errors are cheapest.

---

## 5. The six forms

This is the actual spec. Everything else in M6 is plumbing around this list.

**Two already exist.** `delta` is M4's `DeltaView`; `band` is M5's `CorpusWallView`. M6 only adds their generative fill plus four new layouts.

**Jordan cuts this list before M6.2 begins.** Do not build a form he hasn't kept.

### 5.1 `spine` — the argument in order

*For:* showing how a piece actually walks. The default form; when in doubt, this one.

- **Structure:** one ordered column of claims. Moves sit in the left margin as annotations. Figures sit right as insets.
- **Layout:** column at x=0, width 420. Margin annotations x=−320, width 260. Insets x=460. `y` accumulates by measured content height plus `--s-6`. Fully deterministic, no graph library needed.
- **Edges:** the column *is* the order — draw no vertical arrows. Explicit dependency arrows only, rendered as a bracket rail to the far right in `--ink-3`.
- **Don't use it for:** anything with genuine branching. A spine that forks is a `genealogy`.

### 5.2 `delta` — received vs. mine

*For:* the opening move of the wayfinder method. Where's the difference, and where is there no answer yet.

- **Structure:** two columns, `received` and `mine`, plus correspondence edges.
- **Layout:** correspondence pairs share a y-band. Unmatched items fill remaining slots in order. Gaps place at the y of the card they face.
- **Reuses M4 wholesale** — `GapShape`, the counter, the ticket wiring into `map.md`. The generative path only populates it.
- **Don't use it for:** ideas with no interlocutor. If there's no received view, this form manufactures a strawman.

### 5.3 `field` — the positioning map

*For:* where things sit relative to each other. Two axes, and the argument is the placement.

- **Structure:** items plus an axis declaration.
- **The x-axis is always abstraction** — concrete left, abstract right, per the house convention in `BUILD.md` §1. The model declares the y-axis and labels both poles.
- **Layout — the one exception to "no positions":** the model emits **ordinal rank** on each axis (`1..n`), never pixels. The compiler maps ranks onto a grid and resolves ties by nudging along the less-loaded axis.
- **Visual:** axes are hairline `--bone` rules with mono uppercase pole labels at the extremes in `--ink-3`. No gridlines. No quadrant tints.
- **Don't use it for:** more than about fifteen items. A crowded field is a hairball with axes.

### 5.4 `genealogy` — where it came from

*For:* tracing an idea back to what fed it. Directly serves provenance — essay back to the birth of the impulse.

- **Structure:** a DAG. Sources at the top, synthesis at the bottom.
- **Layout:** rank-based, top-to-bottom (dagre or equivalent).
- **Visual:** sources are **not** Jordan's atoms and must not wear atom pigments. Render them as mono citation cards — `--paper-deep` ground, `--ink-3` text, no top rule. The pigments begin where his thinking begins. That contrast is the point of the form.
- **Don't use it for:** ideas with one source. That's an arrow, not a diagram.

### 5.5 `mechanism` — how the thing works

*For:* process, cycle, feedback. Metabolism diagrams.

- **Structure:** a directed graph with explicit `feedback: true` edges.
- **Layout:** rank-based, left-to-right. **Feedback edges route as curved returns below the main line** — this is the only non-trivial routing in M6; budget for it and don't fake it with a straight line through the middle of the diagram.
- **Visual:** feedback edges are `--ink-3` dashed, 1px, arrowhead at the return point.
- **Don't use it for:** a sequence with no loop. That's a `spine` lying down.

### 5.6 `band` — the corpus wall

*For:* comparing compositional rhythm across essays.

- **Reuses M5 wholesale.** The generative path fills segments from trace units instead of `.assembly.json` files.
- **Don't use it for:** a single essay. One band compares nothing.

---

## 6. Schemas

### 6.1 `trace.json`

The heart of M6. Structure only — no visual language anywhere in this file.

```jsonc
{
  "idea": "Attention is a digestive capacity, not a resource to be spent.",
  "slug": "metabolism-of-attention",
  "reviewed": false,            // ← /draw refuses to run while false. §9.
  "generated": "2026-07-30T…",

  "sources": [
    { "id": "s-1", "kind": "essay|snippet|tweet|note",
      "file": "context/metabolism-of-attention/hwang-macroscience.md",
      "cite": "Hwang, On macroscience, 2026" }
  ],

  "units": [
    { "id": "u-1",
      "atom": "stance",                    // claim | move | figure | stance
      "text": "The received view treats attention as a resource to be spent.",
      "holder": "received",                // received | mine  (drives `delta`)
      "span": { "source": "s-1", "start": 1204, "end": 1310 },   // REQUIRED. §9.
      "abstraction": 3                     // ordinal 1..n (drives `field`)
    }
  ],

  "relations": [
    { "from": "u-2", "to": "u-1", "kind": "answers|supports|counters|derives|feeds" }
  ],

  "tensions": [
    { "between": ["u-1", "u-4"], "note": "both can't hold if satiety is real" }
  ],

  "gaps": [
    { "facing": "u-1", "label": "the received view's account of satiety" }
  ]
}
```

Notes that matter:

- **`span` is required on every unit.** It points at actual characters in an actual context file. See §9.
- `atom` uses the four types from `BUILD.md` §5.2. No fifth type. No free-text tags.
- `holder` is only meaningful for `delta`; leave it `null` otherwise rather than guessing.
- `gaps` map straight onto M4's `GapShape` and into `map.md` tickets.

### 6.2 `*.scene.json`

One file per diagram. **There is no `x`, no `y`, no `width`, no `height` field anywhere in this schema.** If Fable finds itself wanting one, the layout pass is missing something — fix that instead.

```jsonc
{
  "form": "spine",                      // one of the six
  "title": "The turn from resource to capacity",
  "caption": "the argument in reading order",   // becomes the plate caption
  "source": "out/metabolism-of-attention/trace.json",

  "nodes": [
    { "id": "n-1", "unit": "u-1", "atom": "stance", "text": "…",
      "slot": "column|margin|inset",     // form-specific placement class
      "rank": { "x": 3, "y": 1 } }       // ordinal only, `field` form only
  ],

  "edges": [
    { "from": "n-2", "to": "n-1", "kind": "answers", "feedback": false }
  ],

  "groups": [
    { "id": "g-1", "label": "Ground", "nodes": ["n-1", "n-2"] }   // → frames
  ]
}
```

### 6.3 The compiler

`npm run compile -- <idea-slug>` turns scenes into `work/<idea-slug>.tldr`.

Four rules:

1. **Deterministic ids.** Derive every tldraw id by hashing the scene node id — `createShapeId(hash(node.id))`. Re-running `/draw` on an edited scene then produces a **diff, not a duplicate set.**
2. **`--preserve-positions` is the default, not a flag.** If the `.tldr` already exists, keep the `x`/`y` of every shape whose id survives; place only new ones. Regeneration must never destroy an arrangement Jordan made by hand. Getting this wrong invalidates the entire premise that he does the judgment.
3. **Use the library's id and index helpers** (`createShapeId`, `createBindingId`, and the fractional-index utilities). Hand-rolled fractional indices are a classic and quiet source of z-order corruption.
4. **Verify record shapes against the installed tldraw version.** The field names in this document are a sketch. The library's own types are the truth. Where they disagree, the library wins — do not force this document's shape onto the API.

---

## 7. Lint

`npm run lint -- <idea-slug>` runs after every compile. Text output with node ids so Claude Code can fix and recompile without seeing anything.

| Check | Fails when |
|---|---|
| `overlap` | two shape bounds intersect |
| `overflow` | text exceeds card bounds at the specified font metrics |
| `bounds` | a shape falls outside the scene's computed extent |
| `orphan` | a node has no edge and no group in a form that requires one |
| `crossings` | edge crossings exceed a threshold scaled to node count |
| `collision` | an edge label overlaps a shape or another label |
| `untyped` | any node missing an `atom` |
| `unfounded` | any unit missing a `span` — see §9 |
| `orphan-gap` | a `GapShape` facing a node that doesn't exist |

Lint is a gate on export, not a warning. A figure that fails lint does not get a plate.

---

## 8. Optional: the vision loop *(M6.5, build last, cut freely)*

Headless render → PNG → Claude Code reads the image back and critiques its own diagram.

- Playwright loads the compiled `.tldr` in the app, exports PNG at 2×, writes to `out/<slug>/_review/`.
- Claude Code reads the PNG and revises the scene, then recompiles.

Honest assessment: lint catches most of what's wrong for a fraction of the complexity, and the real reviewer is Jordan. Build this only if M6.1–M6.4 land and something is still slipping through. It is the first thing to cut.

---

## 9. Encoding the constraint

Jordan's standing ruling is that the machine does not lead — at most dialectic, never initiative. M6 generates things, so the ruling has to become a **testable property** rather than an intention.

Three mechanisms:

1. **Nothing without a span.** Every unit in `trace.json` carries `span`, pointing at real characters in a real context file. `/trace` may not emit a claim that isn't in the pile. Lint's `unfounded` check enforces it. The model can *organize* Jordan's thinking; it cannot add to it.
2. **The review gate is mechanical.** `/draw` reads `trace.json.reviewed`. While it is `false`, `/draw` exits with a message naming the file to review. Jordan sets it to `true` by hand. There is no flag to skip this and none should be added.
3. **`/draw` may not invent.** Every scene node references a `unit` id that exists in the trace. A node with no `unit` is a lint failure.

Provenance is recorded but never rendered: `figures.json` gains `"origin": "generated" | "hand" | "mixed"` for Jordan's own records. **The plate carries no marker.** A generated figure he has reviewed, corrected, and rearranged is his figure. Watermarking his own work would be absurd.

---

## 10. The Trace Test

Jordan runs it. Fable does not sign off on it.

1. Drop an essay plus five or six snippets and tweets into `context/<slug>/`.
2. `/trace` → read `trace.json`. **Is this what the idea actually is?** Correct it. Set `reviewed: true`.
3. `/draw` → three or four scenes across different forms.
4. `npm run compile && npm run lint` → clean.
5. Open the canvas. Rearrange for ten minutes.
6. `⌘E` on the best one.

**Pass condition:** step 2 takes under five minutes to correct, and at least one diagram in step 3 shows him something about the idea he hadn't already seen.

**Fail signal to watch for:** if in step 5 there's nothing worth moving, the forms are producing decoration rather than argument — and the fix is in §5, not in the prompt.

---

## 11. Skills

Two skill files in the repo, following Jordan's existing skill format.

**`/trace`** — reads `context/<slug>/`, emits `out/<slug>/trace.json`.
Instructions must state: use only the four atom types; every unit needs a `span`; do not resolve tensions, only name them; `reviewed` is always written `false`; prose summaries go in the chat reply, never in the file.

**`/draw`** — reads a reviewed `trace.json`, emits `scenes/<slug>/*.scene.json`.
Instructions must state: pick from the kept forms only; one scene per form that genuinely fits, and **skip forms that don't** — three good diagrams beat six dutiful ones; never emit a coordinate; every node references a real `unit`; write the plate caption in sentence case.

---

## 12. Build order

| M | Scope | Gate |
|---|---|---|
| **M6.1** | `trace.json` schema, `/trace` skill, span extraction and validation. ~2 files + skill. | Trace of a real essay reads true, every unit spans back to source. |
| **M6.2** | Scene schema, compiler, deterministic ids, `--preserve-positions`, `spine` layout. ~4 files, ~450 lines. | Compile twice after hand-moving cards — arrangement survives. |
| **M6.3** | Remaining kept forms. `field` and `genealogy` are straightforward; **`mechanism` feedback routing is the hard one.** ~3 files, ~400 lines. | Each form renders legibly at 8 and at 20 nodes. |
| **M6.4** | Lint, export gating, `figures.json` origin field. ~2 files, ~250 lines. | A deliberately overlapping scene fails lint and is refused a plate. |
| **M6.5** | Vision loop. Optional. | Cut unless clearly needed. |

---

## 13. Decisions Fable does not make

1. **Which of the six forms survive.** Jordan cuts before M6.2.
2. Whether `field`'s y-axis is model-declared or always Jordan's.
3. Whether `/trace` may propose tensions Jordan hasn't noticed, or only surface ones stated in the context.
4. Whether generated scenes land in `work/` alongside hand-built canvases or in a separate `work/generated/`.
5. Anything that would add a fifth atom type.

---

## 14. Notes to Fable

- The nearest failure mode is a pipeline that runs cleanly and produces diagrams nobody wants to look at. Legibility at 20 nodes is the bar, not schema correctness.
- Second failure mode: coordinate fields creeping into `scene.json` because one form was awkward to lay out. Fix the layout pass. The schema stays clean.
- Third: `--preserve-positions` treated as a nice-to-have. It is the difference between a drafting tool and a tool that overwrites Jordan's work every time it runs.
- When a form doesn't fit an idea, the correct output is **no diagram**. An empty `scenes/` directory is a valid result and a much better one than six hairballs.
