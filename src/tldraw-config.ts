import type { Editor, TLComponents, TLUiOverrides } from 'tldraw'
import { HairlineGrid } from './ui/Grid'
import { UnsupportedMarks } from './ui/UnsupportedMarks'
import { startBindMode } from './lib/bind'
import { runReadout } from './lib/runReadout'
import { exportFigure } from './lib/exportFigure'
import { isDeltaPage, openDeltaView } from './lib/deltaView'
import { classifySelectedSegment, isCorpusPage, openCorpusWall } from './lib/corpusWall'
import { createTicket } from './lib/tickets'
import { promptForCaption } from './ui/CaptionDialog'
import { essaySlugFromUrl } from './lib/essayFs'
import { ATOM_BY_KEY } from './types'
import type { AtomType } from './types'
import type { AtomShape } from './shapes/AtomShapeUtil'

/**
 * Slots set to null render nothing. This is BUILD.md §5.5's removal list:
 * the style panel (color here is semantic, never chosen), the share menu, the
 * zoom dropdown, the minimap, and the rest of the default chrome.
 *
 * Kept: Toasts and Dialogs (the export caption prompt and its toast use them),
 * A11y, and ContextMenu.
 */
export const components: TLComponents = {
  Grid: HairlineGrid,
  // Page space, so the marks track their cards through pan, zoom, and drag.
  InFrontOfTheCanvas: UnsupportedMarks,
  StylePanel: null,
  SharePanel: null,
  PageMenu: null,
  NavigationPanel: null,
  ZoomMenu: null,
  Minimap: null,
  MainMenu: null,
  MenuPanel: null,
  ActionsMenu: null,
  QuickActions: null,
  HelpMenu: null,
  DebugPanel: null,
  DebugMenu: null,
  KeyboardShortcutsDialog: null,
  RichTextToolbar: null,
  ImageToolbar: null,
  VideoToolbar: null,
  CursorChatBubble: null,
  HelperButtons: null,
  PeopleMenu: null,
  UserPresenceEditor: null,
  FollowingIndicator: null,
  Toolbar: null,
}

/** Tools kept. Everything else is deleted, which also frees its shortcut key. */
const KEPT_TOOLS = new Set(['select', 'hand'])

/**
 * Default actions whose shortcuts collide with BUILD.md §11. Deleting them frees
 * the key; our own actions claim it in later milestones.
 */
const RELEASED_ACTION_SHORTCUTS = [
  'duplicate', // cmd+d — wanted for the delta view
  'copy-as-png', // cmd+shift+c — wanted for the corpus wall
  'copy-as-json', // cmd+shift+c
  'export-as-svg', // cmd+shift+z
  'export-as-png',
  'export-all-as-svg',
  'export-all-as-png',
  'toggle-dark-mode', // there is no dark mode here
  'toggle-debug-mode',
  'open-kbd-shortcuts', // replaced by the ? overlay
  'insert-media',
  'insert-embed',
  'convert-to-embed',
  'convert-to-bookmark',
  'select-geo-tool',
  'select-zoom-tool',
  'select-fill-fill',
  'select-fill-lined-fill',
  'select-white-color',
  'adjust-shape-styles',
  'print',
]

/**
 * Types every selected card at once — six cards in one keystroke (§7 Stage 3).
 * The pigment rule and eyebrow follow from the prop; the fade is CSS.
 */
function typeSelection(editor: Editor, atom: AtomType) {
  const selected = editor
    .getSelectedShapes()
    .filter((shape): shape is AtomShape => shape.type === 'atom')

  if (selected.length === 0) return

  editor.updateShapes(
    selected.map((shape) => ({ id: shape.id, type: 'atom' as const, props: { atom } }))
  )
}

