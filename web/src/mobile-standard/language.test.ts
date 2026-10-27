import { expect, test } from 'vitest'
import { judgeLanguage } from './language.ts'

test('a page in the run’s locale passes', () => {
  expect(judgeLanguage('en', 'en')).toBeNull()
  expect(judgeLanguage('en-XA', 'en-XA')).toBeNull()
})

test('a page in another locale fails with the reason naming both', () => {
  expect(judgeLanguage('en', 'en-XA')).toBe('page lang en, run locale en-XA')
  expect(judgeLanguage('', 'en')).toBe('page lang , run locale en')
})
