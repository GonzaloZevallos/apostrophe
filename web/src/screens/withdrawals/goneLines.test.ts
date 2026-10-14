/** `goneLines`: which lines of the withdrawal form name a variety that is neither listed nor
 * one the stored withdrawal already had (`stock.md`, "A variety archived while the form is open"). */

import { expect, test } from 'vitest'
import { goneLines } from './goneLines'

const set = (...ids: string[]) => new Set(ids)

test('a new withdrawal (nothing kept) flags every line whose variety is not listed', () => {
  const lines = [
    { key: 0, varietyId: '1' },
    { key: 1, varietyId: '7' },
  ]

  expect(goneLines(lines, set('1', '2'), set())).toEqual([1])
})

test('an edit keeps a line on an archived variety the stored withdrawal already had', () => {
  const lines = [
    { key: 4, varietyId: '1' },
    { key: 5, varietyId: '7' },
    { key: 6, varietyId: '8' },
  ]

  expect(goneLines(lines, set('1'), set('7'))).toEqual([6])
})

test('duplicate varieties are each flagged by their own key', () => {
  const lines = [
    { key: 2, varietyId: '7' },
    { key: 0, varietyId: '1' },
    { key: 3, varietyId: '7' },
  ]

  expect(goneLines(lines, set('1'), set())).toEqual([2, 3])
})

test('no line is flagged when every variety is listed or kept, or a line is still empty', () => {
  const lines = [
    { key: 0, varietyId: '1' },
    { key: 1, varietyId: '7' },
    { key: 2, varietyId: '' },
  ]

  expect(goneLines(lines, set('1'), set('7'))).toEqual([])
})
