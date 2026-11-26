import { describe, expect, test } from 'vitest'
import { logoRefusal, MAX_LOGO_BYTES } from './logoRefusal'

describe('logoRefusal', () => {
  test('a file of exactly the limit passes', () => {
    expect(logoRefusal({ size: MAX_LOGO_BYTES, type: 'image/png' })).toBeNull()
  })

  test('one byte over the limit is too_big', () => {
    expect(logoRefusal({ size: MAX_LOGO_BYTES + 1, type: 'image/png' })).toBe('too_big')
  })

  test('a type that is neither PNG nor JPEG is wrong_type', () => {
    expect(logoRefusal({ size: 10, type: 'image/heic' })).toBe('wrong_type')
  })

  test('an empty type passes: the server decides by content', () => {
    expect(logoRefusal({ size: 10, type: '' })).toBeNull()
  })

  test('PNG and JPEG pass', () => {
    expect(logoRefusal({ size: 10, type: 'image/jpeg' })).toBeNull()
    expect(logoRefusal({ size: 10, type: 'image/png' })).toBeNull()
  })

  test('an oversized file of a wrong type is too_big: the size is checked first', () => {
    expect(logoRefusal({ size: MAX_LOGO_BYTES + 1, type: 'image/heic' })).toBe('too_big')
  })
})
