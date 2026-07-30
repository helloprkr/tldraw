import { Tldraw } from 'tldraw'
import type { Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import './tokens.css'
import './tldraw-overrides.css'
import './app.css'
import { components, overrides } from './tldraw-config'
import { assetUrls } from './assets'
import { essayTheme } from './theme'

const themes = { default: essayTheme }

function handleMount(editor: Editor) {
  // One look, always. There is no dark mode here.
  editor.user.updateUserPreferences({ colorScheme: 'light' })
  if (import.meta.env.DEV) {
    ;(window as unknown as { editor: Editor }).editor = editor
  }
}

export default function App() {
  return (
    <div className="essay-canvas">
      <Tldraw
        components={components}
        overrides={overrides}
        assetUrls={assetUrls}
        themes={themes}
        colorScheme="light"
        onMount={handleMount}
      />
    </div>
  )
}
