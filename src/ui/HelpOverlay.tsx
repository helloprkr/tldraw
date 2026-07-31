import { useEffect } from 'react'
import { TldrawUiDialogTitle } from 'tldraw'
import type { Editor, TLUiDialogProps } from 'tldraw'
import type { AddDialog } from './CaptionDialog'
import './help-overlay.css'

/**
 * The `?` overlay (BUILD.md §11) — the keyboard map, set in mono.
 *
 * It documents what shipped, not what §11's table proposed. Where the two
 * differ the difference is printed here rather than reconciled silently: the
 * typing keys do something else on the corpus wall, and `B` draws a different
 * relation depending on which view is open (E17). A map that describes a canvas
 * Jordan is not looking at is worse than no map.
 *
 * §2.2 permits a shadow on a modal and nothing else, so this is the one place
 * besides the caption prompt that lifts off the paper. Everything else is the
 * same printer's furniture as the canvas: hairline rules, 2px radius, mono
 * uppercase labels, no fill but `--bg-2`.
 */

interface Binding {
  /** As it is pressed, not as it is bound — `?`, not `shift+/`. */
  keys: string
  action: string
  /** Printed under the row when the behavior is not what §11's table implies. */
  note?: string
}

interface Section {
  title: string
  bindings: Binding[]
}

/**
 * Every binding the app registers, grouped by what it is for. Kept beside
 * `tldraw-config.ts` in review: an action added there without a row here is a
 * key Jordan has no way to discover.
 */
const SECTIONS: Section[] = [
  {
    title: 'Type the atoms',
    bindings: [
      { keys: '1', action: 'Claim' },
      { keys: '2', action: 'Move' },
      { keys: '3', action: 'Figure' },
      { keys: '4', action: 'Stance' },
      { keys: '0', action: 'Untype' },
    ],
  },
  {
    title: 'Structure',
    bindings: [
      { keys: 'F', action: 'Frame the selection' },
      {
        keys: 'B',
        action: 'Bind: selection, then click',
        note: 'Dependency on the essay, correspondence in the delta',
      },
      { keys: 'T', action: 'New ticket' },
    ],
  },
  {
    title: 'Views',
    bindings: [
      { keys: '⌘D', action: 'Delta view' },
      {
        keys: '⌘⇧C',
        action: 'Corpus wall',
        note: 'There 1-4 and 0 classify the selected segment, and write to disk',
      },
    ],
  },
  {
    title: 'To disk',
    bindings: [
      { keys: '⌘E', action: 'Export figure from selection' },
      { keys: '⌘R', action: 'Read out to map.md' },
      { keys: '⌘S', action: 'Save the snapshot' },
    ],
  },
  {
    title: "tldraw's own",
    bindings: [
      { keys: 'Space-drag', action: 'Pan' },
      { keys: 'Scroll', action: 'Zoom' },
      { keys: '⌘Z', action: 'Undo' },
    ],
  },
]

export function HelpOverlay({ onClose }: TLUiDialogProps) {
  // Escape is Radix's, but `?` is ours: the key that opened this has to be the
  // key that closes it. While a dialog is open tldraw's shortcut manager is
  // disabled, so the registered action cannot toggle it shut from out there.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '?' || event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="help-overlay">
      <TldrawUiDialogTitle className="help-overlay__title">
        <span>Keyboard</span>
      </TldrawUiDialogTitle>

      <div className="help-overlay__columns">
        {SECTIONS.map((section) => (
          <section className="help-overlay__section" key={section.title}>
            <h3 className="help-overlay__section-title">{section.title}</h3>
            <dl className="help-overlay__list">
              {section.bindings.map((binding) => (
                <div className="help-overlay__row" key={binding.keys}>
                  <dt className="help-overlay__keys">{binding.keys}</dt>
                  <dd className="help-overlay__action">
                    {binding.action}
                    {binding.note && (
                      <span className="help-overlay__note">{binding.note}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div className="help-overlay__footer">
        <span>Position means something: left is concrete, top is first</span>
        <span className="help-overlay__dismiss">? or esc to close</span>
      </div>
    </div>
  )
}

/** Open once. A second `?` while it is up closes it rather than stacking a second sheet. */
let isOpen = false

/**
 * Opens the map. Refuses while a shape is being edited — `?` is a character
 * there, and BUILD.md's own rule is that typing into a card must never be
 * interrupted by chrome.
 *
 * tldraw's shortcut manager already suppresses every shortcut while
 * `getEditingShapeId()` is set, so this is belt and braces; the guarantee is
 * worth stating locally rather than inheriting it from a library's internals.
 */
export function openHelpOverlay(editor: Editor, addDialog: AddDialog): void {
  if (isOpen) return
  if (editor.getEditingShapeId() !== null) return

  isOpen = true
  addDialog({
    onClose: () => {
      isOpen = false
      // The canvas takes the keyboard back, or the next keystroke lands nowhere.
      editor.focus()
    },
    component: (props) => <HelpOverlay {...props} />,
  })
}
