/**
 * What the phone says about light or dark: the `SystemTheme` port `theme.ts` takes
 * (`startAutomatic`). The only module that calls `matchMedia('(prefers-color-scheme: dark)')`;
 * `theme.ts` never imports it, so a test hands `theme.ts` a fake port instead.
 *
 * Where `matchMedia` does not exist the system reads light and nothing ever changes.
 */

import type { SystemTheme } from '../theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function hasMatchMedia(): boolean {
  return typeof window.matchMedia === 'function'
}

export const systemTheme: SystemTheme = {
  isDark: () => hasMatchMedia() && window.matchMedia(DARK_QUERY).matches,
  onChange(cb) {
    if (!hasMatchMedia()) return () => undefined
    const query = window.matchMedia(DARK_QUERY)
    query.addEventListener('change', cb)
    return () => query.removeEventListener('change', cb)
  },
}
