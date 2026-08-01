/**
 * Assertions over view routing (E40). Not a test framework — a script that
 * drives `src/lib/views.ts` against a hand-built editor whose store holds the
 * essay canvas and both view pages, proving the way home is found by
 * elimination and that a toggle can only ever return from the view it names.
 *
 * The gap this exists to close: there was no route back. Both view actions
 * opened their page and did nothing when pressed on it, so the corpus wall was
 * a one-way door and refreshing the tab was the exit. The failure it guards
 * against now is subtler and worth stating — a toggle written as "if I am away,
 * go home" reads correctly and is wrong: ⌘⇧C on the delta page would return to
 * the essay instead of crossing to the wall. Every `crossing` case below fails
 * against that version.
 *
 * This is its own suite rather than a case in check-tickets.ts because the two
 * subjects share nothing but their fixture shape, and it is editor-facing
 * rather than pure for the reason stated there: the other suites' worth is that
 * they prove the pure core runs outside a browser (supplement §6.2).
 *
 * Run: npx tsx scripts/check-views.ts
 */

// Declared locally: @types/node is not a dependency of this repo, and the exit
// code is what makes this script usable as a gate.
declare const process: { exit(code: number): never }

let failures = 0

function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    console.log(`PASS  ${label}`)
  } else {
    failures += 1
    console.log(`FAIL  ${label}`)
    console.log(`      expected ${b}`)
    console.log(`      actual   ${a}`)
  }
}

function section(title: string): void {
  console.log(`\n${title}`)
}

/**
 * The slice of the editor `views.ts` touches. `setCurrentPage` records rather
 * than navigates, so a check can assert on where a route *went* as well as on
 * what it returned.
 */
function editorOf(names: string[], current = 0) {
  let currentId = `page:p${current}`
  return {
    getPages: () => names.map((name, i) => ({ id: `page:p${i}`, name })),
    getCurrentPageId: () => currentId,
    setCurrentPage: (id: string) => {
      currentId = id
    },
  }
}

type FakeEditor = ReturnType<typeof editorOf>

/**
 * Imported through a computed specifier rather than a literal one, for the
 * reason check-tickets.ts states: `views.ts` reaches tldraw's types, and
 * tsconfig.scripts.json compiles without the DOM lib and without
 * `skipLibCheck`, so a literal import would put several hundred node_modules
 * errors into `npm run build`.
 */
const VIEWS = '../src/lib/views.ts'
const { VIEW_LABEL, currentView, essayPageId, returnToEssay } = (await import(VIEWS)) as {
  VIEW_LABEL: Record<string, string | null>
  currentView: (editor: FakeEditor) => string
  essayPageId: (editor: FakeEditor) => string | null
  returnToEssay: (editor: FakeEditor) => boolean
}

const ESSAY = 'Page 1'
const DELTA = 'Delta'
const CORPUS = 'Corpus'

/** The store as it stands once both views have been opened once. */
const ALL = [ESSAY, DELTA, CORPUS]

section('currentView — the page names are the contract')
check('the first page is the essay canvas', currentView(editorOf(ALL, 0)), 'essay')
check('Delta', currentView(editorOf(ALL, 1)), 'delta')
check('Corpus', currentView(editorOf(ALL, 2)), 'corpus')
check('a page of any other name is the essay canvas', currentView(editorOf(['Scratch'], 0)), 'essay')
check(
  'and a page named for a prototype key is not mistaken for a view',
  currentView(editorOf(['constructor'], 0)),
  'essay'
)

section('essayPageId — home is found by elimination, not by name')
check('with both views open', essayPageId(editorOf(ALL, 2)), 'page:p0')
check('before either view exists', essayPageId(editorOf([ESSAY], 0)), 'page:p0')
check(
  'even if the views were created first',
  essayPageId(editorOf([DELTA, CORPUS, ESSAY], 0)),
  'page:p2'
)
check('and nothing to return to is null, not a guess', essayPageId(editorOf([DELTA, CORPUS], 0)), null)

section('returnToEssay — the route home')
const fromDelta = editorOf(ALL, 1)
check('from the delta it returns', returnToEssay(fromDelta), true)
check('and lands on the essay canvas', currentView(fromDelta), 'essay')

const fromCorpus = editorOf(ALL, 2)
check('from the wall it returns', returnToEssay(fromCorpus), true)
check('and lands on the essay canvas', currentView(fromCorpus), 'essay')

const atHome = editorOf(ALL, 0)
check('pressed at home it reports nothing to do', returnToEssay(atHome), false)
check('and does not move', currentView(atHome), 'essay')

const orphaned = editorOf([DELTA], 0)
check('with no essay page it refuses rather than navigating anywhere', returnToEssay(orphaned), false)
check('and leaves you where you were', currentView(orphaned), 'delta')

section('the toggles, as tldraw-config.ts spells them')
// The branch under test is `isCorpusPage(editor)` / `isDeltaPage(editor)`, not
// "am I away from the essay". Modelled here so the crossing cases can fail.
function pressDelta(editor: FakeEditor): 'opened delta' | 'returned' {
  if (currentView(editor) === 'delta') {
    returnToEssay(editor)
    return 'returned'
  }
  return 'opened delta'
}

function pressCorpus(editor: FakeEditor): 'opened corpus' | 'returned' {
  if (currentView(editor) === 'corpus') {
    returnToEssay(editor)
    return 'returned'
  }
  return 'opened corpus'
}

check('⌘D on the essay canvas opens the delta', pressDelta(editorOf(ALL, 0)), 'opened delta')
check('⌘D on the delta returns', pressDelta(editorOf(ALL, 1)), 'returned')
check('⌘⇧C on the essay canvas opens the wall', pressCorpus(editorOf(ALL, 0)), 'opened corpus')
check('⌘⇧C on the wall returns', pressCorpus(editorOf(ALL, 2)), 'returned')

section('crossing — a view key never means "go home" on the other view')
check('⌘D on the corpus wall opens the delta', pressDelta(editorOf(ALL, 2)), 'opened delta')
check('⌘⇧C on the delta opens the wall', pressCorpus(editorOf(ALL, 1)), 'opened corpus')

section('the margin strip — home carries no label')
check('essay', VIEW_LABEL.essay, null)
check('delta', VIEW_LABEL.delta, 'Delta view')
check('corpus', VIEW_LABEL.corpus, 'Corpus wall')

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
