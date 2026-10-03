/**
 * Dispatches a backend refusal's `code` on its `kind` (plan, "Refusals", ADR-0007):
 * a screen never renders `detail`. `contract.json` is the shared contract the
 * backend's own tests check itself against (`tests/test_refusal_codes.py`), so a
 * rename on either side fails a check instead of quietly falling back here.
 */

import contract from './contract.json'

export type RefusalKind = 'refusal' | 'gone'

interface Contract {
  refusalCodes: Record<string, { kind: RefusalKind }>
}

const typedContract = contract as Contract

/** Shown after a save or a delete lands on a record that is gone (plan, "Gone
 * records"): no id, name, date or amount, so it reads the same whatever was
 * deleted, foreign, or never existed (ADR-0004). Not a success toast. */
export const GONE_NOTICE = 'Eso ya no está. La lista ya está al día.'

/** Shown instead of a detail screen for a record that is gone, with no data of its
 * own (plan, "Gone records"). */
export const GONE_DETAIL = 'Eso ya no está.'

/** A code's kind. A code the contract does not list is never read as `'gone'`: an
 * unrecognised refusal must still read as a refusal, not silently vanish a record
 * that is still there. */
export function kindOf(code: string): RefusalKind {
  return typedContract.refusalCodes[code]?.kind ?? 'refusal'
}

export function isGone(code: string): boolean {
  return kindOf(code) === 'gone'
}
