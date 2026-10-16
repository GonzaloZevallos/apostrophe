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

import { createContext, useContext, useEffect, useMemo } from 'react'
import type { ParentRecord } from '../routes'

export interface CardRecord extends ParentRecord {
  id: number
}

export const RecordContext = createContext<CardRecord | undefined>(undefined)
export const PublishContext = createContext<(record: CardRecord | undefined) => void>(() => undefined)

/** What a card published, for the arrow. The caller still checks its `id` against the route. */
export function usePublishedCardRecord(): CardRecord | undefined {
  return useContext(RecordContext)
}

/**
 * Publishes `record` while the card is mounted with it; clears it when the card unmounts or the
 * record changes (another variety, an archived flag that flipped), so it never outlives its card.
 */
export function useCardRecord(record: CardRecord | undefined): void {
  const publish = useContext(PublishContext)
  const id = record?.id
  const archived = record?.archived
  const name = record?.name
  const stable = useMemo<CardRecord | undefined>(
    () => (id === undefined || archived === undefined || name === undefined ? undefined : { id, archived, name }),
    [id, archived, name],
  )
  useEffect(() => {
    publish(stable)
    return () => publish(undefined)
  }, [publish, stable])
}
