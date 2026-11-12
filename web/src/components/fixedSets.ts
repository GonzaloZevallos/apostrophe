/**
 * The one registry of every set that may still render as chips, tabs or segmented buttons
 * (ADR-0074). A control that draws chips takes a `FixedSet`, and a `FixedSet` can only be built
 * here, by the unexported `fixedSet(reason, options)`, which refuses a blank reason: the type
 * carries an unexported `unique symbol` brand, so a mapped array or a hand-written object does
 * not compile. A set read from the business's data or settings (which languages a business may
 * choose, which is the server's Selectable list, Payment methods, Customer types, reasons,
 * categories) can grow, so it is never declared here: the Selector is the control for those. The
 * shipped languages are fixed (adding one is a code change in the Copy module) and the server's
 * list only narrows them.
 *
 * An option holds only what is fixed: its `value`, a `label` getter and an optional icon. A
 * getter reads the same copy source its site read before and runs in render, never at load,
 * so a language switch is picked up by the next render. What a site does on a tap, or whether
 * an option is disabled, lives in an overlay keyed by `value` in that site, never here.
 *
 * This module imports only from `src/copy/` and the `NombreIcono` type (`architecture/
 * choiceControls.ts` checks it): no hook, no `api/`, no query, no settings.
 */

import { COMMON_TEXT } from '../copy/common'
import { CUSTOMER_TYPE_ICON_NAME } from '../copy/readers/customerTypeIcons'
import { HOME_VIEW_NAME } from '../copy/readers/homeViews'
import { PAYMENT_STATE_NAME } from '../copy/readers/paymentStates'
import { SHIPPED_LANGUAGE_TAGS } from '../copy/readers/shippedLanguages'
import { SALES_TEXT } from '../copy/sales'
import { languageName, phoneCountryName, SETTINGS_TEXT } from '../copy/settings'
import type { NombreIcono } from './Icono'

export interface FixedOption<T extends string> {
  readonly value: T
  readonly label: () => string
  readonly icon?: NombreIcono
}

const brand: unique symbol = Symbol('FixedSet')

export type FixedSet<T extends string> = readonly FixedOption<T>[] & { readonly [brand]: true }

/** The values a set holds, as the union its consumer types its state with. */
export type FixedValue<S> = S extends FixedSet<infer T> ? T : never

function fixedSet<const T extends string>(
  reason: string,
  options: readonly FixedOption<T>[],
): FixedSet<T> {
  if (reason.trim() === '') throw new Error('A fixed set needs a reason')
  return Object.assign([...options], { [brand]: true as const })
}

const HOME_VIEWS_REASON = 'fixed set: the two views of Home, Today and Analysis'
const PHONE_COUNTRIES_REASON =
  'fixed set: the Phone countries the shared rules table holds and the Copy module names; adding one is a code change'
const PERIODS_REASON = 'fixed view: periods'
const THEME_REASON = 'fixed set: theme choice'
const ICONS_REASON = 'fixed set: the neutral icon set ships with the app'
const ORIGINS_REASON = 'fixed set: Stock entry origins'
const MONEY_DECIMALS_REASON = 'fixed set: the decimals a Business may write money with, 0 to 2'
const PAYMENT_STATE_REASON = 'fixed set: payment state, which is not a method'
const LANGUAGES_REASON =
  'fixed set: the languages the Copy module has texts for; adding one is a code change in the Copy module'

/** Home's period tabs. */
export const HOME_PERIODS = fixedSet(PERIODS_REASON, [
  { value: 'today', label: () => COMMON_TEXT.today },
  { value: 'week', label: () => COMMON_TEXT.week },
  { value: 'month', label: () => COMMON_TEXT.month },
])

/** Home's Today | Analysis switch on the phone. */
export const HOME_VIEWS = fixedSet(HOME_VIEWS_REASON, [
  { value: 'today', label: HOME_VIEW_NAME.today },
  { value: 'analysis', label: HOME_VIEW_NAME.analysis },
])

/** The value of the "No country" option of the Phone country control. */
export const NO_COUNTRY = 'none'

/** Settings' Phone country choice: "No country", then the countries the Copy module names; the API's list narrows it. */
export const PHONE_COUNTRIES = fixedSet<string>(PHONE_COUNTRIES_REASON, [
  { value: NO_COUNTRY, label: () => SETTINGS_TEXT.phoneCountryNone },
  ...['AR', 'UY', 'CL', 'PY', 'BR', 'MX', 'ES', 'US'].map((code) => ({ value: code, label: () => phoneCountryName(code) })),
])

/** Sales' period tabs. */
export const SALES_PERIODS = fixedSet(PERIODS_REASON, [
  { value: 'hoy', label: () => COMMON_TEXT.today },
  { value: 'semana', label: () => COMMON_TEXT.week },
  { value: 'mes', label: () => COMMON_TEXT.month },
  { value: 'fechas', label: () => SALES_TEXT.dates },
])

/** Settings' Appearance choice. */
export const THEME_CHOICES = fixedSet(THEME_REASON, [
  { value: 'automatic', label: () => SETTINGS_TEXT.automatic },
  { value: 'light', label: () => SETTINGS_TEXT.light },
  { value: 'dark', label: () => SETTINGS_TEXT.dark },
])

