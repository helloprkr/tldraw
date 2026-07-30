import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { TldrawUiDialogTitle } from 'tldraw'
import type { FormEvent } from 'react'
import type { Editor, TLUiDialogProps, TLUiDialogsContextType } from 'tldraw'
import './caption-dialog.css'

/**
 * The `⌘E` caption prompt (BUILD.md §10). Export cannot name or number a figure
 * until Jordan has named it, so this runs first and the export waits on it.
 *
 * The caption is typed sentence-cased and stored exactly as typed; the plate
 * sets it uppercase at render. Case is a rendering decision, not a data one —
 * uppercasing here would lose the original and make the record unreadable.
 */

/** What the prompt returns. Shapes to `FigureRecord`'s caption and paragraph. */
export interface FigureCaption {
  caption: string
  /** The colophon's `JWP ¶ 26`, or null when Jordan gave no reference. */
  paragraph: string | null
}

/**
 * The dialogs context is React-only; there is no way to reach `addDialog` from a
 * bare `Editor`. The `⌘E` action gets it as `helpers.addDialog` at the exact
 * call site that opens this, the way `helpers.addToast` is already used.
 */
export type AddDialog = TLUiDialogsContextType['addDialog']

interface CaptionDialogProps extends TLUiDialogProps {
  onCommit(result: FigureCaption): void
}

/** `¶ 26`, `26`, ` 26 ` all mean the same reference. Store the bare mark. */
function normalizeParagraph(raw: string): string | null {
  const mark = raw.replace(/^[¶\s]+/, '').trim()
  return mark.length > 0 ? mark : null
}

export function CaptionDialog({ onClose, onCommit }: CaptionDialogProps) {
  const titleId = useId()
  const paragraphId = useId()
  const captionField = useRef<HTMLInputElement>(null)
  const [caption, setCaption] = useState('')
  const [paragraph, setParagraph] = useState('')

  // Radix claims focus for the modal itself on mount; take it back on the next
  // frame so the caret is already in the field. A prompt that has to be clicked
  // into is not keyboard-first.
  useEffect(() => {
    const frame = requestAnimationFrame(() => captionField.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  const written = caption.trim()

  // An empty caption is refused rather than defaulted. The plate reads
  // `FIG. 3 — <CAPTION>` and the file is named `fig-03-<slug>.svg`; with nothing
  // typed both degrade, and an unnamed figure is not a book plate.
  const ready = written.length > 0

  const commit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!ready) return
      onCommit({ caption: written, paragraph: normalizeParagraph(paragraph) })
      onClose()
    },
    [ready, written, paragraph, onCommit, onClose]
  )

  return (
    <form className="caption-dialog" onSubmit={commit}>
      <TldrawUiDialogTitle className="caption-dialog__title">
        <span id={titleId}>Figure caption</span>
      </TldrawUiDialogTitle>

      <input
        ref={captionField}
        className="caption-dialog__input"
        type="text"
        value={caption}
        onChange={(event) => setCaption(event.currentTarget.value)}
        aria-labelledby={titleId}
        placeholder="The delta between received and mine"
        autoComplete="off"
        spellCheck
      />

      <div className="caption-dialog__row">
        <span className="caption-dialog__hint">
          Sentence case — the plate sets it uppercase
        </span>

        {/* The paragraph reference lives in the margin of the form because it
            lives in the margin of the plate: colophon only, and optional. */}
        <span className="caption-dialog__aside">
          <label className="caption-dialog__label" htmlFor={paragraphId}>
            ¶
          </label>
          <input
            id={paragraphId}
            className="caption-dialog__aside-input"
            type="text"
            value={paragraph}
            onChange={(event) => setParagraph(event.currentTarget.value)}
            aria-label="Paragraph reference, optional"
            placeholder="26"
            autoComplete="off"
            spellCheck={false}
          />
        </span>
      </div>

      <div className="caption-dialog__footer">
        <button type="button" className="caption-dialog__action" onClick={onClose}>
          Cancel
          <kbd className="caption-dialog__key">esc</kbd>
        </button>
        <button
          type="submit"
          className="caption-dialog__action caption-dialog__action--commit"
          disabled={!ready}
        >
          Set caption
          <kbd className="caption-dialog__key">return</kbd>
        </button>
      </div>
    </form>
  )
}

/**
 * Opens the prompt and resolves with what Jordan typed, or `null` if he backed
 * out. The export awaits this and aborts on `null`.
 *
 * Every close path — Escape, the cancel button, `clearDialogs` — runs through
 * the dialog's own `onClose`, so cancellation cannot be missed. Submitting
 * settles first and the close that follows is a no-op.
 */
export function promptForCaption(
  editor: Editor,
  addDialog: AddDialog
): Promise<FigureCaption | null> {
  return new Promise((resolve) => {
    let settled = false

    function settle(result: FigureCaption | null) {
      if (settled) return
      settled = true
      // The canvas gets the keyboard back before the caller does anything with
      // the answer; otherwise the next keystroke lands nowhere.
      editor.focus()
      resolve(result)
    }

    addDialog({
      onClose: () => settle(null),
      // A stray click on the canvas behind the prompt must not discard a typed
      // caption — the canvas is the thing being captioned.
      preventBackgroundClose: true,
      component: (props) => <CaptionDialog {...props} onCommit={settle} />,
    })
  })
}

if (import.meta.env.DEV) {
  Object.assign(window, { captionPrompt: { promptForCaption, CaptionDialog } })
}
