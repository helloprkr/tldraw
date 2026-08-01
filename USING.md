# USING.md — a plain-English guide to essay-canvas

This is the owner's manual. BUILD.md says what the app is for the people who built it; this says what it is for the person using it.

## What this app is

A desk for arranging the pieces of an essay before you write it. You drop rough fragments of thinking into a folder; the app turns each one into a card on an infinite sheet of cream paper; you spend twenty minutes physically arranging them; the app turns your arrangement back into a written outline. Moving a card *is* editing the essay. That's the entire trick.

One rule gives the desk its meaning — **where a card sits says something**:

- **Up and down is reading order.** The card at the top is the first thing the reader meets.
- **Left and right is altitude.** Concrete things (stories, examples, particulars) on the left; abstract things (principles, theories) on the right.

Nothing enforces this. It's a convention, like writing on the lines of ruled paper.

## The three surfaces

The app is one document with three pages. You move between them with keys; each is a different way of looking at the same essay.

**Getting back is always the same three moves**, so you can never be stranded: press the key that got you there a second time, press `Esc`, or right-click and take the top row. When you're not on the essay canvas the top-left margin says so, and says `ESC RETURNS`. The essay canvas itself carries no label — home needs no sign.

**1. The essay canvas** — where you start and where you mostly live. Cards, sections, arrows. This is the desk.

**2. The delta view (⌘D, again to return)** — an argument checker. Two columns: *Received* (the position you're arguing against, as cards) and *Mine* (your material). You draw a line from your card to the received card it answers. Anything on their side you haven't answered turns into a dashed terracotta hole — a visibly missing tooth. The holes automatically become a to-do list in your outline.

**3. The corpus wall (⌘⇧C, again to return)** — a rhythm x-ray of finished essays. Each horizontal band is one whole essay, read left to right, start to finish. Each colored block is one passage, wide when the passage is long, colored by what the passage *does* (see the four types below). The word-strip above each band spells the same sequence out. Three bands are writers being studied; the band below the double rule is yours. The point: you can see that one writer opens on imagery and another on assertion without reading a word. Hatched grey blocks are passages nobody has classified yet — click one, press 1–4, and your judgment is saved to disk.

## The four kinds of card

Every card eventually gets typed as one of four moves an essayist makes. The color never decorates — it always means this:

| Type | Color | In plain terms |
|---|---|---|
| **Claim** | oxblood (dark red) | An assertion. Something you're saying is true. |
| **Move** | ochre (gold) | Something you do *to the reader* — concede a point, pivot, raise the stakes. |
| **Figure** | lapis (blue) | An image, example, metaphor — the concrete thing that makes it land. |
| **Stance** | moss (green) | Where you stand. The position underneath the claims. |

And one color is reserved: **terracotta always means something is missing** — an open question, an unanswered point. When the terracotta is gone, the essay is ready. That's the only progress bar.

## A session, start to finish

1. **Capture elsewhere.** Write fragments wherever you write. When a pile of them wants to be an essay, make a folder: `inputs/my-essay-name/`. Each fragment is a `.md` file — or paste everything into one `notes.md` with `---` between thoughts.
2. **Spread.** `npm run spread -- my-essay-name` — the browser opens with every fragment as a card in a loose grid. (Re-running later adds only *new* fragments, parked to the left; it never touches cards you've placed.)
3. **Arrange.** Drag cards into clusters. Reading order top to bottom. Select a cluster, press `F`, name the frame — that's a section of the essay, and its name becomes a heading.
4. **Type.** Select cards, press `1`–`4` to say what each is. The counter bottom-left tells you how many remain untyped.
5. **Bind.** Select a card, press `B`, click the card it depends on. If you ever place a card *above* something it depends on, it gets a terracotta underline — the canvas telling you your reading order is broken before you've written a word.
6. **Read out.** `⌘R` writes `out/my-essay-name/map.md` — a real outline, in order, with your section headings, plus every open question as a checkbox. Write the essay from it, in whatever editor you write in.
7. **Park questions.** Press `T` any time to drop a terracotta ticket ("what does this cost us?"). They follow you into the outline; deleting one when it's answered is how the canvas gets quieter.
8. **Export the figure.** Select the cards that are the argument's spine, press `⌘E`, write a caption. You get a print-ready figure — cream paper, numbered `FIG. N`, captioned in type that's already yours — as SVG and PNG in `out/my-essay-name/figures/`. It goes in the published essay with no styling work.
9. **Save.** It autosaves every 30 seconds. `npm run save -- my-essay-name` stages everything; you commit. Git keeps the history of how the essay's *structure* changed, not just its words.

## When you're lost

- **Right-click** anywhere — everything you can do here, with its key, in context.
- **`?`** — the full keyboard map (also written as `? KEYS` bottom-left, always).
- **`Esc`** — from the delta or the corpus wall, returns you to the essay canvas. (When something is open — a menu, the keyboard map, a card you're typing into — it closes that first, and the *next* `Esc` takes you home.)
- **`⌘Z`** undoes one step. **Space-drag** pans. **Scroll** zooms.
- **Double-click empty paper** — a marginalia note. It never enters the outline; it's for talking to yourself.

## What the app will never do

It never moves a card you placed. It never writes into `inputs/` (your fragments are read-only to it). It never guesses a card's type. It never commits to git. It never talks to the internet. Everything it produces is a plain file on your disk, in `out/` and `work/`, yours to version and publish.