/** The customer-type icon grid, in the order the picker shows it. */
export const CUSTOMER_TYPE_ICON_SET = fixedSet(ICONS_REASON, [
  { value: 'circle', icon: 'circulo', label: CUSTOMER_TYPE_ICON_NAME.circle },
  { value: 'star', icon: 'estrella', label: CUSTOMER_TYPE_ICON_NAME.star },
  { value: 'heart', icon: 'corazon', label: CUSTOMER_TYPE_ICON_NAME.heart },
  { value: 'diamond', icon: 'rombo', label: CUSTOMER_TYPE_ICON_NAME.diamond },
  { value: 'flag', icon: 'bandera', label: CUSTOMER_TYPE_ICON_NAME.flag },
  { value: 'tag', icon: 'etiqueta', label: CUSTOMER_TYPE_ICON_NAME.tag },
  { value: 'crown', icon: 'corona', label: CUSTOMER_TYPE_ICON_NAME.crown },
  { value: 'bell', icon: 'campana', label: CUSTOMER_TYPE_ICON_NAME.bell },
])

/** The origin pills of a Stock entry. */
export const STOCK_ENTRY_ORIGINS = fixedSet(ORIGINS_REASON, [
  { value: 'purchase', label: () => COMMON_TEXT.purchase },
  { value: 'harvest', label: () => COMMON_TEXT.harvest },
  { value: 'opening_stock', label: () => COMMON_TEXT.initialStock },
  { value: 'adjustment', label: () => COMMON_TEXT.adjustment },
])

/** New sale's Paid · Owing: the state of how it was paid. The Payment method is not here. */
export const PAYMENT_STATES = fixedSet(PAYMENT_STATE_REASON, [
  { value: 'paid', label: PAYMENT_STATE_NAME.paid },
  { value: 'owing', label: PAYMENT_STATE_NAME.owing },
])

/** Settings' language choice: the shipped languages, which the server's Selectable list narrows. */
export const LANGUAGES = fixedSet(
  LANGUAGES_REASON,
  SHIPPED_LANGUAGE_TAGS.map((tag) => ({ value: tag, label: () => languageName(tag) })),
)

/** A screen that draws a declared set as chips itself, not through SegmentedChoice or Pestanas. */
export interface RawChipSite {
  /** The path from `web/`. */
  readonly file: string
  /** The set the site maps to draw its chips. */
  readonly set: keyof typeof FIXED_SETS
  /** Why the site draws the chips itself. */
  readonly reason: string
}

export function rawSites(sites: readonly RawChipSite[]): readonly RawChipSite[] {
  for (const site of sites) {
    if (site.reason.trim() === '') throw new Error(`A raw chip site needs a reason: ${site.file}`)
  }
  return sites
}

/**
 * The only screens besides SegmentedChoice and Pestanas that may carry a chip class, a radio or
 * tab role or a pressed state (`architecture/choiceControls.ts` reads this list). In each, the
 * markup maps the registered set and nothing else.
 */
export const RAW_CHIP_SITES = rawSites([
  {
    file: 'src/screens/settings/PhoneCountryControl.tsx',
    set: 'PHONE_COUNTRIES',
    reason: 'the control narrows the set by the API list and shows a check beside the selected row',
  },
  {
    file: 'src/components/HomeViewSwitch.tsx',
    set: 'HOME_VIEWS',
    reason: 'the switch draws its two segments as links to the Home routes, which a button chip cannot be',
  },
  {
    file: 'src/screens/settings/AppearanceGroup.tsx',
    set: 'THEME_CHOICES',
    reason: 'the Theme choice draws its own radio chips with the theme swatch classes',
  },
  {
    file: 'src/screens/settings/BusinessGroup.tsx',
    set: 'LANGUAGES',
    reason: 'the language control narrows the set by the server list and disables the saving state itself',
  },
  {
    file: 'src/screens/settings/CustomerTypeForm.tsx',
    set: 'CUSTOMER_TYPE_ICON_SET',
    reason: 'the icon grid draws each option as an icon button with its own accessible name',
  },
  {
    file: 'src/screens/StockEntryForm.tsx',
    set: 'STOCK_ENTRY_ORIGINS',
    reason: 'the origin pills and the fixed Initial stock pill share the form origin layout',
  },
])

/** Currency and decimals' Decimals choice. */
export const MONEY_DECIMALS = fixedSet(MONEY_DECIMALS_REASON, [
  { value: '0', label: () => SETTINGS_TEXT.currencyDecimals0 },
  { value: '1', label: () => SETTINGS_TEXT.currencyDecimals1 },
  { value: '2', label: () => SETTINGS_TEXT.currencyDecimals2 },
])

/** Every declared set and the reason it is fixed, readable in one place. */
export const FIXED_SETS = {
  HOME_PERIODS: PERIODS_REASON,
  HOME_VIEWS: HOME_VIEWS_REASON,
  PHONE_COUNTRIES: PHONE_COUNTRIES_REASON,
  SALES_PERIODS: PERIODS_REASON,
  THEME_CHOICES: THEME_REASON,
  CUSTOMER_TYPE_ICON_SET: ICONS_REASON,
  STOCK_ENTRY_ORIGINS: ORIGINS_REASON,
  PAYMENT_STATES: PAYMENT_STATE_REASON,
  LANGUAGES: LANGUAGES_REASON,
  MONEY_DECIMALS: MONEY_DECIMALS_REASON,
} as const
