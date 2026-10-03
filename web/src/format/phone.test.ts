import { expect, test } from 'vitest'
import { formatPhone } from './phone'

test('formats a canonical Argentine mobile number with its groups', () => {
  expect(formatPhone('+5491160337725')).toBe('+54 9 11 6033-7725')
})

test('returns an unrecognised shape unchanged, never throwing', () => {
  expect(formatPhone('+1234')).toBe('+1234')
})
