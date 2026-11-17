import { describe, expect, it } from 'vitest'
import listedCodes from '../phone/listedCodes.json'
import { CUSTOMERS_TEXT, phoneAdjective, phoneCountryName, phoneLengthsText } from './customers.ts'

describe('the phone copy', () => {
  it('names every listed country and gives it an adjective', () => {
    for (const code of listedCodes.codes) {
      expect(phoneCountryName(code)).not.toBe(code)
      expect(phoneAdjective(code)).not.toBe(code)
      expect(phoneAdjective(code).length).toBeGreaterThan(0)
    }
  })

  it('states no calling code and no length in any phone text', () => {
    const phoneTexts = Object.entries(CUSTOMERS_TEXT)
      .filter(([key]) => key.startsWith('phone'))
      .map(([key, value]) =>
        typeof value === 'function' ? [key, (value as (...a: string[]) => string)('{a}', '{b}')] : [key, value],
      )

    for (const [key, text] of phoneTexts) expect(text, key).not.toMatch(/\d/)
  })

  it('joins the served lengths with the "or" of the copy', () => {
    expect(phoneLengthsText([9])).toBe('9')
    expect(phoneLengthsText([9, 8])).toBe('8 or 9')
    expect(phoneLengthsText([8, 9, 10])).toBe('8, 9 or 10')
  })

  it('writes the rejection around the adjective and the lengths', () => {
    expect(CUSTOMERS_TEXT.phoneInvalidFor(phoneAdjective('AR'), '10')).toBe(
      "That doesn't look like an Argentine number. It needs 10 digits after the country code.",
    )
  })
})
