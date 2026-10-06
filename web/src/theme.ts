/**
 * The device's theme choice (ADR-0024): the only module that names `localStorage` and the
 * only one that touches `data-tema` on `<html>`.
 *
 * One key, `tema`, whose only stored value is `oscuro`. Claro removes the key. Any other
 * stored value (`claro`, stale, tampered) reads as light and is left alone. Every storage
 * access sits in `try/catch`: an error gives light, and choosing still applies the
 * attribute for the page's lifetime. Nothing here is tied to a session or a business.
 */

type Theme = 'claro' | 'oscuro'

const KEY = 'tema'
const DARK = 'oscuro'

function setAttribute(theme: Theme): void {
  if (theme === 'oscuro') document.documentElement.setAttribute('data-tema', DARK)
  else document.documentElement.removeAttribute('data-tema')
}

function readStored(): Theme {
  try {
    return window.localStorage.getItem(KEY) === DARK ? 'oscuro' : 'claro'
  } catch {
    return 'claro'
  }
}

export function applyStoredTheme(): void {
  setAttribute(readStored())
}

export function chooseTheme(theme: Theme): void {
  setAttribute(theme)
  try {
    if (theme === 'oscuro') window.localStorage.setItem(KEY, DARK)
    else window.localStorage.removeItem(KEY)
  } catch {
    // The choice holds for this page only; nothing is stored and nothing is reported.
  }
}
