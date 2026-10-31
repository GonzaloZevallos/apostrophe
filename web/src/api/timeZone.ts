/**
 * `GET`/`PUT /business/time-zone`: the business's stored zone, the names it may pick from and the
 * API's own instant for the preview (the front never reads a clock). A save writes the answered
 * `today` into the `me` cache first, then invalidates everything, because every screen that shows a
 * day is now stale (docs/adr/0057).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, put } from './client'
import { keys } from './keys'
import type { Me } from './me'

export interface TimeZoneSettings {
  time_zone: string
  time_zones: readonly string[]
  /** Aligned with `time_zones`: each zone's UTC offset in minutes at `now_epoch_ms`, `null` if unloadable. */
  utc_offsets_minutes: readonly (number | null)[]
  now_epoch_ms: number
}

interface TimeZoneSaved {
  time_zone: string
  today: string
}

export function useTimeZone() {
  return useQuery({
    queryKey: keys.timeZone(),
    queryFn: () => get<TimeZoneSettings>('/business/time-zone'),
  })
}

export function useSaveTimeZone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (timeZone: string) => put<TimeZoneSaved>('/business/time-zone', { time_zone: timeZone }),
    onSuccess: (saved) => {
      queryClient.setQueryData<Me>(keys.me(), (old) => (old === undefined ? old : { ...old, today: saved.today }))
      void queryClient.invalidateQueries()
    },
  })
}

/** The zones whose name holds `query`, case-insensitively, with `_` read as a space. */
export function filterTimeZones(zones: readonly string[], query: string): string[] {
  const wanted = query.trim().toLowerCase()
  if (wanted === '') return [...zones]
  return zones.filter((zone) => zone.replaceAll('_', ' ').toLowerCase().includes(wanted))
}
