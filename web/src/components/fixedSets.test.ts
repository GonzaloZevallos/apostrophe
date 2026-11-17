/**
 * The fixed-set registry (`fixedSets.ts`): every set keeps today's order and words, every icon
 * is one `Icono` draws, every set has its reason, and a getter reads its text in render, so a
 * language switch moves the icon names and leaves the period and theme words where they were.
 */

import { afterEach, expect, test } from 'vitest'
import { restoreEnglish, switchToMarkers } from '../i18n/switchFixture'
import { SALES_TEXT } from '../copy/sales'
import { SETTINGS_TEXT } from '../copy/settings'
import * as registry from './fixedSets'
import {
  CUSTOMER_TYPE_ICON_SET,
  FIXED_SETS,
  HOME_PERIODS,
  PAYMENT_STATES,
  RAW_CHIP_SITES,
  rawSites,
  SALES_PERIODS,
  STOCK_ENTRY_ORIGINS,
  THEME_CHOICES,
  type FixedOption,
} from './fixedSets'
import { ICON_NAMES } from './Icono'

afterEach(restoreEnglish)

function values(set: readonly FixedOption<string>[]): string[] {
  return set.map((option) => option.value)
}

function labels(set: readonly FixedOption<string>[]): string[] {
  return set.map((option) => option.label())
}

test('the Home periods are Today, Week, Month in that order', () => {
  expect(values(HOME_PERIODS)).toEqual(['today', 'week', 'month'])
  expect(labels(HOME_PERIODS)).toEqual(['Today', 'Week', 'Month'])
})

test('the Sales periods add the date range as the fourth', () => {
  expect(values(SALES_PERIODS)).toEqual(['hoy', 'semana', 'mes', 'fechas'])
  expect(labels(SALES_PERIODS)).toEqual([
    'Today',
    'Week',
    'Month',
    SALES_TEXT.dates,
  ])
})

test('the theme choices are Automatic, Light, Dark in that order', () => {
  expect(values(THEME_CHOICES)).toEqual(['automatic', 'light', 'dark'])
  expect(labels(THEME_CHOICES)).toEqual([
    SETTINGS_TEXT.automatic,
    SETTINGS_TEXT.light,
    SETTINGS_TEXT.dark,
  ])
})

test('the Stock entry origins are Purchase, Harvest, Initial stock, Adjustment in that order', () => {
  expect(values(STOCK_ENTRY_ORIGINS)).toEqual(['purchase', 'harvest', 'opening_stock', 'adjustment'])
  expect(labels(STOCK_ENTRY_ORIGINS)).toEqual(['Purchase', 'Harvest', 'Initial stock', 'Adjustment'])
  expect(STOCK_ENTRY_ORIGINS.every((option) => option.icon === undefined)).toBe(true)
})

test('the payment states are Paid and Owing, and never a method', () => {
  expect(values(PAYMENT_STATES)).toEqual(['paid', 'owing'])
  expect(labels(PAYMENT_STATES)).toEqual(['Paid', 'Owing'])
  const everyValue = Object.entries(registry).flatMap(([name, set]) =>
    name !== 'RAW_CHIP_SITES' && Array.isArray(set) ? values(set as readonly FixedOption<string>[]) : [],
  )
  expect(everyValue).not.toContain('cash')
  expect(everyValue).not.toContain('transfer')
})

test('the customer-type icons keep their order, glyphs and accessible names', () => {
  expect(values(CUSTOMER_TYPE_ICON_SET)).toEqual([
    'circle', 'star', 'heart', 'diamond', 'flag', 'tag', 'crown', 'bell',
  ])
  expect(CUSTOMER_TYPE_ICON_SET.map((option) => option.icon)).toEqual([
    'circulo', 'estrella', 'corazon', 'rombo', 'bandera', 'etiqueta', 'corona', 'campana',
  ])
  expect(labels(CUSTOMER_TYPE_ICON_SET)).toEqual([
    'Circle', 'Star', 'Heart', 'Diamond', 'Flag', 'Tag', 'Crown', 'Bell',
  ])
})

