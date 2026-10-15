/**
 * The pure rules behind the withdrawal form's archived-variety handling (`stock.md`,
 * "Sacar del stock"): who is guilty after a fresh list, what a line's picker offers, and
 * whether a preselected variety survives. No cache, no network.
 */

import { expect, test } from 'vitest'
import { guiltyKeys, keptOptions, preselected } from './goneLines'

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

test('guiltyKeys: an empty list makes every chosen line guilty, and a line with no variety never', () => {
  const lines = [
    { key: 0, varietyId: '1' },
    { key: 1, varietyId: '' },
  ]

  expect(guiltyKeys(lines, new Set(), new Set())).toEqual(new Set([0]))
})

test('keptOptions: the listed varieties alone when every line is listed', () => {
  const lines = [{ key: 0, varietyId: '2' }]

  expect(keptOptions(lines, LISTED, new Map())).toEqual([
    { value: '1', label: 'Zkittlez', disabled: false },
    { value: '2', label: 'Gelato', disabled: false },
  ])
})

test('keptOptions: a line whose variety is not listed adds one disabled option, named from the map', () => {
  const lines = [{ key: 0, varietyId: '3' }]

  expect(keptOptions(lines, LISTED, new Map([['3', 'Gorilla']]))).toEqual([
    { value: '1', label: 'Zkittlez', disabled: false },
    { value: '2', label: 'Gelato', disabled: false },
    { value: '3', label: 'Gorilla', disabled: true },
  ])
})

test('keptOptions: a duplicate variety across lines adds its option once', () => {
  const lines = [
    { key: 0, varietyId: '3' },
    { key: 1, varietyId: '3' },
  ]

  const options = keptOptions(lines, LISTED, new Map([['3', 'Gorilla']]))

  expect(options.filter((option) => option.value === '3')).toHaveLength(1)
})

test('keptOptions: with an empty list a stored line still keeps its option', () => {
  const lines = [{ key: 0, varietyId: '3' }]

  expect(keptOptions(lines, [], new Map([['3', 'Gorilla']]))).toEqual([
    { value: '3', label: 'Gorilla', disabled: true },
  ])
})

test('keptOptions: a missing name leaves an empty label, never the id', () => {
  const lines = [{ key: 0, varietyId: '3' }]

  expect(keptOptions(lines, LISTED, new Map())[2]).toEqual({ value: '3', label: '', disabled: true })
})

test('keptOptions: a line with no variety adds nothing', () => {
  const lines = [{ key: 0, varietyId: '' }]

  expect(keptOptions(lines, LISTED, new Map())).toHaveLength(2)
})

test('preselected: a listed id stays, an unlisted or unknown one becomes empty', () => {
  const ids = new Set(['1', '2'])

  expect(preselected('2', ids)).toBe('2')
  expect(preselected('9', ids)).toBe('')
  expect(preselected('', ids)).toBe('')
  expect(preselected('2', new Set())).toBe('')
})
