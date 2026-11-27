/**
 * The one shape of `GET /pinned-catalog` and the one fetcher for it. Publish and Probarlo
 * answer the same shape (`PinnedCatalogOut`, `app/pinned_catalog/adapters/schemas.py`), so
 * no screen or hook declares its own copy of these types or calls the endpoint by hand.
 */

import { get } from './client'
import type { PinReason } from './refusals'

export interface PinStatus {
  state: 'up_to_date' | 'out_of_date'
  reason: PinReason | null
  last_published_on: string | null
}

export type PublishBlockedBy = 'not_tested' | 'channel_missing'

export interface PinnedCatalog {
  token_saved_on: string | null
  own_chat: string | null
  channel_chat: string | null
  can_publish: boolean
  publish_blocked_by: PublishBlockedBy | null
  status: PinStatus | null
}

/** The three fields the bot settings form is seeded from and saves. */
export type PinnedCatalogSettings = Pick<
  PinnedCatalog,
  'token_saved_on' | 'own_chat' | 'channel_chat'
>

export const readPinnedCatalog = (): Promise<PinnedCatalog> =>
  get<PinnedCatalog>('/pinned-catalog')
