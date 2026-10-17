/**
 * `GET /first-run` (docs/adr/0046): the one answer Inicio, the Shell and Variedades read
 * the first-run element from. Matches `web/src/api/fixtures/firstRun.json` and
 * `app/onboarding/adapters/first_run_schemas.py` field for field. The front decides no
 * step, no kind and no notice: it shows what this answers. No path, query or body
 * parameter: the business comes from the session. No answer carries an amount, grams,
 * token, phone number or name.
 *
 * Unlike Inicio's panel it is never frozen: `staleTime: 0` and a refetch on mount and on
 * focus, so a step met on another screen or another device shows the next time the
 * seller looks.
 */

import { queryOptions } from '@tanstack/react-query'
import { get } from './client'
import { keys } from './keys'

/** Slot 1 of Inicio's notices: at most one of these shows at a time. */
export type FirstRunKind = 'onboarding' | 'checklist' | 'start_varieties' | 'none'

export type ChecklistStepName = 'priced_variety' | 'stock_entry' | 'published' | 'second_user'

export interface ChecklistStepAnswer {
  step: ChecklistStepName
  required: boolean
  done: boolean
}

export interface FirstRunAnswer {
  kind: FirstRunKind
  /** The four steps, in order, only while `kind` is `checklist`; empty otherwise. */
  checklist: ChecklistStepAnswer[]
  /** The after-import notice to connect the bot, shown beside any slot-1 element. */
  import_notice: boolean
  /** True only while the checklist shows and the catalog has nothing to send. */
  nothing_qualifies: boolean
}

export function getFirstRun(): Promise<FirstRunAnswer> {
  return get<FirstRunAnswer>('/first-run')
}

export const firstRunQuery = queryOptions({
  queryKey: keys.firstRun(),
  queryFn: getFirstRun,
  staleTime: 0,
  refetchOnMount: true,
  refetchOnWindowFocus: true,
})
