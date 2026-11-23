import { describe, expect, test } from 'vitest'
import { testT } from '../../i18n/testing'
import type { CopyKey } from '../../i18n/resources.generated'
import { searchSettingsRows } from './settingsSearch'
import {
  SETTINGS_GROUP_LABEL_KEYS,
  SETTINGS_ROWS,
  shownRowsByGroup,
  type SettingsRow,
  type SettingsRowContext,
} from './settingsRows'

const ALL: SettingsRowContext = { selectableLanguages: ['en', 'es'], isCustomerTypesOn: true }
const NO_CONTEXT: SettingsRowContext = { selectableLanguages: undefined, isCustomerTypesOn: undefined }

const resolve = (key: CopyKey): string => testT(key)

function keysOf(text: string, ctx: SettingsRowContext = ALL): readonly string[] {
  return searchSettingsRows(shownRowsByGroup(ctx), resolve, text).map((result) => result.row.key)
}

/** A row whose label is whatever `labels` says, so accents and case are fed without touching the copy. */
function labelled(base: SettingsRow, labelKey: CopyKey): SettingsRow {
  return { ...base, labelKey }
}

function baseRow(key: SettingsRow['key']): SettingsRow {
  const found = SETTINGS_ROWS.find((candidate) => candidate.key === key)
  if (found === undefined) throw new Error(`no row ${key}`)
  return found
}

describe('searchSettingsRows', () => {
  test('ignores case in the text and in the label', () => {
    expect(keysOf('PRICES')).toEqual(['prices'])
    expect(keysOf('theme')).toEqual(['theme'])
  })

  test('finds a match in the middle of a label', () => {
    expect(keysOf('ethod')).toEqual(['paymentMethods'])
  })

  test('folds accents in the text and in the label', () => {
    const labels: Record<string, string> = { 'settings:rows.theme.label': 'Contraseña y Ñandú' }
    const fake = (key: CopyKey): string => labels[key] ?? ''
    const groups = shownRowsByGroup(ALL, [labelled(baseRow('theme'), 'settings:rows.theme.label')])
    const found = (text: string) => searchSettingsRows(groups, fake, text).map((result) => result.row.key)
    expect(found('contrasena')).toEqual(['theme'])
    expect(found('NANDÚ')).toEqual(['theme'])
    expect(found('ñ')).toEqual(['theme'])
    expect(found('contraseñá')).toEqual(['theme'])
  })

  test('trims the spaces around the text but keeps the ones inside', () => {
    expect(keysOf('  prices  ')).toEqual(['prices'])
    expect(keysOf('payment methods')).toEqual(['paymentMethods'])
    expect(keysOf('payment   methods')).toEqual([])
  })

  test('returns nothing for empty text and for whitespace only', () => {
    expect(keysOf('')).toEqual([])
    expect(keysOf('   ')).toEqual([])
    expect(keysOf('\t\n ')).toEqual([])
  })

  test('returns nothing for a lone combining mark, with and without spaces around it', () => {
    expect(keysOf('́')).toEqual([])
    expect(keysOf('  ́  ')).toEqual([])
  })

  test('returns nothing when no label holds the text', () => {
    expect(keysOf('zzz')).toEqual([])
  })

  test('never matches a group heading or a description', () => {
    // "Payments and stock" is a group heading; "Telegram bot and channel" is a description.
    expect(keysOf('Payments and stock')).toEqual([])
    expect(keysOf('Telegram bot')).toEqual([])
  })

  test('never finds a hidden row: Language with one language, Customer types off or unknown', () => {
    expect(keysOf('language', { selectableLanguages: ['en'], isCustomerTypesOn: true })).toEqual([])
    expect(keysOf('language', { selectableLanguages: undefined, isCustomerTypesOn: true })).toEqual([])
    expect(keysOf('language')).toEqual(['language'])
    expect(keysOf('customer types', { selectableLanguages: ['en', 'es'], isCustomerTypesOn: false })).toEqual([])
    expect(keysOf('customer types', NO_CONTEXT)).toEqual([])
    expect(keysOf('customer types')).toEqual(['customerTypes'])
  })

  test('keeps registry order across groups', () => {
    // "s" is in the labels of most rows; the result must follow the registry, group by group.
    const expected = SETTINGS_ROWS.filter((row) => resolve(row.labelKey).toLowerCase().includes('s')).map(
      (row) => row.key,
    )
    expect(expected.length).toBeGreaterThan(5)
    expect(keysOf('s')).toEqual(expected)
  })

  test('carries the label key of the row’s group on each result', () => {
    const results = searchSettingsRows(shownRowsByGroup(ALL), resolve, 'e')
    expect(results.length).toBeGreaterThan(5)
    for (const result of results) {
      expect(result.groupLabelKey).toBe(SETTINGS_GROUP_LABEL_KEYS[result.row.group])
    }
    expect(results.find((result) => result.row.key === 'prices')?.groupLabelKey).toBe('settings:groups.catalog')
  })
})
