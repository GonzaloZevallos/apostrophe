/**
 * The device readers are the one place the browser is asked where the app is used
 * (invariant 4), and they reach `navigator` and `Temporal`, which `detectCountry` never sees:
 * its seam takes the languages and the zone as arguments. A test of `detectCountry`,
 * `shownCountry`, the reducer or `toRequestCountry` cannot show that these two reads answer
 * the empty value when the browser has nothing, so they are tested here, beside the file.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

type Device = typeof import('./device.ts')
const real = (): Promise<Device> => vi.importActual<Device>('./device.ts')

afterEach(() => vi.restoreAllMocks())

describe('the device readers', () => {
  it('read the language list and the time zone of the browser', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['es-UY', 'en'])
    const { deviceLanguages, deviceTimeZone } = await real()

    expect(deviceLanguages()).toEqual(['es-UY', 'en'])
    vi.stubGlobal('Temporal', { Now: { timeZoneId: () => 'America/Montevideo' } })
    expect(deviceTimeZone()).toBe('America/Montevideo')
    vi.unstubAllGlobals()
    vi.stubGlobal('Temporal', undefined)
    expect(deviceTimeZone()).toBe('')
    vi.unstubAllGlobals()
  })

  it('fall back to the single language when the list is empty', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([])
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('pt-BR')
    const { deviceLanguages } = await real()

    expect(deviceLanguages()).toEqual(['pt-BR'])
  })

  it('are pinned to an Argentine phone for every other test', async () => {
    const { deviceLanguages, deviceTimeZone } = await import('./device.ts')

    expect(deviceLanguages()).toEqual(['es-AR'])
    expect(deviceTimeZone()).toBe('America/Argentina/Buenos_Aires')
  })
})
