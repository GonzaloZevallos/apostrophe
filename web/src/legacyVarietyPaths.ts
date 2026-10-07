/**
 * QUARANTINE: #47's per-screen path functions (`VARIETY(id)`, `VARIETY_PRICES(id)`, `ENTRY(id)`,
 * ...), kept only so the merge of #59 (route registry) with master is green. Each one fills a
 * `routes.ts` template through `pathTo`, so none writes a path literal. The migration subtask
 * moves every caller onto `pathTo` and deletes this file; `legacyVarietyPaths.test.ts` lists the
 * only files allowed to import it.
 */

import {
  STOCK,
  STOCK_ENTRY,
  STOCK_ENTRY_NEW,
  VARIETY as VARIETY_TEMPLATE,
  VARIETY_ENTRIES as VARIETY_ENTRIES_TEMPLATE,
  VARIETY_PRICE_NEW as VARIETY_PRICE_NEW_TEMPLATE,
  VARIETY_PRICES as VARIETY_PRICES_TEMPLATE,
  pathTo,
} from './routes'

type Id = string | number

export const ENTRIES = STOCK
export const ENTRY_NEW = STOCK_ENTRY_NEW
export const ENTRY = (id: Id): string => pathTo(STOCK_ENTRY, { id })
export const VARIETY = (id: Id): string => pathTo(VARIETY_TEMPLATE, { id })
export const VARIETY_PRICES = (id: Id): string => pathTo(VARIETY_PRICES_TEMPLATE, { id })
export const VARIETY_PRICE_NEW = (id: Id): string => pathTo(VARIETY_PRICE_NEW_TEMPLATE, { id })
export const VARIETY_ENTRIES = (id: Id): string => pathTo(VARIETY_ENTRIES_TEMPLATE, { id })
