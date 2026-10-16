/**
 * `findSelfDrawnBackArrows`: it flags the six in-page arrows it ended, copied as
 * fixtures, and lets a "Volver a …" action pass; then it runs over `screens/` and finds nothing
 * outside a shrink-only allowlist.
 */

import { expect, test } from 'vitest'
import { findSelfDrawnBackArrows } from './selfDrawnArrows'
import archivedVarieties from './fixtures/arrows/archived_varieties.txt?raw'
import catalogo from './fixtures/arrows/catalogo.txt?raw'
import classOnly from './fixtures/arrows/class_only.txt?raw'
import entriesList from './fixtures/arrows/entries_list.txt?raw'
import goneScreen from './fixtures/arrows/gone_screen.txt?raw'
import priceHistory from './fixtures/arrows/price_history.txt?raw'
import varietyPage from './fixtures/arrows/variety_page.txt?raw'
import withdrawalDetail from './fixtures/arrows/withdrawal_detail.txt?raw'

const OFFENDERS: Record<string, string> = {
  'VarietyPage (variant="back" and ‹ twice)': varietyPage,
  'PriceHistory': priceHistory,
  'EntriesList (a ‹ in a string)': entriesList,
  'ArchivedVarieties': archivedVarieties,
  'Catalogo': catalogo,
  'WithdrawalDetail': withdrawalDetail,
  'the flecha-atras class alone': classOnly,
}

test.each(Object.entries(OFFENDERS))('flags %s', (_name, text) => {
  expect(findSelfDrawnBackArrows(text).length).toBeGreaterThan(0)
})

test('flags each offence on its own line, and the arrow in a string a screen hands to its own arrow', () => {
  expect(findSelfDrawnBackArrows(withdrawalDetail)).toEqual([
    'line 2: draws its own back arrow (a Boton or BotonLink with variant="back"), the shell draws it',
    'line 3: draws its own back arrow (a literal ‹), the shell draws it',
  ])
  expect(findSelfDrawnBackArrows(entriesList)).toHaveLength(3)
})

test('does not flag a "Volver a …" action, nor the arrow named in a comment', () => {
  expect(findSelfDrawnBackArrows(goneScreen)).toEqual([])
})

/** The only screens that still hold a `‹`, each with its reason. It only shrinks. */
const ALLOWED: Record<string, string> = {
  '/src/screens/Analisis.tsx': 'the month steppers, and the root\'s own "Volver" to Más: not a card\'s back arrow',
}

const modules = import.meta.glob(['/src/screens/**/*.tsx', '!/src/screens/**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

test('no screen draws a back arrow of its own outside the allowlist', () => {
  const offences = Object.entries(modules)
    .filter(([path]) => !(path in ALLOWED))
    .flatMap(([path, content]) => findSelfDrawnBackArrows(content).map((line) => `${path}: ${line}`))
  expect(offences).toEqual([])
})

test('every allowlisted file still holds one, so the list only shrinks', () => {
  for (const path of Object.keys(ALLOWED)) {
    expect(findSelfDrawnBackArrows(modules[path] ?? '').length, path).toBeGreaterThan(0)
  }
})
