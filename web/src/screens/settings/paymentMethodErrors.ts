/**
 * What each refusal of the payment-methods routes says on the settings screen. A code that is
 * not listed reads as the generic "could not do that"; the server's `detail` is never shown.
 * `payment_method.not_found` is not a message: the screen goes back to the list and reads it again.
 */

import { PAYMENT_METHODS_TEXT } from '../../copy/paymentMethods'

const BY_CODE: Readonly<Record<string, string>> = {
  'payment_method.name_empty': PAYMENT_METHODS_TEXT.errorNameEmpty,
  'payment_method.name_too_long': PAYMENT_METHODS_TEXT.errorNameTooLong,
  'payment_method.name_taken': PAYMENT_METHODS_TEXT.errorNameDuplicate,
  'payment_method.last_active': PAYMENT_METHODS_TEXT.errorLastActive,
  'payment_method.in_use': PAYMENT_METHODS_TEXT.errorInUse,
}

export const NOT_FOUND_CODE = 'payment_method.not_found'

/** The words of a refusal code, or `fallback` for a code with none of its own. */
export function refusalMessage(code: string, fallback: string): string {
  return Object.hasOwn(BY_CODE, code) ? BY_CODE[code]! : fallback
}
