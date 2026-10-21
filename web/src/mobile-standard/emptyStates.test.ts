import { expect, test } from 'vitest'
import { EMPTY_STATE_WORDINGS, EMPTY_STATES } from '../copy/emptyStates.ts'
import { EMPTY_STATE_TITLE as CATALOG_EMPTY_TITLE } from '../copy/catalog.ts'
import { EMPTY_STATE_TITLE as STOCK_EMPTY_TITLE } from '../copy/stock.ts'
import { FORBIDDEN_WHILE_LOADING } from './emptyStates.ts'

test('the forbidden list is the screens’ own wordings, none copied', () => {
  expect(FORBIDDEN_WHILE_LOADING).toBe(EMPTY_STATE_WORDINGS)
  for (const wording of [
    EMPTY_STATES.homeNobodyOwes,
    STOCK_EMPTY_TITLE,
    EMPTY_STATES.analysisNoHistory,
    EMPTY_STATES.analysisEmptyMonth,
    CATALOG_EMPTY_TITLE,
    EMPTY_STATES.homeVarietiesTitle,
  ]) {
    expect(FORBIDDEN_WHILE_LOADING).toContain(wording)
  }
})
