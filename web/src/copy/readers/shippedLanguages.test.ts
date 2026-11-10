import { expect, test } from 'vitest'
import { LANGUAGES } from '../../components/fixedSets'
import { PSEUDO } from '../limits'
import { languageName } from '../settings'
import { SHIPPED_LANGUAGE_TAGS } from './shippedLanguages'

const folders = Object.keys(import.meta.glob('/src/copy/locales/*/*.json'))
const localeTags = [...new Set(folders.map((path) => path.split('/')[4]))]

test('the shipped languages are exactly the real locale folders, the Test locale aside', () => {
  const real = localeTags.filter((tag) => tag !== PSEUDO).sort()
  expect([...SHIPPED_LANGUAGE_TAGS].sort()).toEqual(real)
})

test('the language Fixed set holds the shipped languages, in order', () => {
  expect(LANGUAGES.map((option) => option.value)).toEqual([...SHIPPED_LANGUAGE_TAGS])
})

test('every member of the set has its own name, never the raw tag', () => {
  for (const option of LANGUAGES) {
    expect(option.label()).not.toBe(option.value)
    expect(option.label()).toBe(languageName(option.value))
  }
})
