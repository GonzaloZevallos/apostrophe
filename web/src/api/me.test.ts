import { afterEach, expect, test, vi } from 'vitest'
import { getMe } from './me'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('getMe carries the shown language the API answered', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ email: 'a@b.co', business_name: 'La Huerta', today: '2026-10-02', shown_language: 'de', money: { symbol: 'US$', decimals: 2 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  )
  const me = await getMe()
  expect(me.shown_language).toBe('de')
  expect(me.money).toEqual({ symbol: 'US$', decimals: 2 })
})
