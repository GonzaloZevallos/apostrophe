import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectCountry } from './detectCountry.ts'
import { SERVED } from './served.fixture.ts'

afterEach(() => vi.restoreAllMocks())

describe('detectCountry', () => {
  it('takes the first language whose region is listed, skipping unlisted regions', () => {
    expect(detectCountry(['es-419', 'es-UY'], 'UTC', SERVED)).toBe('UY')
    expect(detectCountry(['zh-Hant-TW', 'pt-br'], 'UTC', SERVED)).toBe('BR')
  })

  it('skips an entry without a region and an entry that is not a tag', () => {
    expect(detectCountry(['en', 'x_y', 'es-UY'], 'UTC', SERVED)).toBe('UY')
  })

  it('falls back to the country of the time zone', () => {
    expect(detectCountry(['en'], 'America/Montevideo', SERVED)).toBe('UY')
  })

  it('knows a zone that tzdata keeps only as an alias', () => {
    expect(detectCountry([], 'America/Buenos_Aires', SERVED)).toBe('AR')
  })

  it('gives null (Other) when neither language nor zone is listed', () => {
    expect(detectCountry([], 'UTC', SERVED)).toBeNull()
  })

  it('ignores a zone country that the served list does not carry', () => {
    expect(detectCountry([], 'America/Montevideo', SERVED.filter((c) => c.code !== 'UY'))).toBeNull()
  })

  it('makes no request and writes no storage', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    detectCountry(['es-UY'], 'America/Montevideo', SERVED)
    detectCountry([], 'America/Montevideo', SERVED)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
  })
})
