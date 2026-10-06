/**
 * The design registry (`scripts/design/screens.json`) says these screens are built: each
 * one's `route` is its `path`, and that path is the one `routes.ts` names, so a comparison
 * opens the screen the router actually mounts.
 */

import { expect, test } from 'vitest'
import screens from '../../../../scripts/design/screens.json'
import { VARIETY_PRICE_NEW, VARIETY_PRICES } from '../../routes'

const BUILT: Record<string, string> = {
  VerTodas: VARIETY_PRICES('{low}'),
  PrecioNuevo: VARIETY_PRICE_NEW('{low}'),
  PrecioNuevoCompu: VARIETY_PRICE_NEW('{low}'),
}

test.each(Object.entries(BUILT))('%s: route = path = the routes.ts path', (name, expected) => {
  const entry = screens.screens.find((candidate) => candidate.screen === name)
  expect(entry).toBeDefined()
  expect(entry?.route).toBe(expected)
  expect(entry?.path).toBe(expected)
})
