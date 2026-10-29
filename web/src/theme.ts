/**
 * The device's theme choice (ADR-0026, amended by the owner's decision of 2026-10-29): the
 * only module that names `localStorage` and the only one that writes `data-tema` on `<html>`.
 *
 * One key, `tema`: `claro` is Light, `oscuro` is Dark. No key, any other stored value or a
 * storage error is Automatic, which follows the phone. The attribute carries the resolved
 * theme: none is light, `oscuro` is dark. Every storage access sits in `try/catch`, and
 * choosing still applies the attribute for the page's lifetime. Nothing here is tied to a
 * session or a business.
 *
 * The system's reading comes in through a port (`startAutomatic`), never from the browser
 * here. On Automatic the theme is re-resolved when the port reports a change, when the page
 * turns visible and on `pageshow`, since a page that was away can miss the change event. A
 * change made in another tab is picked up only when this one next loads.
 */

type Theme = 'claro' | 'oscuro'
type Choice = 'automatic' | 'light' | 'dark'

/** What the phone says: `isDark` is read fresh each time; `onChange` returns what stops it. */
export type SystemTheme = {
  isDark(): boolean
  onChange(cb: () => void): () => void
}

const KEY = 'tema'
const LIGHT = 'claro'
const DARK = 'oscuro'

/** The port until `startAutomatic` runs: a phone that reads light and never changes. */
const NULL_PORT: SystemTheme = { isDark: () => false, onChange: () => () => undefined }

let system: SystemTheme = NULL_PORT
/** Removes every subscription the following holds; null while the theme is not following. */
let stop: (() => void) | null = null

function applyResolved(theme: Theme): void {
  if (theme === DARK) document.documentElement.setAttribute('data-tema', DARK)
  else document.documentElement.removeAttribute('data-tema')
}

function readChoice(): Choice {
  try {
    const stored = window.localStorage.getItem(KEY)
    if (stored === LIGHT) return 'light'
    if (stored === DARK) return 'dark'
    return 'automatic'
  } catch {
    return 'automatic'
  }
}

/** The theme a choice shows, given what the phone says; pure. */
export function resolveTheme(choice: Choice, systemIsDark: boolean): Theme {
  if (choice === 'light') return LIGHT
  if (choice === 'dark') return DARK
  return systemIsDark ? DARK : LIGHT
}

function stopFollowing(): void {
  stop?.()
  stop = null
}

function resolveAutomatic(): void {
  applyResolved(resolveTheme('automatic', system.isDark()))
}

/** Follows the phone: one subscription and one listener pair, all removed by `stop`. */
function follow(): void {
  stopFollowing()
  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') resolveAutomatic()
  }
  const unsubscribe = system.onChange(resolveAutomatic)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pageshow', resolveAutomatic)
  stop = () => {
    unsubscribe()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pageshow', resolveAutomatic)
  }
  resolveAutomatic()
}

/** The theme the page shows now, for a control that marks it; the attribute stays this module's. */
export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-tema') === DARK ? DARK : LIGHT
}

/** What the device chose, read from storage: Automatic where nothing usable is stored. */
export function currentChoice(): Choice {
  return readChoice()
}

/** Boot: remembers the phone's port, applies the stored choice and follows the phone on Automatic. */
export function startAutomatic(port: SystemTheme): void {
  stopFollowing()
  system = port
  const choice = readChoice()
  if (choice === 'automatic') follow()
  else applyResolved(resolveTheme(choice, false))
}

/** Automatic: forgets the stored choice, follows the phone and resolves at once. */
export function followSystem(): void {
  stopFollowing()
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing stored to forget, or no way to forget it; the page still follows the phone.
  }
  follow()
}

/** Light or Dark: stops following the phone, applies the choice and stores it. */
export function chooseTheme(theme: Theme): void {
  stopFollowing()
  applyResolved(theme)
  try {
    window.localStorage.setItem(KEY, theme)
  } catch {
    // The choice holds for this page only; nothing is stored and nothing is reported.
  }
}
