import {
  DefaultContextMenu,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  useActions,
  useEditor,
  useValue,
} from 'tldraw'
import type { TLUiContextMenuProps } from 'tldraw'
import { currentView } from '../lib/views'
import './context-menu.css'

/**
 * The right-click menu — the second way to reach BUILD.md §11, for the hand
 * rather than the keyboard.
 *
 * Jordan did not build this app and must never have to guess what it does. The
 * `?` overlay prints the whole map at once; this prints the part that applies
 * to what is under the pointer right now, and unlike the overlay it does not
 * describe the commands, it *is* them.
 *
 * Three rules hold it together:
 *
 * 1. **One registry.** Every row calls `actions[id].onSelect('context-menu')`
 *    from `useActions()`, which is the same `TLUiActionItem` the keystroke
 *    fires through `src/tldraw-config.ts`. There is no second copy of the
 *    behaviour here to drift out of step — the corpus wall's reinterpretation
 *    of `1`-`4` (§8) and `B`'s two relations (E17) come along for free,
 *    because the branch lives inside the action.
 * 2. **The shortcut printed is the shortcut bound.** The label is ours, but
 *    the key comes off the registered action, so a rebinding in
 *    `tldraw-config.ts` cannot leave this menu telling Jordan something false.
 *    One exception is annotated at `KEYBOARD_MAP_KBD` below.
 * 3. **Absence is silence, not a crash.** An action deleted from the registry
 *    (the way `RELEASED_ACTION_SHORTCUTS` deletes tldraw's, and E26 is the
 *    warning about what that costs) takes its row with it. A group left with
 *    no rows renders an empty div, which tldraw's own `:empty` rule hides, so
 *    its hairline goes too.
 *
 * `DefaultContextMenu` is wrapped rather than replaced. It owns the Radix
 * mechanics — the trigger around the canvas, the portal into the editor's
 * container, positioning at the pointer, dismissal, the coarse-pointer
 * handling, and holding Escape so it closes the menu instead of dropping the
 * shape's focus. Reimplementing that to own the markup would be trading a
 * correct popup for a styled one. It already provides the menu context
 * (`type: 'context-menu'`, `sourceId: 'context-menu'`) its children need, so
 * nothing here has to.
 *
 * Not registered. Supplement §4.1's slot list keeps `ContextMenu`; wiring this
 * into `components` in `src/tldraw-config.ts` is Jordan's edit, not this
 * file's.
 */

/** One row: a registry id, the label as it should read, the key as it prints. */
interface Row {
  /** An id registered in `src/tldraw-config.ts`, or one of tldraw's own. */
  id: string
  /** Sentence case. The uppercase is a rendering decision, made in CSS. */
  label: string
  /**
   * Only where the registered `kbd` cannot render itself. Left undefined
   * everywhere else so the menu reads the binding rather than restating it.
   */
  kbd?: string
}

interface Group {
  id: string
  rows: Row[]
}

/**
 * E29: `help-overlay` has to be bound as `shift+/`, because a `kbd` string
 * containing `?` is read as tldraw's legacy sigil for alt. That binding is
 * correct and prints as `⇧/`, which is not the key §11 names. `[[…]]` is the
 * literal escape in tldraw's `kbd()` formatter, so this prints the `?` Jordan
 * actually presses. The binding is not touched.
 */
const KEYBOARD_MAP_KBD = '[[?]]'

/**
 * E40, and the second exception, for a different reason worth stating plainly:
 * `back-to-essay` carries no `kbd` at all. Escape cannot be bound through the
 * registry — tldraw's shortcut manager reads the editing state too late, and
 * `src/ui/EscapeRoute.tsx` explains why — so there is no binding here to read,
 * and this row states the key instead of reflecting it. (The literal escape is
 * needed anyway: tldraw's `kbd()` formatter walks a bare key character by
 * character and would print `E S C`.)
 *
 * The row still calls the same action the key calls, which is the guarantee
 * rule 2 is protecting. What it cannot do is prove it from the registry, so it
 * is written down here instead.
 */
const BACK_TO_ESSAY_KBD = '[[Esc]]'

/**
 * The way home, first because leaving is the one thing Jordan cannot work out
 * from what is in front of him. Prepended only when he is on a view — on the
 * essay canvas there is nothing to go back from, and a permanent row saying so
 * would be furniture.
 */
const RETURN: Group = {
  id: 'return',
  rows: [{ id: 'back-to-essay', label: 'Back to essay', kbd: BACK_TO_ESSAY_KBD }],
}

