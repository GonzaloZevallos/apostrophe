/**
 * Copy the getting-in screens share (ADR-0025). A screen never imports a message
 * constant from another screen: what two of them say lives here.
 */

import { SAMPLES, type LimitedCopy } from './limits'

export const WEAK_PASSWORD_MESSAGE = 'The password must have at least 10 characters'
export const DEAD_LINK_MESSAGE = 'This link no longer works. Ask whoever sent it for a new one.'
export const BRAKE_MESSAGE = '5 failed attempts · try again in 15 minutes'
export const LOGIN_HINT = 'After 5 failed attempts, the email is locked for 15 minutes'
export const INVITE_ONLY_LINE = 'To use apostrophe, a business has to invite you.'
export const expiryLine = (isNewBusiness: boolean, expiry: string): string =>
  isNewBusiness
    ? `The invitation can be used once and expires on ${expiry}.`
    : `This invitation expires on ${expiry} and can be used once.`
export const NOT_USABLE_TITLE = 'This invitation no longer works'
export const NOT_USABLE_DETAIL = 'It expired or somebody used it first. Ask the business for a new one.'

/** The getting-in screens' own words: labels, buttons, headings and inline refusals. */
export const TAGLINE = 'Your sales, your stock and what customers owe you.'
export const EMAIL_LABEL = 'Email'
export const PASSWORD_LABEL = 'Password'
export const NEW_PASSWORD_LABEL = 'New password'
export const CURRENT_PASSWORD_LABEL = 'Current password'
export const SIGN_IN = 'Sign in'
export const CREDENTIALS_WRONG = 'Wrong email or password'
export const EMAIL_TAKEN_MESSAGE = 'There is already an account with that email'
export const EMAIL_INVALID_MESSAGE = 'Enter a valid email'
export const WRONG_CURRENT_PASSWORD_MESSAGE = "That isn't the current password."
export const VALID_INVITATION = 'Valid invitation'
export const INVITED_TO = 'You were invited to'
export const SET_UP_BUSINESS = 'Set up your business'
export const NEW_BUSINESS_SUBTITLE = 'Name it and create your user. Later you can invite a partner.'
export const JOIN_SUBTITLE = "Create your user to see this business's sales, stock and customers only."
export const BUSINESS_NAME_LABEL = 'Business name'
export const CREATE_BUSINESS = 'Create the business'
export const joinBusiness = (business: string): string => `Join ${business}`
export const CHOOSE_NEW_PASSWORD = 'Choose your new password'
export const SAVE_AND_SIGN_IN = 'Save and sign in'
export const CHANGE_PASSWORD = 'Change password'
export const CANCEL = 'Cancel'

/** The always-visible notices here, measured by `copy/copyLimits.test.ts`. The weak-password
 * refusal stays out: it is an inline refusal, aimed at 80 and kept with its fix. */
export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'notice', text: DEAD_LINK_MESSAGE },
  { kind: 'notice', text: BRAKE_MESSAGE },
  { kind: 'help', text: LOGIN_HINT },
  { kind: 'help', text: INVITE_ONLY_LINE },
  { kind: 'help', text: expiryLine(true, SAMPLES.date) },
  { kind: 'help', text: expiryLine(false, SAMPLES.date) },
  { kind: 'notice', text: NOT_USABLE_TITLE },
  { kind: 'notice', text: NOT_USABLE_DETAIL },
]
export const LONG_REFUSALS: readonly string[] = []
