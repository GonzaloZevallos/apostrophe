/**
 * `language.ts` at its own seam: the chunk loader is injected and time is faked, so a load
 * can fail, hang or arrive late on demand. Boot is read from `<html lang>` when the module is
 * first evaluated, so a boot in another language imports a fresh copy of the module.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearMissingKeys, missingKeys } from './missingKeys'
import type { LocaleBundle, LocaleLoader } from './resources'

type Deferred = { resolve: (bundle: LocaleBundle) => void; reject: (error: Error) => void }

function controlledLoader() {
  const requested: string[] = []
  const pending: Deferred[] = []
  const loader: LocaleLoader = (tag) => {
    requested.push(tag)
    return new Promise<LocaleBundle>((resolve, reject) => {
      pending.push({ resolve, reject })
    })
  }
  return { loader, requested, pending }
}

const BUNDLE: LocaleBundle = { common: { hello: 'Hallo' } }

async function freshLanguage(bootLang: string) {
  vi.resetModules()
  document.documentElement.lang = bootLang
  const language = await import('./language')
  const { default: instance } = await import('.')
  const misses = await import('./missingKeys')
  return { ...language, instance, misses }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.documentElement.lang = ''
  clearMissingKeys()
})

describe('applyShownLanguage', () => {
  it('loads a language once, applies it and writes it to <html lang>', async () => {
    const lang = await freshLanguage('')
    const { loader, requested, pending } = controlledLoader()
    lang.setLocaleLoader(loader)

    const applied = lang.applyShownLanguage('de')
    pending[0]?.resolve(BUNDLE)
    await applied

    expect(lang.instance.language).toBe('de')
    expect(document.documentElement.lang).toBe('de')
    expect(requested).toEqual(['de'])
  })

  it('ends in English with one miss when the chunk is rejected', async () => {
    const lang = await freshLanguage('')
    const { loader, pending } = controlledLoader()
    lang.setLocaleLoader(loader)

    const applied = lang.applyShownLanguage('de')
    pending[0]?.reject(new Error('404'))
    await applied

    expect(lang.instance.language).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(lang.misses.missingKeys()).toEqual([{ language: 'de', ns: '*', key: '*' }])
  })

  it('ends in English after the timeout when the chunk never settles', async () => {
    const lang = await freshLanguage('')
    const { loader } = controlledLoader()
    lang.setLocaleLoader(loader)

    const applied = lang.applyShownLanguage('de')
    await vi.advanceTimersByTimeAsync(lang.LANGUAGE_LOAD_TIMEOUT_MS)
    await applied

    expect(lang.instance.language).toBe('en')
    expect(lang.misses.missingKeys()).toHaveLength(1)
  })

  it('does not change the language when the chunk resolves after the timeout', async () => {
    const lang = await freshLanguage('')
    const { loader, pending } = controlledLoader()
    lang.setLocaleLoader(loader)

    const applied = lang.applyShownLanguage('de')
    await vi.advanceTimersByTimeAsync(lang.LANGUAGE_LOAD_TIMEOUT_MS)
    await applied
    pending[0]?.resolve(BUNDLE)
    await vi.advanceTimersByTimeAsync(0)

    expect(lang.instance.language).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(lang.misses.missingKeys()).toHaveLength(1)
  })

  it('never loads a failed language again, and records its miss once', async () => {
    const lang = await freshLanguage('')
    const { loader, requested, pending } = controlledLoader()
    lang.setLocaleLoader(loader)

    const first = lang.applyShownLanguage('de')
    pending[0]?.reject(new Error('404'))
    await first
    await lang.applyShownLanguage('de')

    expect(requested).toEqual(['de'])
    expect(lang.misses.missingKeys()).toHaveLength(1)
    expect(lang.instance.language).toBe('en')
  })

  it('applies only the latest request when two are in flight', async () => {
    const lang = await freshLanguage('')
    const { loader, pending } = controlledLoader()
    lang.setLocaleLoader(loader)

    const de = lang.applyShownLanguage('de')
    const fr = lang.applyShownLanguage('fr')
    pending[0]?.resolve(BUNDLE)
    pending[1]?.resolve({ common: { hello: 'Salut' } })
    await Promise.all([de, fr])

    expect(lang.instance.language).toBe('fr')
  })
})

describe('resetToBootLanguage', () => {
  it('keeps <html lang> at the boot value when a response lands after the reset', async () => {
    const lang = await freshLanguage('')
    const { loader, pending } = controlledLoader()
    lang.setLocaleLoader(loader)

    const applied = lang.applyShownLanguage('de')
    lang.resetToBootLanguage()
    pending[0]?.resolve(BUNDLE)
    await applied

    expect(lang.instance.language).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('goes back to the boot language and lets a language load again', async () => {
    const lang = await freshLanguage('')
    const { loader, requested, pending } = controlledLoader()
    lang.setLocaleLoader(loader)
    const first = lang.applyShownLanguage('de')
    pending[0]?.resolve(BUNDLE)
    await first

    lang.resetToBootLanguage()
    expect(lang.instance.language).toBe('en')
    expect(document.documentElement.lang).toBe('en')

    const second = lang.applyShownLanguage('de')
    pending[1]?.resolve(BUNDLE)
    await second
    expect(requested).toEqual(['de', 'de'])
  })
})

describe('startLanguage', () => {
  it('awaits the boot chunk and applies it', async () => {
    const lang = await freshLanguage('de')
    const { loader, requested, pending } = controlledLoader()
    lang.setLocaleLoader(loader)

    const started = lang.startLanguage()
    pending[0]?.resolve(BUNDLE)
    await started

    expect(requested).toEqual(['de'])
    expect(lang.bootLanguage).toBe('de')
    expect(lang.instance.language).toBe('de')
  })

  it('renders in English, with one miss and <html lang="en">, when the boot chunk fails', async () => {
    const lang = await freshLanguage('de')
    const { loader, pending } = controlledLoader()
    lang.setLocaleLoader(loader)

    const started = lang.startLanguage()
    pending[0]?.reject(new Error('404'))
    await started

    expect(lang.instance.language).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(lang.misses.missingKeys()).toEqual([{ language: 'de', ns: '*', key: '*' }])
    expect(missingKeys()).toEqual([])
  })

  it('resets to the language the boot ended in, not to the one that failed', async () => {
    const lang = await freshLanguage('de')
    const { loader, pending } = controlledLoader()
    lang.setLocaleLoader(loader)
    const started = lang.startLanguage()
    pending[0]?.reject(new Error('404'))
    await started

    lang.resetToBootLanguage()

    expect(lang.instance.language).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('goes back to a boot language that did load after another language was shown', async () => {
    const lang = await freshLanguage('de')
    const { loader, pending } = controlledLoader()
    lang.setLocaleLoader(loader)
    const started = lang.startLanguage()
    pending[0]?.resolve(BUNDLE)
    await started
    await lang.applyShownLanguage('en')
    expect(lang.instance.language).toBe('en')

    lang.resetToBootLanguage()

    expect(lang.instance.language).toBe('de')
    expect(document.documentElement.lang).toBe('de')
  })
})
