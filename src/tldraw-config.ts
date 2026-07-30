import type { TLComponents, TLUiOverrides } from 'tldraw'
import { HairlineGrid } from './ui/Grid'

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

export const overrides: TLUiOverrides = {
  tools(_editor, tools) {
    for (const id of Object.keys(tools)) {
      if (!KEPT_TOOLS.has(id)) delete tools[id]
    }
    return tools
  },
  actions(_editor, actions) {
    for (const id of RELEASED_ACTION_SHORTCUTS) {
      delete actions[id]
    }
    // BUILD.md §11 binds F to "frame the selection". tldraw ships that behavior
    // as frame-selection on cmd+alt+g; the f key was the frame *tool*, now gone.
    if (actions['frame-selection']) {
      actions['frame-selection'] = { ...actions['frame-selection'], kbd: 'f' }
    }
    return actions
  },
}
