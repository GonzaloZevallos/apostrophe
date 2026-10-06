import { expect, test } from 'vitest'
import { initialsOf } from './initials'

test('takes the first letter of the first two words, uppercase', () => {
  expect(initialsOf('La Huerta')).toBe('LH')
  expect(initialsOf('  la   huerta   del sur ')).toBe('LH')
})

test('a one-word name gives one letter, and an empty one gives none', () => {
  expect(initialsOf('Huerta')).toBe('H')
  expect(initialsOf('   ')).toBe('')
})

test('does not split an emoji or an accented letter', () => {
  expect(initialsOf('Álamo 🌿 Verde')).toBe('Á🌿')
})
