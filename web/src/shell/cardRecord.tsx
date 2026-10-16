/**
 * The record a card shows, published for the shell's back arrow. A parent varies only by its
 * record (an archived variety's page goes back to Archivadas, a variety's "Ver todas" list to
 * the variety by name), matched on the route's `:id`, never by how the screen was reached. The
 * shell draws the arrow and the card knows the record, so the card hands it up here: the
 * `Shell` mounts one `CardRecordProvider` around its column, a card calls `useCardRecord` once
 * its data is loaded, and `BackArrow` reads what is published.
 *
 * It holds only what the page already shows (an id, whether it is archived, a name), in memory:
 * nothing goes to storage or to history state. A card that is loading, failed or gone publishes
 * nothing, and the arrow then falls back to the registry's static parent.
 */

import { useState, type ReactNode } from 'react'
import { PublishContext, RecordContext, type CardRecord } from './useCardRecord'

export function CardRecordProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<CardRecord | undefined>(undefined)
  return (
    <PublishContext.Provider value={setRecord}>
      <RecordContext.Provider value={record}>{children}</RecordContext.Provider>
    </PublishContext.Provider>
  )
}