test('every icon of the registry is one Icono draws', () => {
  for (const option of CUSTOMER_TYPE_ICON_SET) {
    expect(ICON_NAMES).toContain(option.icon)
  }
})

test('FIXED_SETS gives every exported set a non-empty reason, and names nothing else', () => {
  const exportedSets = Object.entries(registry)
    .filter(
      ([name, exported]) =>
        name !== 'FIXED_SETS' && name !== 'RAW_CHIP_SITES' && Array.isArray(exported),
    )
    .map(([name]) => name)
  expect(Object.keys(FIXED_SETS).sort()).toEqual(exportedSets.sort())
  for (const [name, reason] of Object.entries(FIXED_SETS)) {
    expect(reason.trim(), name).not.toBe('')
  }
  expect(FIXED_SETS).toEqual({
    HOME_PERIODS: 'fixed view: periods',
    HOME_VIEWS: "Home and Analysis are the two views of the phone's Home tab; the app ships both and no setting adds another.",
    SALES_PERIODS: 'fixed view: periods',
    THEME_CHOICES: 'fixed set: theme choice',
    CUSTOMER_TYPE_ICON_SET: 'fixed set: the neutral icon set ships with the app',
    PAYMENT_METHOD_ICON_SET:
      'fixed set: the payment-method icons ship with the app, the same closed set as the backend PaymentMethodIcon',
    STOCK_ENTRY_ORIGINS: 'fixed set: Stock entry origins',
    MONEY_DECIMALS: 'fixed set: the decimals a Business may write money with, 0 to 2',
    PAYMENT_STATES: 'fixed set: payment state, which is not a method',
    LANGUAGES:
      'fixed set: the languages the Copy module has texts for; adding one is a code change in the Copy module',
  })
})

test('every raw chip site names a registered set, a real file and a reason', () => {
  const sources = new Set(Object.keys(import.meta.glob('/src/**/*.tsx')))
  const declared = Object.keys(FIXED_SETS)
  expect(RAW_CHIP_SITES.map((site) => [site.file, site.set])).toEqual([
    ['src/components/HomeViewSwitch.tsx', 'HOME_VIEWS'],
    ['src/screens/settings/AppearanceGroup.tsx', 'THEME_CHOICES'],
    ['src/screens/settings/BusinessGroup.tsx', 'LANGUAGES'],
    ['src/screens/settings/CustomerTypeForm.tsx', 'CUSTOMER_TYPE_ICON_SET'],
    ['src/screens/settings/PaymentMethodForm.tsx', 'PAYMENT_METHOD_ICON_SET'],
    ['src/screens/StockEntryForm.tsx', 'STOCK_ENTRY_ORIGINS'],
  ])
  for (const site of RAW_CHIP_SITES) {
    expect(site.reason.trim(), site.file).not.toBe('')
    expect(declared, site.file).toContain(site.set)
    expect(sources.has(`/${site.file}`), site.file).toBe(true)
  }
})

test('a language switch moves the icon names and leaves the period and theme words', async () => {
  await switchToMarkers()
  expect(labels(HOME_PERIODS)).toEqual(['Today', 'Week', 'Month'])
  expect(labels(THEME_CHOICES)).toEqual([
    SETTINGS_TEXT.automatic,
    SETTINGS_TEXT.light,
    SETTINGS_TEXT.dark,
  ])
  for (const option of CUSTOMER_TYPE_ICON_SET) {
    expect(option.label()).toBe(`de:customerTypes.icon.${option.value}`)
  }
})

test('a raw chip site with a blank reason is refused at build, naming its file', () => {
  const site = { file: 'src/screens/Somewhere.tsx', set: 'THEME_CHOICES' } as const
  expect(() => rawSites([{ ...site, reason: '' }])).toThrow(
    'A raw chip site needs a reason: src/screens/Somewhere.tsx',
  )
  expect(() => rawSites([{ ...site, reason: '   ' }])).toThrow(
    'A raw chip site needs a reason: src/screens/Somewhere.tsx',
  )
  expect(rawSites([{ ...site, reason: 'draws its own chips' }])).toHaveLength(1)
})
