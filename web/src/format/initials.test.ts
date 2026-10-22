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

test('names of people: the first two words, the first character of each', () => {
  expect(initialsOf('Juan Pérez')).toBe('JP')
  expect(initialsOf('Juan')).toBe('J')
  expect(initialsOf('(Ana) Pérez')).toBe('(P')
})

test('a name that starts with an emoji keeps the whole emoji', () => {
  expect(initialsOf('🌿 Verde')).toBe('🌿V')
})

test('extra inner spaces do not count as words', () => {
  expect(initialsOf('Juan      Pérez')).toBe('JP')
})