/**
 * With a selection, every row acts on it. The order is §11's: the four atom
 * types and the untype, then the two structural moves, then the write to disk,
 * then the destructive one on its own rule.
 */
const WITH_SELECTION: Group[] = [
  {
    id: 'type',
    rows: [
      { id: 'type-claim', label: 'Type as claim' },
      { id: 'type-move', label: 'Type as move' },
      { id: 'type-figure', label: 'Type as figure' },
      { id: 'type-stance', label: 'Type as stance' },
      { id: 'untype', label: 'Untype' },
    ],
  },
  {
    id: 'structure',
    rows: [
      { id: 'frame-selection', label: 'Frame selection' },
      // The ellipsis is the promise that a click follows: B arms the mode, the
      // next click on the canvas names the other end.
      { id: 'bind-mode', label: 'Bind to…' },
    ],
  },
  {
    id: 'to-disk',
    rows: [{ id: 'export-figure', label: 'Export figure' }],
  },
  {
    // tldraw's own action, id verified in
    // node_modules/tldraw/dist-cjs/lib/ui/context/actions.js. It survives
    // `RELEASED_ACTION_SHORTCUTS`, which releases no destructive key. Alone
    // below a hairline, because nothing else in this menu removes work.
    id: 'destroy',
    rows: [{ id: 'delete', label: 'Delete' }],
  },
]

/**
 * With nothing selected the menu is about the document rather than a shape:
 * make one thing, run the four views and writes, and the way to the map.
 */
const WITHOUT_SELECTION: Group[] = [
  {
    id: 'make',
    rows: [{ id: 'new-ticket', label: 'New ticket' }],
  },
  {
    id: 'work',
    rows: [
      { id: 'readout', label: 'Read out' },
      { id: 'delta-view', label: 'Delta view' },
      { id: 'corpus-wall', label: 'Corpus wall' },
      { id: 'save-tldr', label: 'Save' },
    ],
  },
  {
    id: 'help',
    rows: [{ id: 'help-overlay', label: 'Keyboard map', kbd: KEYBOARD_MAP_KBD }],
  },
]

/**
 * The rows. Mounted only while the menu is open, which is also where the
 * selection subscription belongs: `useValue` recomputes on every selection
 * change, and there is no reason for that to run against the canvas the rest
 * of the time.
 */
function EssayContextMenuContent() {
  const editor = useEditor()
  const actions = useActions()

  // Reactive, not read once. Radix keeps the content mounted for the life of
  // the menu, and a right-click on a shape selects it in the same gesture that
  // opens this, so the first read can land before the selection exists.
  const hasSelection = useValue(
    'context menu has a selection',
    () => editor.getSelectedShapeIds().length > 0,
    [editor]
  )

  // Both selection states get the row, because a right-click on the wall lands
  // on a band and a right-click in the delta lands on a card — being away from
  // the essay is not a fact about what is selected.
  const away = useValue(
    'context menu is away from the essay canvas',
    () => currentView(editor) !== 'essay',
    [editor]
  )

  const base = hasSelection ? WITH_SELECTION : WITHOUT_SELECTION
  const groups = away ? [RETURN, ...base] : base

  return (
    <div className="essay-context-menu">
      {groups.map((group) => (
        <TldrawUiMenuGroup id={group.id} key={group.id}>
          {group.rows.map((row) => {
            const action = actions[row.id]
            // Rule 3: a missing id is a missing row, never a thrown menu.
            if (!action) return null

            return (
              <TldrawUiMenuItem
                key={row.id}
                id={row.id}
                label={row.label}
                kbd={row.kbd ?? action.kbd}
                onSelect={() => {
                  // The source is stated rather than taken from the menu
                  // context so the analytics string cannot drift from the
                  // surface it names. It is the same 'context-menu' the
                  // provider above declares.
                  void action.onSelect('context-menu')
                }}
              />
            )
          })}
        </TldrawUiMenuGroup>
      ))}
    </div>
  )
}

/**
 * The `TLComponents['ContextMenu']` slot. `disabled` is forwarded because it is
 * the host's way of suppressing the menu; the incoming `children` are dropped,
 * since supplying them is the entire point of this component.
 */
export function EssayContextMenu({ disabled }: TLUiContextMenuProps) {
  return (
    <DefaultContextMenu disabled={disabled}>
      <EssayContextMenuContent />
    </DefaultContextMenu>
  )
}
