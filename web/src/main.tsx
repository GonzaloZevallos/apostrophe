import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import './styles/tokens.css'
import './styles/app.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startKeepFocusVisible } from './shell/keepFocusVisible'
import { applyStoredTheme } from './theme'
import { startThemeSync } from './theme/theme'

const root = document.getElementById('root')
if (root === null) throw new Error('index.html has no #root')

// ADR-0026: the device's theme before the first render, Entrar included.
applyStoredTheme()
startThemeSync()
startKeepFocusVisible()

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
