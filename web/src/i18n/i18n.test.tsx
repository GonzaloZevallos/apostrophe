import { render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'
import i18n, { installLocale } from '.'
import { clearMissingKeys, missingKeys } from './missingKeys'
import { productionOptions } from './options'
import { addFixtureNamespace, looseT, removeFixtureNamespace } from './testing'
import fixture from './__fixtures__/locales/en/fixture.json'

addFixtureNamespace('fixture', fixture)

function Probe({ name }: { name: string }) {
  useTranslation()
  return <p>{looseT('fixture:greeting', { name })}</p>
}

afterEach(clearMissingKeys)

describe('the i18n instance', () => {
  it('answers in English on the very first render, with nothing awaited', () => {
    render(<Probe name="Ana" />)

    expect(screen.getByText('Hello Ana')).toBeInTheDocument()
  })

  it('shows an interpolated value exactly as given, with no HTML escaping', () => {
    render(<Probe name={`Tom & Jerry <b> 'x'`} />)

    expect(screen.getByText(`Hello Tom & Jerry <b> 'x'`)).toBeInTheDocument()
  })

  it('is set up as the standards for this product ask', () => {
    expect(i18n.options.interpolation?.escapeValue).toBe(false)
    expect(i18n.options.initAsync).toBe(false)
    expect(i18n.options.react?.useSuspense).toBe(false)
    expect(i18n.options.fallbackLng).toEqual(['en'])
    expect(i18n.isInitialized).toBe(true)
  })

  it('runs on the shared production options', () => {
    // i18next keeps `fallbackLng` as a list once initialised; every other option is as given.
    expect(i18n.options).toMatchObject({ ...productionOptions, fallbackLng: [productionOptions.fallbackLng] })
  })

  it('records a missing key as language, namespace and key only', () => {
    looseT('fixture:absent', { name: 'Ana Pérez' })
    i18n.t('fixture:absent' as never, { lng: 'fr', defaultValue: 'secret words' } as never)

    expect(missingKeys()).toEqual([
      { language: 'en', ns: 'fixture', key: 'absent' },
      { language: 'fr', ns: 'fixture', key: 'absent' },
    ])
    expect(JSON.stringify(missingKeys())).not.toMatch(/Ana|secret/)
  })

  it('records a plural miss under its base key', () => {
    i18n.t('fixture:nothing' as never, { count: 2 } as never)

    expect(missingKeys()).toEqual([{ language: 'en', ns: 'fixture', key: 'nothing' }])
  })

  it('resolves a key missing in another language to English, without a miss', () => {
    removeFixtureNamespace('fixture', 'de')

    expect(i18n.t('fixture:title' as never, { lng: 'de' } as never)).toBe('Fixture')
    expect(missingKeys()).toEqual([])
  })

  it('installs a language from an injected loader and does not switch to it', async () => {
    await installLocale('de', () => Promise.resolve({ fixture: { title: 'Vorrichtung' } }))

    expect(i18n.t('fixture:title' as never, { lng: 'de' } as never)).toBe('Vorrichtung')
    expect(i18n.language).toBe('en')
  })
})
