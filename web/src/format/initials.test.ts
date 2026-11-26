import { describe, expect, test } from 'vitest'
import cases from './initials.cases.json'
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

type InitialsCase = { readonly name: string; readonly initials: string }

const CASES: readonly InitialsCase[] = cases

const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/

describe('the shared fixture', () => {
  test.each(CASES.map(({ name, initials }) => [name, initials] as const))(
    'initialsOf(%j) is %j, valid and at most 32 code points',
    (name, initials) => {
      expect(LONE_SURROGATE.test(name)).toBe(false)
      expect(LONE_SURROGATE.test(initials)).toBe(false)
      expect(Array.from(initials).length).toBeLessThanOrEqual(32)
      expect(initialsOf(name)).toBe(initials)
    },
  )
})
