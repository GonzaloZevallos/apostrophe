import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatReport, missingKeys, runReport } from './missingKeys.ts'

const REPORT = process.env['I18N_MISSING_REPORT'] === '1'

/** A locales folder: tag to file name to content. */
function locales(tree: Record<string, Record<string, unknown>>): string {
  const root = mkdtempSync(join(tmpdir(), 'missing-'))
  for (const [tag, files] of Object.entries(tree)) {
    mkdirSync(join(root, tag), { recursive: true })
    for (const [file, content] of Object.entries(files)) {
      writeFileSync(join(root, tag, file), JSON.stringify(content))
    }
  }
  return root
}

const ENGLISH = {
  'common.json': { ok: 'OK', items_one: '{{count}} item', items_other: '{{count}} items' },
  'sales.json': { title: 'Sales', nested: { deep: 'Deep' } },
}

describe('the missing-key report', () => {
  it('lists the English keys a language lacks, as ns:key, sorted, and nothing else', () => {
    const root = locales({
      en: ENGLISH,
      de: { 'common.json': { ok: 'Okay', items_one: '{{count}} Ding' } },
    })

    expect(missingKeys(root)).toEqual([
      { locale: 'de', keys: ['common:items_other', 'sales:nested.deep', 'sales:title'] },
    ])
  })

  it('counts an empty value as missing', () => {
    const root = locales({
      en: ENGLISH,
      de: { 'common.json': { ok: '', items_one: 'x', items_other: 'y' }, 'sales.json': { title: 'Verkäufe', nested: { deep: 'Tief' } } },
    })

    expect(missingKeys(root)).toEqual([{ locale: 'de', keys: ['common:ok'] }])
  })

  it('reports a language with every key present as zero missing', () => {
    const root = locales({
      en: ENGLISH,
      de: {
        'common.json': { ok: 'Okay', items_one: 'a', items_other: 'b' },
        'sales.json': { title: 'Verkäufe', nested: { deep: 'Tief' } },
      },
    })

    expect(missingKeys(root)).toEqual([{ locale: 'de', keys: [] }])
  })

  it('skips en and the en-XA test locale', () => {
    const root = locales({ en: ENGLISH, 'en-XA': {}, es: {} })

    expect(missingKeys(root).map((entry) => entry.locale)).toEqual(['es'])
  })

  it('has nothing to report when no other locale exists, and nothing missing when English is empty', () => {
    expect(missingKeys(locales({ en: {} }))).toEqual([])
    expect(missingKeys(locales({ de: {} }))).toEqual([{ locale: 'de', keys: [] }])
  })

  it('prints keys only, never a value', () => {
    const root = locales({
      en: { 'common.json': { secret: 'Never printed', other: 'Also never' } },
      de: { 'common.json': { other: 'Auch nicht' } },
    })

    const text = formatReport(missingKeys(root)).join('\n')

    expect(text).toBe('de: 1 missing\n  common:secret')
    expect(text).not.toContain('Never printed')
    expect(text).not.toContain('Auch nicht')
  })

  it('always returns zero, with missing keys and with none', () => {
    const lines: string[] = []

    const withMissing = runReport(locales({ en: ENGLISH, de: {} }), (line) => lines.push(line))
    const without = runReport(locales({ en: {} }), (line) => lines.push(line))

    expect(withMissing).toBe(0)
    expect(without).toBe(0)
    expect(lines[0]).toBe('de: 5 missing')
  })

  it.runIf(REPORT)('prints the report for the real locales folder', () => {
    expect(runReport()).toBe(0)
  })
})
