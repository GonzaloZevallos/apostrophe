import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import './styles/tokens.css'
import './styles/app.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { bootLanguage, startLanguage } from './i18n/language'
import { startKeepFocusVisible } from './shell/keepFocusVisible'
import { startAutomatic } from './theme'
import { systemTheme } from './theme/systemTheme'
import { startThemeSync } from './theme/theme'

const root = document.getElementById('root')
if (root === null) throw new Error('index.html has no #root')

// ADR-0026, as the owner's decision of 2026-10-29 amends it: the device's theme before the
// first render, Entrar included, and all of it before anything is awaited. With nothing
// stored the theme follows the phone. There is no inline script and no `color-scheme` meta,
// so a dark phone with nothing stored may show one light frame: that is the accepted cost.
startAutomatic(systemTheme)
startThemeSync()
startKeepFocusVisible()

// ADR-0050: the server writes `<html lang>`; any language other than English is one chunk,
// awaited before the first render so Entrar never flashes in English. A failed or slow chunk
// ends in English (`startLanguage` never rejects), so the page always renders.
if (bootLanguage !== 'en') await startLanguage()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Installable, with no offline mode (plan, "Install"): registered only on a secure
// origin. On the home network over plain http, `isSecureContext` is false and this
// does nothing — the full Android install arrives once the app is published with TLS
// (ADR-0002); nothing tells the person apart in the meantime.
if (window.isSecureContext && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js')
}
