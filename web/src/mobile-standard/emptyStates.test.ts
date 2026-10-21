import { expect, test } from 'vitest'
import { EMPTY_STATE_WORDINGS, EMPTY_STATES } from '../copy/emptyStates.ts'
import { FORBIDDEN_WHILE_LOADING } from './emptyStates.ts'

test('the forbidden list is the screens’ own wordings, none copied', () => {
  expect(FORBIDDEN_WHILE_LOADING).toBe(EMPTY_STATE_WORDINGS)
  for (const wording of [
    EMPTY_STATES.homeNobodyOwes,
    EMPTY_STATES.stockTitle,
    EMPTY_STATES.analysisNoHistory,
    EMPTY_STATES.analysisEmptyMonth,
    EMPTY_STATES.catalogTitle,
    EMPTY_STATES.homeVarietiesTitle,
  ]) {
    expect(FORBIDDEN_WHILE_LOADING).toContain(wording)
  }
})
