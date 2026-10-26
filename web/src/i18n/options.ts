import type { InitOptions } from 'i18next'

/**
 * The init options production runs with, shared by the app's one instance (`./index.ts`) and
 * by the parity reference instance of the resolver tests, so the two can never drift apart.
 * `escapeValue` is false because React escapes what it renders (ADR-0050).
 */
export const productionOptions = {
  lng: 'en',
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
} satisfies InitOptions
