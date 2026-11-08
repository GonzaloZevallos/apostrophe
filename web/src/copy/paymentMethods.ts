/**
 * The payment-method words: the pickers (New sale, Record payment) and Settings → Business →
 * Payment methods. The names of the methods themselves are the seller's data and never live
 * here. `{name}` and `{count}` stand for the seller's data, filled by the `*Of` functions below.
 */

import { baselineArgs } from './baselineArgs.ts'
import type * as Self from './paymentMethods.ts'
import { COMMON_TEXT } from './common.ts'
import { CUSTOMERS_TEXT } from './customers.ts'
import type { LimitedCopy } from './limits.ts'
import { STOCK_TEXT } from './stock.ts'
import { VARIETIES_TEXT } from './varieties.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const LONG_REFUSALS: readonly string[] = []

const N = 'Mercado Pago'

/** The fixture arguments of this file's functions, for `en.baseline.json` (`./baselineArgs.ts`). */
export const BASELINE_ARGS = baselineArgs<typeof Self>()({
  entryLabel: [[2]],
  moveUpLabel: [[N]],
  moveDownLabel: [[N]],
  rowLabel: [[N]],
  restoreLabel: [[N]],
  deleteTitle: [[N]],
})

/** Every text a person reads about payment methods, by key. */
export const PAYMENT_METHODS_TEXT = {
  /** The accessible name of the group of chips. */
  methodGroupLabel: 'Payment method',
  /** The accessible name of the placeholder while the list loads. */
  methodsLoading: 'Loading payment methods',
  /** The notice after a save was refused for a method that is gone. */
  errorMethodUnavailable: "That payment method isn't available any more. Pick another one.",

  /** Settings → Business: the entry row. */
  entryTitle: 'Payment methods',
  /** The screen (list). */
  title: 'Payment methods',
  subtitle: 'The ways you take money. New sale and Record payment offer them in this order.',
  back: COMMON_TEXT.settings,
  add: '+ Add method',
  archivedRow: COMMON_TEXT.archived,
  moveUp: 'Move up',
  moveDown: 'Move down',
  loading: 'Loading payment methods',
  loadError: "We couldn't load your payment methods.",
  retry: 'Try again',
  /** The add / edit Sheet. */
  addTitle: 'New payment method',
  close: COMMON_TEXT.close,
  save: COMMON_TEXT.save,
  nameLabel: COMMON_TEXT.name,
  iconLabel: 'Icon',
  iconWallet: 'Wallet',
  iconBank: 'Bank',
  iconCard: 'Card',
  iconCoins: 'Coins',
  iconPhone: CUSTOMERS_TEXT.phone,
  iconGeneric: 'Other',
  iconSelected: 'Selected',
  errorNameEmpty: 'Write a name for this method.',
  errorNameTooLong: 'Use 40 characters or fewer.',
  errorNameDuplicate: 'That name is taken, archived methods included. Restore it or pick another.',
  errorSaveFailed: "We couldn't save this method. Try again.",
  discardTitle: 'Discard your changes?',
  discardKeep: COMMON_TEXT.noKeepEditing,
  discardConfirm: COMMON_TEXT.yesDiscard,
  /** The remove actions. */
  archive: 'Archive',
  delete: STOCK_TEXT.borrar,
  deleteKeep: COMMON_TEXT.noKeep,
  deleteConfirm: COMMON_TEXT.yesDelete,
  deleteBody: "No payment uses it. This can't be undone.",
  errorLastActive: 'This is your only method. Add another one first.',
  errorInUse: 'A payment already uses this method, so it can only be archived.',
  /** The settings screen when a row it acts on is gone (the picker's own notice is errorMethodUnavailable). */
  errorNotFound: 'This payment method no longer exists.',
  errorMoveFailed: "We couldn't move this method. Try again.",
  errorActionFailed: "We couldn't do that. Try again.",
  /** The Archived view. */
  archivedTitle: 'Archived methods',
  archivedBack: 'Payment methods',
  restore: VARIETIES_TEXT.restaurar,
  restoreFailed: "We couldn't restore this method. Try again.",
} as const

/** The accessible name of the Settings → Business row. */
export function entryLabel(count: string | number): string {
  return `${PAYMENT_METHODS_TEXT.entryTitle}, ${count}`
}

export function moveUpLabel(name: string): string {
  return `Move ${name} up`
}

export function moveDownLabel(name: string): string {
  return `Move ${name} down`
}

export function rowLabel(name: string): string {
  return `Edit ${name}`
}

export function restoreLabel(name: string): string {
  return `Restore ${name}`
}

export function deleteTitle(name: string): string {
  return `Delete ${name}?`
}

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'notice', text: PAYMENT_METHODS_TEXT.errorMethodUnavailable },
  { kind: 'help', text: PAYMENT_METHODS_TEXT.subtitle },
  { kind: 'notice', text: PAYMENT_METHODS_TEXT.errorLastActive },
  { kind: 'notice', text: PAYMENT_METHODS_TEXT.errorInUse },
  { kind: 'notice', text: PAYMENT_METHODS_TEXT.errorNameDuplicate },
]
