import { expect, test } from 'vitest'
import { languageName } from './settings'

test('names each language in its own language', () => {
  expect(languageName('en')).toBe('English')
  expect(languageName('de')).toBe('Deutsch')
})

test('a tag with no entry shows the tag itself, even one that names an object member', () => {
  expect(languageName('fr')).toBe('fr')
  expect(languageName('constructor')).toBe('constructor')
})
