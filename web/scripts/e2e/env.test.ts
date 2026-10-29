import { afterEach, describe, expect, test, vi } from 'vitest'
import { mobileEnv, mobileLanguage } from '../../e2e/env.ts'

const VARIABLE = 'APOSTROPHE_FORCED_LANGUAGE'

afterEach(() => vi.unstubAllEnvs())

describe('mobileLanguage', () => {
  test('unset and empty are English', () => {
    vi.stubEnv(VARIABLE, undefined)
    expect(mobileLanguage()).toBe('en')
    vi.stubEnv(VARIABLE, '')
    expect(mobileLanguage()).toBe('en')
  })

  test('exactly en-XA is the pseudo-locale', () => {
    vi.stubEnv(VARIABLE, 'en-XA')
    expect(mobileLanguage()).toBe('en-XA')
  })

  test.each(['  ', 'en', 'de', ' en-XA', 'en-xa'])('%j throws an error naming the variable and not its value', (value) => {
    vi.stubEnv(VARIABLE, value)
    expect(() => mobileLanguage()).toThrow(VARIABLE)
    try {
      mobileLanguage()
    } catch (error) {
      expect((error as Error).message).not.toContain(`"${value}"`)
      expect((error as Error).message).not.toContain(`'${value}'`)
    }
  })
})

describe('mobileEnv', () => {
  test('hands the backend the forced language only on an en-XA run', () => {
    vi.stubEnv('APOSTROPHE_E2E_MOBILE_PORT', '4321')
    vi.stubEnv(VARIABLE, undefined)
    expect(mobileEnv()).not.toHaveProperty(VARIABLE)
    vi.stubEnv(VARIABLE, 'en-XA')
    expect(mobileEnv()).toMatchObject({ [VARIABLE]: 'en-XA' })
  })
})
