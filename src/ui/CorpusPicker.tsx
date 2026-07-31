import { useEffect } from 'react'
import { useEditor, useValue } from 'tldraw'
import { clearPickedSegment, isCorpusPage, pickSegment, pickedSegment } from '../lib/corpusWall'

/**
 * §8: "Clicking a segment scrolls the source text into a margin panel", and the
 * same click is what `1`-`4` then classifies.
 *
 * Segments are not shapes — a band is one shape so the wall exports as one
 * figure — so the pick is resolved from the pointer against the band's own
 * geometry. Listening on the container in the capture phase keeps tldraw's
 * normal selection behaviour intact: the click still selects the band, it just
 * also records which paragraph it landed on.
 */
export function CorpusPicker() {
  const editor = useEditor()
  const onCorpus = useValue('on corpus page', () => isCorpusPage(editor), [editor])

  useEffect(() => {
    if (!onCorpus) {
      clearPickedSegment()
      return
    }

    const container = editor.getContainer()

    function onPointerDown(event: PointerEvent) {
      const page = editor.screenToPage({ x: event.clientX, y: event.clientY })
      const shape = editor.getShapeAtPoint(page, {
        hitInside: true,
        filter: (s) => s.type === 'band',
      })
      if (!shape) {
        clearPickedSegment()
        return
      }
      pickSegment(editor, shape, page)
    }

    container.addEventListener('pointerdown', onPointerDown, true)
    return () => container.removeEventListener('pointerdown', onPointerDown, true)
  }, [editor, onCorpus])

  return null
}

/** The clicked paragraph, in the margin. Mono label, body serif text (§8). */
export function CorpusMargin({ text }: { text: string }) {
  const picked = useValue('picked segment', () => pickedSegment.get(), [])
  if (!picked || text === '') return null

  return (
    <div className="corpus-margin" aria-live="polite">
      <div className="corpus-margin__label">
        {picked.slug} · unit {picked.index + 1}
      </div>
      <p className="corpus-margin__text">{text}</p>
    </div>
  )
}
