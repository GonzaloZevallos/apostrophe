import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEXT_SCALE } from './textScale.mjs'

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
  const all = new Set(screens.map((s) => s.screen))
  const seen = new Set()
  for (const s of screens) {
    if ('color_scheme' in s) throw new Error(`${s.screen}: color_scheme is retired, use tema: 'oscuro'`)
    if ('tema' in s && s.tema !== 'oscuro') throw new Error(`${s.screen}: unknown tema ${JSON.stringify(s.tema)}`)
    if (seen.has(s.screen)) throw new Error(`${s.screen}: screen is not unique across the file`)
    seen.add(s.screen)
    if ('text_scale' in s && s.text_scale !== TEXT_SCALE) {
      throw new Error(`${s.screen}: text_scale must be exactly ${TEXT_SCALE}`)
    }
    if ('viewport' in s && !isViewport(s.viewport)) {
      throw new Error(`${s.screen}: viewport must be two positive integers, width and height`)
    }
    if ('steps' in s) assertSteps(s)
    if ('needs' in s) assertNeeds(s, all, seen)
    if ('design' in s || 'section' in s) assertDesign(s)
    if ('account' in s) assertAccount(s)
    if (reachesListo(s) && !('account' in s)) {
      throw new Error(`${s.screen}: an entry that reaches ${LISTO} must name an account of its own`)
    }
  }
}

/** @param {unknown} value */
function isViewport(value) {
  return Array.isArray(value) && value.length === 2 && value.every((n) => Number.isInteger(n) && n > 0)
}

// How many times a label stands as a line of text of its own in a design file's source:
// the text between a tag's end and the next tag, written literally (`&middot;` is not `·`).
// An early static guard only: the DOM count in comparisons.mjs decides the crop.
/**
 * @param {string} html
 * @param {string} label
 * @returns {number}
 */
export function sectionOccurrences(html, label) {
  return html.split(`>${label}<`).length - 1
}

// Every step is an object with exactly one key, from one closed list. A refusal names the
// entry and the step's index, never the step's data.
const STRING_STEPS = ['click', 'press', 'wait']
const STEP_KEYS = [...STRING_STEPS, 'fill', 'select', 'offline']

/** @param {unknown} value */
const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
/** @param {unknown} value */
const isText = (value) => typeof value === 'string' && value !== ''

/**
 * @param {unknown} value
 * @param {ReadonlyArray<string>} keys
 */
const hasExactly = (value, keys) =>
  isPlainObject(value) && Object.keys(/** @type {object} */ (value)).sort().join() === [...keys].sort().join()

/** @param {Readonly<Record<string, unknown>>} s */
function assertSteps(s) {
  if (!Array.isArray(s.steps)) throw new Error(`${s.screen}: steps must be a list`)
  s.steps.forEach((step, index) => {
    const at = `${s.screen}: step ${index}`
    if (!isPlainObject(step)) throw new Error(`${at} must be an object`)
    const keys = Object.keys(step)
    if (keys.length !== 1) throw new Error(`${at} must have exactly one key`)
    const key = /** @type {string} */ (keys[0])
    if (!STEP_KEYS.includes(key)) throw new Error(`${at} is not one of ${STEP_KEYS.join(', ')}`)
    const value = step[key]
    if (STRING_STEPS.includes(key) && !isText(value)) throw new Error(`${at} ${key} must be a non-empty string`)
    if (key === 'fill' && !(hasExactly(value, ['label', 'value']) && typeof value.label === 'string' && typeof value.value === 'string')) {
      throw new Error(`${at} fill must be exactly {label, value}, both strings`)
    }
    if (key === 'select' && !(hasExactly(value, ['label', 'index']) && typeof value.label === 'string' && Number.isInteger(value.index) && value.index >= 0)) {
      throw new Error(`${at} select must be exactly {label, index}, a string and a non-negative integer`)
    }
    if (key === 'offline' && value !== true) throw new Error(`${at} offline must be true`)
  })
}

// `needs` names the earlier entry whose state this one relies on (a capture runs the whole
// file in order over one sample). `seen` holds the entries up to and including `s`, so a
// target outside it is later in the file, or `s` itself.
/**
 * @param {Readonly<Record<string, unknown>>} s
 * @param {ReadonlySet<unknown>} all
 * @param {ReadonlySet<unknown>} seen
 */
