/**
 * The design registry (`scripts/design/screens.json`) says these screens are built: each
 * one's `route` is its `path`, and that path is the one `routes.ts` names, so a comparison
 * opens the screen the router actually mounts.
 */

import { expect, test } from 'vitest'
import screens from '../../../../scripts/design/screens.json'
import { VARIETY_PRICES, VARIETY_PRICE_NEW, pathTo } from '../../routes'

/** `pathTo` percent-encodes the braces of the design file's `{low}` placeholder: undo it. */
const designPath = (path: string): string => decodeURIComponent(path)

const BUILT: Record<string, string> = {
  VerTodas: designPath(pathTo(VARIETY_PRICES, { id: '{low}' })),
  PrecioNuevo: designPath(pathTo(VARIETY_PRICE_NEW, { id: '{low}' })),
  PrecioNuevoCompu: designPath(pathTo(VARIETY_PRICE_NEW, { id: '{low}' })),
}

test.each(Object.entries(BUILT))('%s: route = path = the routes.ts path', (name, expected) => {
  const entry = screens.screens.find((candidate) => candidate.screen === name)
  expect(entry).toBeDefined()
  expect(entry?.route).toBe(expected)
  expect(entry?.path).toBe(expected)
})
