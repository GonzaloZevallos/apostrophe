import { expect, test } from 'vitest'
import { initialsOf } from './initials'

test.each([
  ['La Huerta', 'LH'],
  ['  la   huerta   del sur ', 'LH'],
  ['Juan      Pérez', 'JP'],
  ['Zeta', 'ZE'],
  ['Huerta', 'HU'],
  ['Juan', 'JU'],
  ['Z', 'Z'],
  ['🌿 Verde', '🌿V'],
  ['🇦🇷', '🇦🇷'],
  ['🇦🇷🇺🇾', '🇦🇷🇺🇾'],
  ['👨‍👩‍👧', '👨‍👩‍👧'],
  ['👍🏽', '👍🏽'],
  ['Álamo 🌿 Verde', 'Á🌿'],
  ['(Ana) Pérez', '(P'],
  ['ßa', 'SSA'],
  ['   ', ''],
])('initialsOf(%j) is %j', (name, expected) => {
  expect(initialsOf(name)).toBe(expected)
})
