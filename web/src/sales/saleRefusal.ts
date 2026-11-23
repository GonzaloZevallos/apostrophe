/**
 * What a refused sale save means, decided in one place: the sale form and the Collect Sheet both
 * ask here whether the chosen Payment method is no longer available (archived or deleted since the
 * list was read), so neither keeps its own table entry for that code.
 */

import { ApiError } from '../api/client'

/** True only for the server's answer that the chosen payment method is no longer available. */
export function isMethodUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'payment_method.unavailable'
}
