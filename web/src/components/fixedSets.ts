/**
 * The one registry of every set that may still render as chips, tabs or segmented buttons
 * (ADR-0074). A control that draws chips takes a `FixedSet`, and a `FixedSet` can only be built
 * here, by the unexported `fixedSet(reason, options)`, which refuses a blank reason: the type
 * carries an unexported `unique symbol` brand, so a mapped array or a hand-written object does
 * not compile. A set read from the business's data or settings (languages the business offers,
 * Payment methods, Customer types, reasons, categories) can grow, so it is never declared here:
 * the Selector is the control for those.
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
import { CUSTOMER_TYPE_ICON_NAME } from '../copy/customers'
import { SALES_TEXT } from '../copy/sales'
import { SETTINGS_TEXT } from '../copy/settings'
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

const PERIODS_REASON = 'fixed view: periods'
const THEME_REASON = 'fixed set: theme choice'
const ICONS_REASON = 'fixed set: the neutral icon set ships with the app'

/** Home's period tabs. */
export const HOME_PERIODS = fixedSet(PERIODS_REASON, [
  { value: 'today', label: () => COMMON_TEXT.today },
  { value: 'week', label: () => COMMON_TEXT.week },
  { value: 'month', label: () => COMMON_TEXT.month },
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

/** Every declared set and the reason it is fixed, readable in one place. */
export const FIXED_SETS = {
  HOME_PERIODS: PERIODS_REASON,
  SALES_PERIODS: PERIODS_REASON,
  THEME_CHOICES: THEME_REASON,
  CUSTOMER_TYPE_ICON_SET: ICONS_REASON,
} as const
