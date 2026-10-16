import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PANTALLAS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'product', 'design-system', 'pantallas')

// The app picks its theme from `data-tema` alone, never from the system (plan,
// subtask `light-by-default`): a stray `color_scheme` entry would silently emulate
// a dark system again, and a `tema` other than `'oscuro'` names a value the app
// does not recognise.
//
// `screen` is the unique key of an entry: its PNG name, its `--only` key and its
// heading. `design` names the file `pantallas/<design>.dc.html` it is compared
// against (default: `screen`); `section` is the exact label text of one block inside
// a design file that draws several states, and that block must exist in the file.
/**
 * @param {ReadonlyArray<Readonly<Record<string, unknown>>>} screens
 * @returns {void}
 */
export function assertScreens(screens) {
  const seen = new Set()
  for (const s of screens) {
    if ('color_scheme' in s) throw new Error(`${s.screen}: color_scheme is retired, use tema: 'oscuro'`)
    if ('tema' in s && s.tema !== 'oscuro') throw new Error(`${s.screen}: unknown tema ${JSON.stringify(s.tema)}`)
    if (seen.has(s.screen)) throw new Error(`${s.screen}: screen is not unique across the file`)
    seen.add(s.screen)
    if ('design' in s || 'section' in s) assertDesign(s)
    if ('account' in s) assertAccount(s)
    if ('account' in s && !reachesListo(s)) {
      throw new Error(`${s.screen}: only an entry that reaches ${LISTO} can name an account`)
    }
    if (reachesListo(s) && !('account' in s)) {
      throw new Error(`${s.screen}: an entry that reaches ${LISTO} must name an account of its own`)
    }
  }
}

// `account` names one of the sample's extra businesses (`facts.accounts`, written by the
// sample app). Its ids are La Huerta's, so an account entry may only use `{email}`.
/** @param {Readonly<Record<string, unknown>>} s */
function assertAccount(s) {
  if (typeof s.account !== 'string' || s.account === '') {
    throw new Error(`${s.screen}: account must be a non-empty string`)
  }
  if (s.signed_out) throw new Error(`${s.screen}: account cannot be used with signed_out`)
  const steps = Array.isArray(s.steps) ? s.steps : []
  const templates = [
    s.route,
    ...steps.flatMap((step) => [step?.fill?.value, step?.click, step?.wait]),
  ]
  for (const template of templates) {
    if (typeof template !== 'string') continue
    for (const [, name] of template.matchAll(/\{(\w+)\}/g)) {
      if (name !== 'email') throw new Error(`${s.screen}: an account entry can only use {email}, not {${name}}`)
    }
  }
}

// The entry that reaches the closing screen "Listo" ends its business's Onboarding for
// good (ADR-0036), so each business can serve one such entry per sample run.
const LISTO = 'OnboardingListo'
const DEFAULT_ACCOUNT = 'La Huerta'

// The one definition of "this entry reaches Listo": the design it is compared against,
// which is its own screen name unless `design` says otherwise.
/** @param {Readonly<Record<string, unknown>>} s */
function reachesListo(s) {
  return (s.design ?? s.screen) === LISTO
}

// Checks the selected entries against the account names the sample wrote, before any
// capture. The messages are fixed text: they name the screens, never a credential.
/**
 * @param {ReadonlyArray<Readonly<Record<string, unknown>>>} selected
 * @param {ReadonlyArray<string>} accountNames
 * @returns {void}
 */
export function assertSelectedAccounts(selected, accountNames) {
  const known = new Set(accountNames)
  for (const s of selected) {
    if (typeof s.account === 'string' && !known.has(s.account)) {
      throw new Error(`${s.screen}: account is not one of the sample's accounts`)
    }
  }
  /** @type {Map<string, unknown>} */
  const listoBy = new Map()
  for (const s of selected) {
    if (!reachesListo(s)) continue
    const owner = typeof s.account === 'string' ? s.account : DEFAULT_ACCOUNT
    const other = listoBy.get(owner)
    if (other !== undefined) {
      throw new Error(`${s.screen}: reaches ${LISTO} with the same account as ${other}, and one business reaches it once per run`)
    }
    listoBy.set(owner, s.screen)
  }
}

/** @param {Readonly<Record<string, unknown>>} s */
function assertDesign(s) {
  const design = 'design' in s ? s.design : s.screen
  if (typeof design !== 'string') throw new Error(`${s.screen}: design must be a string`)
  const file = join(PANTALLAS, `${design}.dc.html`)
  if (!existsSync(file)) throw new Error(`${s.screen}: design ${design} has no pantallas/${design}.dc.html`)
  if (!('section' in s)) return
  if (typeof s.section !== 'string') throw new Error(`${s.screen}: section must be a string`)
  // A label is a line of text of its own: the text between a tag's end and the next tag.
  if (!readFileSync(file, 'utf-8').includes(`>${s.section}<`)) {
    throw new Error(`${s.screen}: section ${JSON.stringify(s.section)} is not in ${design}.dc.html`)
  }
}
