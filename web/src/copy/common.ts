/**
 * The words two or more sections say, defined once here and imported by the sections that
 * use them (ADR-0025: a screen never imports a message from another screen). A section
 * never copies a value this file owns.
 */

import type { LimitedCopy } from './limits'

/** The label of an icon-only close control and of a sheet's way out. */
export const CLOSE = 'Close'

/** The label of the button that saves a form that edits. */
export const SAVE = 'Save'

/** "Owed" with nobody owing: the Customers list and Home's panel. */
export const NOBODY_OWES = 'Nobody owes you'

/** The refusal of a form whose fields the API refused without a field of its own. */
export const GENERIC_REFUSAL_MESSAGE = 'Check the details and try again.'

/** One sentence that promises no automatic retry: the app performs none. */
export const NO_CONNECTION_MESSAGE = 'No connection: check your internet and try again.'

/** The generic server-error retry. */
export const RETRY_MESSAGE = 'Something went wrong. Try again.'

/** Shown after a save or a delete lands on a record that is gone: no id, name, date or
 * amount, so it reads the same whatever was deleted, foreign, or never existed (ADR-0004). */
export const GONE_NOTICE = "That's gone. The list is up to date."

/** Shown instead of a detail screen for a record that is gone, with no data of its own. */
export const GONE_DETAIL = "That's gone."

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: NOBODY_OWES },
  { kind: 'notice', text: NO_CONNECTION_MESSAGE },
  { kind: 'notice', text: RETRY_MESSAGE },
  { kind: 'notice', text: GONE_NOTICE },
  { kind: 'notice', text: GONE_DETAIL },
]
export const LONG_REFUSALS: readonly string[] = []
