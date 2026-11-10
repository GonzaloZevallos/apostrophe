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
  const everyValue = Object.values(registry).flatMap((set) =>
    Array.isArray(set) ? values(set as readonly FixedOption<string>[]) : [],
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
    .filter(([name, exported]) => name !== 'FIXED_SETS' && Array.isArray(exported))
    .map(([name]) => name)
  expect(Object.keys(FIXED_SETS).sort()).toEqual(exportedSets.sort())
  for (const [name, reason] of Object.entries(FIXED_SETS)) {
    expect(reason.trim(), name).not.toBe('')
  }
  expect(FIXED_SETS).toEqual({
    HOME_PERIODS: 'fixed view: periods',
    SALES_PERIODS: 'fixed view: periods',
    THEME_CHOICES: 'fixed set: theme choice',
    CUSTOMER_TYPE_ICON_SET: 'fixed set: the neutral icon set ships with the app',
    STOCK_ENTRY_ORIGINS: 'fixed set: Stock entry origins',
    PAYMENT_STATES: 'fixed set: payment state, which is not a method',
  })
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