export const overrides: TLUiOverrides = {
  tools(_editor, tools) {
    for (const id of Object.keys(tools)) {
      if (!KEPT_TOOLS.has(id)) delete tools[id]
    }
    return tools
  },
  actions(editor, actions, helpers) {
    // Writes to disk report in mono, in the toast slot §4.1 keeps for exactly
    // this. Silence after a keystroke that touched the filesystem is worse than
    // a line of type.
    const announce = (title: string) => helpers.addToast({ title, severity: 'info' })

    for (const id of RELEASED_ACTION_SHORTCUTS) {
      delete actions[id]
    }

    // BUILD.md §11 binds F to "frame the selection". tldraw ships that behavior
    // as frame-selection on cmd+alt+g; the f key was the frame *tool*, now gone.
    if (actions['frame-selection']) {
      actions['frame-selection'] = { ...actions['frame-selection'], kbd: 'f' }
    }

    for (const [key, atom] of Object.entries(ATOM_BY_KEY)) {
      const id = atom === 'untyped' ? 'untype' : `type-${atom}`
      actions[id] = {
        id,
        kbd: key,
        label: atom === 'untyped' ? 'Untype selection' : `Type selection as ${atom}`,
        onSelect() {
          // On the wall the same keys record a judgment about someone else's
          // paragraph, and it goes to disk rather than to the canvas (§8).
          if (isCorpusPage(editor)) {
            void classifySelectedSegment(editor, atom === 'untyped' ? null : atom).then(
              (result) => {
                if (result) announce(`${result.slug} · unit ${result.unit + 1} · ${atom}`)
              },
              (err: unknown) => {
                console.error('classify failed', err)
                announce('classify failed')
              }
            )
            return
          }
          typeSelection(editor, atom)
        },
      }
    }

    // B arms the bind mode. Which relation it draws depends on where Jordan is:
    // on Compose an arrow is a dependency, in the delta it is a correspondence.
    // The two must never share a graph (see src/relations.ts).
    actions['bind-mode'] = {
      id: 'bind-mode',
      kbd: 'b',
      label: 'Bind selection to next click',
      onSelect() {
        startBindMode(editor, isDeltaPage(editor) ? 'correspondence' : 'dependency')
      },
    }

    actions['new-ticket'] = {
      id: 'new-ticket',
      kbd: 't',
      label: 'New ticket',
      onSelect() {
        createTicket(editor)
      },
    }

    actions['corpus-wall'] = {
      id: 'corpus-wall',
      kbd: 'cmd+shift+c,ctrl+shift+c',
      label: 'Corpus wall',
      onSelect() {
        void openCorpusWall(editor).catch((err: unknown) => {
          console.error('corpus wall failed', err)
          announce('corpus wall failed')
        })
      },
    }

    actions['delta-view'] = {
      id: 'delta-view',
      kbd: 'cmd+d,ctrl+d',
      label: 'Delta view',
      onSelect() {
        openDeltaView(editor)
      },
    }

    // Stage 7. The caption is authored first, because it names and numbers the
    // figure; cancelling the prompt cancels the export and writes nothing.
    actions['export-figure'] = {
      id: 'export-figure',
      kbd: 'cmd+e,ctrl+e',
      label: 'Export figure from selection',
      async onSelect() {
        const slug = essaySlugFromUrl()
        if (!slug) return
        if (editor.getSelectedShapeIds().length === 0) {
          announce('nothing selected')
          return
        }

        const authored = await promptForCaption(editor, helpers.addDialog)
        if (!authored) return

        try {
          const { number, svgPath } = await exportFigure(
            editor,
            slug,
            authored.caption,
            authored.paragraph
          )
          await navigator.clipboard.writeText(svgPath).catch(() => {
            // A figure that exported but could not reach the clipboard is still
            // a figure; the toast names it either way.
          })
          announce(`fig. ${String(number).padStart(2, '0')} exported`)
        } catch (err: unknown) {
          console.error('export failed', err)
          announce('export failed')
        }
      },
    }

    // Readout writes to disk, so it reports. cmd+r is the browser's reload and
    // tldraw's shortcut manager is the only thing standing between the two.
    actions['readout'] = {
      id: 'readout',
      kbd: 'cmd+r,ctrl+r',
      label: 'Read out to map.md',
      onSelect() {
        const slug = essaySlugFromUrl()
        if (!slug) return
        void runReadout(editor, slug).then(
          () => announce(`map written · ${slug}`),
          (err: unknown) => {
            console.error('readout failed', err)
            announce('readout failed')
          }
        )
      },
    }

    return actions
  },
}
