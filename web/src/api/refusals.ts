/**
 * Dispatches a backend refusal's `code` on its `kind` (plan, "Refusals", ADR-0007):
 * a screen never renders `detail`. `contract.json` is the shared contract the
 * backend's own tests check itself against (`tests/test_refusal_codes.py`), so a
 * rename on either side fails a check instead of quietly falling back here.
 */

import contract from './contract.json'

export type RefusalKind = 'refusal' | 'gone'

/** Every code the backend can answer with, exactly as `contract.json` lists them
 * (its keys, not widened to a bare `string`): a screen that overrides a renamed or
 * misspelt code fails `tsc` here, not silently at runtime. */
export type RefusalCode = keyof (typeof contract)['refusalCodes']

// The contract's own values are always one of RefusalKind — the backend's own test
// checks it (`tests/test_refusal_codes.py`) — so only the `kind` field's literal type
// needs this assertion. `RefusalCode` above is derived before this cast and is never
// itself widened: it stays exactly contract.json's own set of keys.
const refusalCodes = contract.refusalCodes as Record<RefusalCode, { kind: RefusalKind }>

function isRefusalCode(code: string): code is RefusalCode {
  return code in refusalCodes
}

/** Shown after a save or a delete lands on a record that is gone (plan, "Gone
 * records"): no id, name, date or amount, so it reads the same whatever was
 * deleted, foreign, or never existed (ADR-0004). Not a success toast. */
export const GONE_NOTICE = 'Eso ya no está. La lista ya está al día.'

/** Shown instead of a detail screen for a record that is gone, with no data of its
 * own (plan, "Gone records"). */
export const GONE_DETAIL = 'Eso ya no está.'

/** A code's kind, from the shared contract. The parameter stays a plain `string`
 * because a code comes in untyped off the wire (`ApiError.code`); a code the
 * contract does not list is never read as `'gone'`: an unrecognised refusal must
 * still read as a refusal, not silently vanish a record that is still there. */
export function kindOf(code: string): RefusalKind {
  return isRefusalCode(code) ? refusalCodes[code].kind : 'refusal'
}

export function isGone(code: string): boolean {
  return kindOf(code) === 'gone'
}

/**
 * A screen overrides how one or more codes are handled by naming them here instead
 * of relying on the kind's default (plan, "Refusals": "A screen may override how a
 * code is handled, by naming the code."). `overrides` is typed on `RefusalCode`, so
 * naming a code the contract does not list — a typo, or one renamed on the backend
 * side — fails `tsc` in the screen that wrote it, instead of silently falling back
 * to the generic kind-based text at runtime.
 */
export function resolveOverride<T>(
  overrides: Partial<Record<RefusalCode, T>>,
  code: string,
): T | undefined {
  return isRefusalCode(code) ? overrides[code] : undefined
}
