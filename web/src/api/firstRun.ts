/**
 * `GET /first-run` (docs/adr/0046): the one answer the Shell (the missing-price line on
 * "+ New sale") and Variedades (the disabled "Send catalog" with its reason) read the first-run
 * checklist's side rules from. Inicio reads none of it (GH-560); the
 * dismissal endpoint has no caller and `import_notice` no reader. Matches `web/src/api/fixtures/firstRun.json` and
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

/** Slot 1 of the first-run element: at most one of these at a time. */
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
  /** The after-import notice flag: no screen reads it any more. */
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
