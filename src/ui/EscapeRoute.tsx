import { useEffect } from 'react'
import { useActions, useEditor } from 'tldraw'

/**
 * Escape, as the third route home (E40).
 *
 * **Why this is not a `kbd` on the action.** Binding `esc` in
 * `tldraw-config.ts` is one line and it is wrong, in a way that only shows up
 * at runtime. tldraw's shortcut manager listens on `document.body` in the
 * bubble phase and refuses to fire while a shape is being edited
 * (`getEditingShapeId()`); the editor's own state machine listens on the
 * *container*, which is a descendant of the body, so the container's handler
 * has already ended the edit by the time the body's handler asks whether an
 * edit is in progress. Measured: with a card in edit mode on the delta page,
 * one Escape both closed the editor and jumped to the essay canvas — losing the
 * keystroke Jordan pressed to stop typing.
 *
 * So the listener runs in the **capture** phase on the container's document,
 * where the answer to "was something open when this key went down" is still the
 * truth. Everything the spec excludes falls out of reading that state early:
 *
 * - **A menu, a dialog, the `?` overlay** — `menus.hasAnyOpenMenus()`. tldraw
 *   registers dialogs there as well as menus, so the caption prompt and the
 *   keyboard map are covered by the same question.
 * - **A card being typed into** — `getEditingShapeId()`, read before the state
 *   machine clears it. The text-field check behind it catches the frame-rename
 *   input and anything else that owns the caret.
 * - **An armed bind** — nothing here, and deliberately: `bind.ts` listens on
 *   `window` in the capture phase and stops propagation, and window capture
 *   runs before document capture. Cancelling a bind can never also navigate.
 *
 * The event is left alone — neither prevented nor stopped — so Escape keeps
 * doing its ordinary work on the way past.
 *
 * It calls the registered action rather than `returnToEssay`, so the key and
 * the context menu's row are one implementation, which is the rule §11's
 * registry exists to keep.
 */

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function EscapeRoute() {
  const editor = useEditor()
  const actions = useActions()

  useEffect(() => {
    // `getContainerDocument()` is the same document and reads better, but it is
    // not on tldraw's public `Editor` type; the container's own is.
    const doc = editor.getContainer().ownerDocument

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || event.repeat || event.isComposing) return
      // Held to the same condition as every other key in this app: the canvas
      // has the keyboard, or the keystroke is not ours to read.
      if (!editor.getInstanceState().isFocused) return
      if (editor.menus.hasAnyOpenMenus()) return
      if (editor.getEditingShapeId() !== null) return
      if (isTextField(event.target)) return

      // Absent only if the registry ever drops it, which is the context menu's
      // rule 3 applied to a key: a missing action is silence, not a crash.
      actions['back-to-essay']?.onSelect('kbd')
    }

    doc.addEventListener('keydown', onKeyDown, true)
    return () => doc.removeEventListener('keydown', onKeyDown, true)
  }, [editor, actions])

  return null
}