function assertNeeds(s, all, seen) {
  if (typeof s.needs !== 'string' || s.needs === '') {
    throw new Error(`${s.screen}: needs must be a non-empty string`)
  }
  if (!all.has(s.needs)) throw new Error(`${s.screen}: needs names ${s.needs}, which is not a screen of the file`)
  if (s.needs === s.screen || !seen.has(s.needs)) {
    throw new Error(`${s.screen}: needs names ${s.needs}, which is not earlier in the file`)
  }
}

// A selection (`--only`) that keeps an entry but drops the one it needs would capture it
// over the wrong state, so it is refused before any capture. `all` is the whole file.
/**
 * @param {ReadonlyArray<Readonly<Record<string, unknown>>>} selected
 * @param {ReadonlyArray<Readonly<Record<string, unknown>>>} all
 * @returns {void}
 */
export function assertSelectedNeeds(selected, all) {
  const names = new Set(selected.map((s) => s.screen))
  const known = new Set(all.map((s) => s.screen))
  for (const s of selected) {
    if (typeof s.needs !== 'string') continue
    if (!known.has(s.needs)) throw new Error(`${s.screen}: needs names ${s.needs}, which is not a screen of the file`)
    if (!names.has(s.needs)) {
      throw new Error(`${s.screen}: needs ${s.needs}, which is not in the selection`)
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
    ...steps.flatMap((step) => [step?.fill?.value, step?.click, step?.press, step?.wait]),
  ]
  for (const template of templates) {
    if (typeof template !== 'string') continue
    for (const [, name] of template.matchAll(/\{(\w+)\}/g)) {
      if (name !== 'email') throw new Error(`${s.screen}: an account entry can only use {email}, not {${name}}`)
    }
  }
}

// The entry that reaches the closing screen "Listo" ends its business's Onboarding for
// good (ADR-0036), so each `open` business can serve one such entry per sample run. An
// `ended` business (its Onboarding ended at seed time) serves read-only entries and no
// Listo entry.
const LISTO = 'OnboardingListo'
const DEFAULT_ACCOUNT = 'La Huerta'

// The one definition of "this entry reaches Listo": the design it is compared against,
// which is its own screen name unless `design` says otherwise.
/** @param {Readonly<Record<string, unknown>>} s */
function reachesListo(s) {
  return (s.design ?? s.screen) === LISTO
}

const KINDS = ['open', 'ended']

// The sample writes each account's kind in `facts.account_kinds`. A refusal names the
// account, never its credential, and never prints the value it refused.
/**
 * @param {Readonly<Record<string, unknown>>} accounts
 * @param {unknown} kinds
 * @returns {void}
 */
export function assertAccountKinds(accounts, kinds) {
  if (!isPlainObject(kinds)) throw new Error('the sample has no account_kinds, rerun scripts/design/sample-app.sh')
  const table = /** @type {Readonly<Record<string, unknown>>} */ (kinds)
  for (const name of Object.keys(accounts)) {
    if (!(name in table)) throw new Error(`account ${name} has no kind in account_kinds`)
  }
  for (const [name, kind] of Object.entries(table)) {
    if (!(name in accounts)) throw new Error(`account_kinds names ${name}, which is not one of the sample's accounts`)
    if (!KINDS.includes(/** @type {string} */ (kind))) throw new Error(`account ${name} must have the kind open or ended`)
  }
}

// Checks the selected entries against the account kinds the sample wrote, before any
// capture. The messages are fixed text: they name the screens, never a credential.
/**
 * @param {ReadonlyArray<Readonly<Record<string, unknown>>>} selected
 * @param {Readonly<Record<string, 'open' | 'ended'>>} kinds
 * @returns {void}
 */
export function assertSelectedAccounts(selected, kinds) {
  for (const s of selected) {
    if (typeof s.account !== 'string') continue
    if (!Object.hasOwn(kinds, s.account)) {
      throw new Error(`${s.screen}: account is not one of the sample's accounts`)
    }
    const kind = kinds[s.account]
    if (reachesListo(s) && kind !== 'open') {
      throw new Error(`${s.screen}: reaches ${LISTO} on an ended account, and a Listo entry needs an open one`)
    }
    if (!reachesListo(s) && kind === 'open') {
      throw new Error(`${s.screen}: names an open account but does not reach ${LISTO}, so only an ended account can serve it`)
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
  const occurrences = sectionOccurrences(readFileSync(file, 'utf-8'), s.section)
  if (occurrences === 0) {
    throw new Error(`${s.screen}: section ${JSON.stringify(s.section)} is not in ${design}.dc.html`)
  }
  if (occurrences > 1) {
    throw new Error(
      `${s.screen}: section ${JSON.stringify(s.section)} occurs ${occurrences} times in ${design}.dc.html, expected exactly once`,
    )
  }
}
