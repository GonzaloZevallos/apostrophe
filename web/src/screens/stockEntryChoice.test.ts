/**
 * `entryVarietyChoice` (pure): what the Stock entry's Variety Selector is given, from the two
 * queries that feed it. `selected` is never a value present in `options`, and an unlisted
 * Variety is never offered.
 */

import { expect, test } from 'vitest'
import { entryVarietyChoice, type VarietyList } from './stockEntryChoice'

const LISTED = [
  { id: 2, name: 'Zeta' },
  { id: 1, name: 'Alfa' },
]
const ARCHIVED = [{ id: 9, name: 'Vieja' }]

const done = (data: VarietyList['data']): VarietyList => ({ status: 'success', data })
const pending: VarietyList = { status: 'pending', data: undefined }
const failed: VarietyList = { status: 'error', data: undefined }

test('listed Varieties are the options, in name order, with no selected', () => {
  const choice = entryVarietyChoice(undefined, done(LISTED), pending)
  expect(choice).toEqual({
    kind: 'ready',
    options: [
      { value: '1', label: 'Alfa' },
      { value: '2', label: 'Zeta' },
    ],
  })
})

test('a pending list, or a failed first load, is loading', () => {
  expect(entryVarietyChoice(undefined, pending, pending).kind).toBe('loading')
  expect(entryVarietyChoice(undefined, failed, pending).kind).toBe('loading')
  expect(entryVarietyChoice(1, failed, done(ARCHIVED)).kind).toBe('loading')
})

test('a failed refresh that still has data keeps the list ready', () => {
  expect(entryVarietyChoice(undefined, { status: 'error', data: LISTED }, pending).kind).toBe('ready')
})

test('an entry whose Variety is listed has no selected', () => {
  const choice = entryVarietyChoice(1, done(LISTED), pending)
  expect(choice.kind).toBe('ready')
  expect(choice.selected).toBeUndefined()
})

test('an entry whose Variety is archived gets selected from the archived list, and it is never offered', () => {
  const choice = entryVarietyChoice(9, done(LISTED), done(ARCHIVED))
  expect(choice.kind).toBe('ready')
  expect(choice.selected).toEqual({ value: '9', label: 'Vieja' })
  expect(choice.options.map((option) => option.value)).not.toContain('9')
})

test('an unlisted entry Variety with the archived list pending is loading; failed is failed', () => {
  expect(entryVarietyChoice(9, done(LISTED), pending).kind).toBe('loading')
  const choice = entryVarietyChoice(9, done(LISTED), failed)
  expect(choice.kind).toBe('failed')
  expect(choice.options.map((option) => option.value)).toEqual(['1', '2'])
})

test('an empty successful list is ready with no options', () => {
  expect(entryVarietyChoice(undefined, done([]), pending)).toEqual({ kind: 'ready', options: [] })
})
