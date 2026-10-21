/**
 * Copy the getting-in screens share (ADR-0025). A screen never imports a message
 * constant from another screen: what two of them say lives here.
 */

import { SAMPLES, type LimitedCopy } from './limits'

export const LANGUAGE: 'es' | 'en' = 'en'

/** The product's name: a brand, not a translated word, so it has no Spanish twin. */
export const BRAND_NAME = 'apostrophe'

export const WEAK_PASSWORD_MESSAGE = 'The password needs at least 10 characters'
export const DEAD_LINK_MESSAGE = 'This link no longer works. Ask whoever sent it for a new one.'
export const BRAKE_MESSAGE = '5 failed attempts · try again in 15 minutes'
export const LOGIN_HINT = 'After 5 failed attempts, the email is blocked for 15 minutes'
export const INVITE_ONLY_LINE = 'To use apostrophe, a business has to invite you.'
export const expiryLine = (isNewBusiness: boolean, expiry: string): string =>
  isNewBusiness
    ? `The invitation can be used once and expires on ${expiry}.`
    : `This invitation expires on ${expiry} and can be used once.`
export const NOT_USABLE_TITLE = 'This invitation no longer works'
export const NOT_USABLE_DETAIL = 'It expired or someone used it first. Ask the business to send you a new one.'

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

/** Every text a person reads in this area that is not a named message above, by key. */
export const AUTH_TEXT = {
  currentPassword: 'Current password',
  newPassword: 'New password',
  tagline: 'Your sales, your stock and what you are owed.',
  emailAddress: 'Email address',
  password: 'Password',
  signIn: 'Sign in',
  setUpYourBusiness: 'Set up your business',
  createTheBusiness: 'Create the business',
  joinBusiness: (business_name: string | number | null) => `Join ${business_name}`,
  goToSignIn: 'Go to sign in',
  chooseYourNewPassword: 'Choose your new password',
  saveAndSignIn: 'Save and sign in',
  currentPasswordWrong: 'That is not the current password.',
  wrongEmailOrPassword: 'Wrong email or password',
  emailTaken: 'An account with that email already exists',
  enterValidEmail: 'Enter a valid email',
  validInvitation: 'Valid invitation',
  youWereInvitedTo: 'You were invited to',
  nameItAndCreate: 'Name it and create your user. Then you can invite a partner.',
  createYourUser: "Create your user and you'll see this business's sales, stock and customers. Only this one's.",
} as const
