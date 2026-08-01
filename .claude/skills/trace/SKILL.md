---
name: trace
description: Read a pile of context in context/<slug>/ and emit out/<slug>/trace.json — the structural trace of an idea, in atoms, with every claim spanning back to its source. Use when Jordan asks to trace an idea, or points at a context folder. M6_GENERATIVE.md §6.1, §9, §11.
---

# /trace — from pile to structure

You are given `context/<slug>/` — an essay, snippets, tweets, notes, mixed and
messy. Your job is to trace the idea's structure into `out/<slug>/trace.json`.
Structure only. No pictures, no positions, no visual language of any kind.

**The governing line: the model handles meaning, code handles precision.** You
decide what the idea is. You never compute a character offset — you write
verbatim quotes and let `npm run trace -- --resolve <slug>` mint the offsets.

## Procedure

1. Read every file in `context/<slug>/`. If the folder is missing or empty,
   say so and stop — a trace cannot be made from nothing.
2. Write `out/<slug>/trace.json` in the schema below.
3. Run `npm run trace -- --resolve <slug>`. Fix any quote it reports as
   missing or ambiguous (lengthen ambiguous quotes until unique) and re-run
   until it prints `TRACE OK`.
4. In the chat reply — never in the file — give Jordan a short prose summary
   of what you traced, and name the file for him to review. He corrects it and
   sets `reviewed: true` by hand. You never set it.

## Hard rules

- **Four atom types only**: `claim`, `move`, `figure`, `stance` (BUILD.md
  §5.2). There is no fifth type and no free-text tag. If a unit fits nothing,
  it is probably not a unit.
- **Every unit carries a span.** `span.quote` is a verbatim excerpt (≥ 8
  chars, long enough to be unique in its file) from a real context file. You
  may not emit a claim that is not in the pile. You can organize Jordan's
  thinking; you cannot add to it.
- **Do not resolve tensions — name them.** A tension is two units that cannot
  both hold, plus a note saying why. Deciding which one wins is Jordan's work.
  A tension you noticed rather than one stated in the context is allowed, but
  mark it `"proposed": true` (E41.3).
- **`reviewed` is always written `false`.** No exceptions, no flags.
- **`holder`** is `"received"` or `"mine"` only when the idea genuinely has an
  interlocutor (it drives the delta form). Otherwise `null` — never a guess.
- **`abstraction`** is an ordinal `1..n`, concrete low, abstract high — a
  rank, never a pixel. `null` if ranking the unit makes no sense.
- **Prose summaries go in the chat reply, never in the file.**

## Schema

```jsonc
{
  "idea": "One sentence: what the idea actually is.",
  "slug": "<slug>",                        // must match the folder name
  "reviewed": false,                       // always false from /trace
  "generated": "2026-07-31T00:00:00Z",     // date -u +%Y-%m-%dT%H:%M:%SZ

  "sources": [
    { "id": "s-1", "kind": "essay",        // essay | snippet | tweet | note
      "file": "context/<slug>/essay.md",   // repo-relative, under context/<slug>/
      "cite": "Author, Title, Year" }
  ],

  "units": [
    { "id": "u-1",
      "atom": "stance",                    // claim | move | figure | stance
      "text": "The unit, in your words — a compression of the quote, not an addition to it.",
      "holder": null,                      // received | mine | null
      "span": { "source": "s-1", "start": -1, "end": -1,
                "quote": "the verbatim characters this unit points at" },
      "abstraction": 3 }
  ],

  "relations": [
    { "from": "u-2", "to": "u-1", "kind": "answers" }   // answers|supports|counters|derives|feeds
  ],

  "tensions": [
    { "between": ["u-1", "u-4"], "note": "both cannot hold if X", "proposed": true }
  ],

  "gaps": [
    { "facing": "u-1", "label": "what is absent, named" }
  ]
}
```

Write `start: -1, end: -1` — the resolver fills them. Serialize with two-space
indent and a trailing newline (the house serializer's format).
