import { expect, test } from 'vitest'
import { PHONE_COUNTRIES } from '../../components/fixedSets'
import { phoneCountryName } from '../settings'
import { PHONE_COUNTRY_CODES } from './phoneCountryCodes'

test('the Phone country set holds "No country" and then every listed code, in order', () => {
  expect(PHONE_COUNTRIES.map((option) => option.value)).toEqual(['none', ...PHONE_COUNTRY_CODES])
})

test('every listed code has its own name in the Copy module, never the raw code', () => {
  for (const code of PHONE_COUNTRY_CODES) {
    expect(phoneCountryName(code), code).not.toBe(code)
  }
})
