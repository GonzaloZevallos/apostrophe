/**
 * The pure rules behind the withdrawal form's archived-variety handling (`stock.md`,
 * "Take from stock"): who is guilty after a fresh list, what a line's Selector gets, and
 * whether a preselected variety survives. No cache, no network.
 */

import { expect, test } from 'vitest'
import { guiltyKeys, lineChoice, preselected } from './goneLines'

const LISTED = [
  { id: 1, name: 'Zkittlez' },
  { id: 2, name: 'Gelato' },
]

test('guiltyKeys: a line absent from the fresh list and not on the stored withdrawal is guilty', () => {
  const lines = [
    { key: 0, varietyId: '1' },
    { key: 1, varietyId: '3' },
  ]

  expect(guiltyKeys(lines, new Set(['1', '2']), new Set())).toEqual(new Set([1]))
})

test('guiltyKeys: a stored line is never guilty, even when archived since', () => {
  const lines = [
    { key: 0, varietyId: '3' },
    { key: 1, varietyId: '4' },
  ]

  expect(guiltyKeys(lines, new Set(['1']), new Set(['3']))).toEqual(new Set([1]))
})

test('guiltyKeys: every line of a duplicated variety is guilty together', () => {
  const lines = [
    { key: 0, varietyId: '3' },
    { key: 1, varietyId: '1' },
    { key: 2, varietyId: '3' },
  ]

  expect(guiltyKeys(lines, new Set(['1']), new Set())).toEqual(new Set([0, 2]))
})

test('guiltyKeys: an empty list makes every chosen line guilty, and a line with no product never', () => {
  const lines = [
    { key: 0, varietyId: '1' },
    { key: 1, varietyId: '' },
  ]

  expect(guiltyKeys(lines, new Set(), new Set())).toEqual(new Set([0]))
})

test('lineChoice: a listed line offers every listed Variety and has no selected', () => {
  const line = { key: 0, varietyId: '2', varietyName: 'Gelato' }

  expect(lineChoice(line, LISTED)).toEqual({
    options: [
      { value: '2', label: 'Gelato' },
      { value: '1', label: 'Zkittlez' },
    ],
  })
})

test('lineChoice: a stored line archived since shows its stored name as selected and never offers it', () => {
  const line = { key: 0, varietyId: '3', varietyName: 'Gorilla' }
  const choice = lineChoice(line, LISTED)

  expect(choice.selected).toEqual({ value: '3', label: 'Gorilla' })
  expect(choice.options.map((option) => option.value)).not.toContain('3')
  expect(guiltyKeys([line], new Set(['1', '2']), new Set(['3']))).toEqual(new Set())
})

test('lineChoice: a refused line keeps the name it was picked with', () => {
  const line = { key: 1, varietyId: '1', varietyName: 'Zkittlez' }

  expect(lineChoice(line, [{ id: 2, name: 'Gelato' }]).selected).toEqual({ value: '1', label: 'Zkittlez' })
})

test('lineChoice: with an empty list a stored line still has its selected', () => {
  expect(lineChoice({ key: 0, varietyId: '3', varietyName: 'Gorilla' }, [])).toEqual({
    options: [],
    selected: { value: '3', label: 'Gorilla' },
  })
})

test('lineChoice: a missing name gives no selected, never the id', () => {
  expect(lineChoice({ key: 0, varietyId: '3', varietyName: '' }, LISTED).selected).toBeUndefined()
})

test('lineChoice: a line with no product has no selected', () => {
  expect(lineChoice({ key: 0, varietyId: '', varietyName: '' }, LISTED).selected).toBeUndefined()
})

test('preselected: a listed id stays, an unlisted or unknown one becomes empty', () => {
  const ids = new Set(['1', '2'])

  expect(preselected('2', ids)).toBe('2')
  expect(preselected('9', ids)).toBe('')
  expect(preselected('', ids)).toBe('')
  expect(preselected('2', new Set())).toBe('')
})
