---
name: draw
description: Read a reviewed trace in out/<slug>/trace.json and emit scenes/<slug>/*.scene.json — diagram scenes in the closed six-form vocabulary, no coordinates, every node grounded in a trace unit. Use when Jordan asks to draw an idea, or after he has reviewed a trace. M6_GENERATIVE.md §5, §6.2, §9, §11.
---

# /draw — from structure to scenes

You are given a reviewed `out/<slug>/trace.json`. Your job is to pick the
forms that fit the idea and fill them, one `scenes/<slug>/NN-<form>.scene.json`
per diagram. The compiler does everything spatial.

**The governing line: the model handles meaning, code handles precision.** You
pick and fill forms; you never emit a coordinate, never mint an id, never
write a `.tldr`.

## The gate, before anything else

Read the trace. **If `reviewed` is `false`, stop** and reply naming the file:
Jordan has not read this trace, and nothing reaches a canvas he has not read.
There is no flag to skip this and you must not add one. (The compiler enforces
the same gate; your stopping here just saves the round trip.)

## Procedure

1. Read `out/<slug>/trace.json`.
2. Choose forms. **One scene per form that genuinely fits — and skip forms
   that don't.** Three good diagrams beat six dutiful ones; an empty
   `scenes/` directory is a valid result and better than a hairball. Guidance:
   - `spine` — the argument in order. The default; when in doubt, this one.
     Never for genuine branching (that is a `genealogy`).
   - `delta` — received vs. mine. Only when units carry `holder` values; with
     no interlocutor this form manufactures a strawman.
   - `field` — positioning on two axes. x is always abstraction (from the
     units' `abstraction` ranks); you declare the y-axis and label its poles.
     Not for more than about fifteen items.
   - `genealogy` — where it came from. Needs several sources feeding a
     synthesis; one source is an arrow, not a diagram.
   - `mechanism` — process, cycle, feedback. Only when there is a real loop;
     a sequence with no loop is a spine lying down.
   - `band` — compositional rhythm. Only worth it against the corpus wall.
3. Write each scene per the schema below. File name: `NN-<form>.scene.json`
   (`01-spine.scene.json`, …) — the name is the scene's stable identity, so
   never rename an existing scene file when revising it.
4. Run `npm run compile -- <slug>`, then `npm run lint -- <slug>`. Fix what
   lint names (it speaks in node ids) and recompile until clean.
5. Reply with one line per scene: form, title, and why that form fits. Skip
   commentary on forms you skipped unless Jordan asks.

## Hard rules

- **Never emit a coordinate.** No `x`, `y`, `w`, `h`, width, height — the
  validator refuses them anywhere in a scene. If a form seems to need one,
  the layout pass is missing something; say so instead of working around it.
- **Every node references a real `unit` id from the trace** (§9.3). A node
  with no unit is a lint failure. `atom` must match the unit's atom.
- **Write the plate caption in sentence case.**
- Node `text` may compress the unit's text to card length, but must not add
  claims the unit does not make.
- `slot` per form: spine `column|margin|inset` (claims in the column, moves
  in the margin, figures as insets); delta `received|mine`; all others `null`.
- `rank` only in a `field` scene: ordinal `{x, y}`, both `1..n`. x from the
  trace's `abstraction` ordering, y from the axis you declared.
- Edges use the trace's relation kinds. `feedback: true` only in `mechanism`.
- Groups become section frames; label them like sections, sentence case.

## Schema

```jsonc
{
  "form": "spine",
  "title": "The turn from resource to capacity",   // becomes the page name
  "caption": "the argument in reading order",      // plate caption, sentence case
  "source": "out/<slug>/trace.json",

  "nodes": [
    { "id": "n-1", "unit": "u-1", "atom": "stance",
      "text": "…", "slot": "column", "rank": null }
  ],
  "edges": [
    { "from": "n-2", "to": "n-1", "kind": "answers", "feedback": false }
  ],
  "groups": [
    { "id": "g-1", "label": "Ground", "nodes": ["n-1", "n-2"] }
  ]
}
```

Serialize with two-space indent and a trailing newline.
