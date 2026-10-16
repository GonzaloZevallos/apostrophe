import { afterEach, expect, test, vi } from 'vitest'
import { readVarietyAttributes, varietyAttributesQueryOptions } from './catalog'
import { keys } from './keys'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('reads one variety\'s stored values from its own route, and keys the query under the catalog prefix', async () => {
  const stored = { shown: false, emoji: null, indica_share: 60, aroma: 'cítrico' }
  const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(stored), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchMock)

  expect(await readVarietyAttributes('4')).toEqual(stored)

  expect(fetchMock.mock.calls[0]?.[0]).toBe('/catalog/varieties/4')
  const options = varietyAttributesQueryOptions('4')
  expect(options.queryKey).toEqual(keys.catalogVariety('4'))
  expect(options.gcTime).toBe(0)
})
