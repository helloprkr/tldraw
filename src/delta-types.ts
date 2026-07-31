/**
 * Visible absence (BUILD.md §9). Shared by the pure delta logic, the two shapes,
 * and the view.
 */

/** The two fixed frames. Their names are the contract between view and logic. */
export const RECEIVED_FRAME = 'Received'
export const MINE_FRAME = 'Mine'

/** DeltaView lives on its own page so Compose is never disturbed. */
export const DELTA_PAGE = 'Delta'

/** Novel Mine cards are marked with this in the eyebrow. A dingbat, not an icon. */
export const NOVEL_MARK = '※'

export const GAP_LABEL = 'UNANSWERED'

/** Ticket kinds, §6.2. */
export const TICKET_KINDS = ['grill', 'research', 'trial'] as const
export type TicketKind = (typeof TICKET_KINDS)[number]

/**
 * §9's three computed states. Answered and novel are ordinary cards; only
 * unanswered becomes a hole.
 */
export interface DeltaState {
  /** Received cards with an outbound correspondence. */
  answered: string[]
  /** Received cards with none — each of these becomes a GapShape. */
  unanswered: string[]
  /** Mine cards with no inbound correspondence. */
  novel: string[]
}

export function deltaCount(state: DeltaState): number {
  return state.unanswered.length + state.novel.length
}
