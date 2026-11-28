import { describe, expect, test } from 'vitest'
import { pseudoText } from '../../scripts/i18n/pseudo.ts'
import { EXPENSES_TEXT } from './expenses.ts'

/** The texts the Expenses summary adds, with their arguments filled, and their English. */
const NEW_TEXTS: readonly (readonly [key: string, english: string])[] = [
  ['youSpentIn', EXPENSES_TEXT.youSpentIn('November 2026')],
  ['expenseOne', EXPENSES_TEXT.expenseOne],
  ['expenseMany', EXPENSES_TEXT.expenseMany(3)],
  ['others', EXPENSES_TEXT.others],
  ['thousandSuffix', EXPENSES_TEXT.thousandSuffix],
  ['millionSuffix', EXPENSES_TEXT.millionSuffix],
  ['barLabel', EXPENSES_TEXT.barLabel('Rent 70%, Others 30%')],
  ['barSegment', EXPENSES_TEXT.barSegment('Rent', 70)],
  ['today', EXPENSES_TEXT.today],
  ...EXPENSES_TEXT.weekdaysShort.map((day, index) => [`weekdaysShort[${index}]`, day] as const),
  ['delete', EXPENSES_TEXT.delete],
]

describe('the Expenses summary copy', () => {
  test.each(NEW_TEXTS)('%s is "%s" in English', (_key, english) => {
    expect(english).not.toBe('')
  })

  test.each(NEW_TEXTS)('%s gets a non-empty en-XA text that differs from "%s"', (_key, english) => {
    const pseudo = pseudoText(english)
    expect(pseudo).not.toBe('')
    expect(pseudo).not.toBe(english)
  })

  test('the English wording is the one the brief gives', () => {
    expect(EXPENSES_TEXT.youSpentIn('November 2026')).toBe('You spent in November 2026')
    expect(EXPENSES_TEXT.barLabel('Rent 70%')).toBe('Spending by category: Rent 70%')
    expect(EXPENSES_TEXT.barSegment('Rent', 70)).toBe('Rent 70%')
    expect(EXPENSES_TEXT.weekdaysShort).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })
})
