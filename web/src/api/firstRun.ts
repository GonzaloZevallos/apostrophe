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
import { get, post } from './client'
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

/** `POST /first-run/import-notice/dismissal` (204, idempotent): the business's notice is over. */
export function sendImportNoticeDismissal(): Promise<void> {
  return post<void>('/first-run/import-notice/dismissal')
}

export const firstRunQuery = queryOptions({
  queryKey: keys.firstRun(),
  queryFn: getFirstRun,
  staleTime: 0,
  refetchOnMount: true,
  refetchOnWindowFocus: true,
})

/**
 * The answer a button may act on: the last one only while the read has not failed. React
 * Query keeps the last `data` when a refetch fails; a failed read must draw "+ Nueva venta"
 * and "Mandar catálogo" enabled, as a pending one does, so it is `undefined` then.
 */
export function actionableFirstRun(read: {
  data: FirstRunAnswer | undefined
  isError: boolean
}): FirstRunAnswer | undefined {
  return read.isError ? undefined : read.data
}
