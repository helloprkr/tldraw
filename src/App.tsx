import { Tldraw } from 'tldraw'
import type { Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import './tokens.css'
import './tldraw-overrides.css'
import './app.css'
import './shapes/atom.css'
import { components, overrides } from './tldraw-config'
import { assetUrls } from './assets'
import { essayTheme } from './theme'
import './shapes/plate.css'
import './shapes/ticket.css'
import './shapes/gap.css'
import { AtomShapeUtil } from './shapes/AtomShapeUtil'
import { DependencyArrowUtil } from './shapes/DependencyArrowUtil'
import { PlateShapeUtil } from './shapes/PlateShapeUtil'
import { TicketShapeUtil } from './shapes/TicketShapeUtil'
import { GapShapeUtil } from './shapes/GapShapeUtil'
import { Counter } from './ui/Counter'
import { DeltaCounter } from './ui/DeltaCounter'
import { essaySlugFromUrl } from './lib/essayFs'
import { openEssay, startAutosave } from './lib/openEssay'
import { shapeVisibility } from './lib/deltaView'

const themes = { default: essayTheme }
// DependencyArrowUtil replaces tldraw's arrow rather than adding a type, so the
// override reaches the canvas and the export from one place.
const shapeUtils = [
  AtomShapeUtil,
  TicketShapeUtil,
  GapShapeUtil,
  PlateShapeUtil,
  DependencyArrowUtil,
]

function handleMount(editor: Editor) {
  // One look, always. There is no dark mode here.
  editor.user.updateUserPreferences({ colorScheme: 'light' })
  if (import.meta.env.DEV) {
    ;(window as unknown as { editor: Editor }).editor = editor
  }

  const slug = essaySlugFromUrl()
  if (!slug) return undefined

  document.title = `${slug} — essay-canvas`

  // Nothing may be written back until the essay is fully on the canvas. Until
  // then the store is empty, and an autosave would overwrite the file it is
  // about to read.
  let ready = false
  void openEssay(editor, slug)
    .then(() => {
      ready = true
    })
    .catch((err: unknown) => {
      console.error(`could not open essay ${slug}`, err)
    })

  return startAutosave(editor, slug, () => ready)
}

export default function App() {
  return (
    <div className="essay-canvas">
      <Tldraw
        shapeUtils={shapeUtils}
        components={components}
        overrides={overrides}
        assetUrls={assetUrls}
        themes={themes}
        colorScheme="light"
        onMount={handleMount}
        getShapeVisibility={shapeVisibility}
      >
        <Counter />
        <DeltaCounter />
      </Tldraw>
    </div>
  )
}
