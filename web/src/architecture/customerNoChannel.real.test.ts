/**
 * The customer has no channel in the front: the API module, Clientes and the
 * "Nuevo cliente" form of Elegir cliente never mention the word, tests included.
 * A `?raw` scan of those three paths; the colour-channel helpers and the Telegram
 * settings live elsewhere and are not read.
 */

import { expect, test } from 'vitest'

const modules = import.meta.glob(
  ['/src/api/customers.ts', '/src/screens/clientes/**/*.{ts,tsx}', '/src/screens/ventas/NuevaVentaCliente.tsx'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

const CHANNEL_WORD = /\bchannel\b/

test('the scan reads the customer API, Clientes and NuevaVentaCliente', () => {
  const paths = Object.keys(modules)
  expect(paths).toContain('/src/api/customers.ts')
  expect(paths).toContain('/src/screens/ventas/NuevaVentaCliente.tsx')
  expect(paths.some((path) => path.startsWith('/src/screens/clientes/'))).toBe(true)
})

test('no file of the three paths says "channel"', () => {
  const offenders = Object.entries(modules)
    .filter(([, content]) => CHANNEL_WORD.test(content))
    .map(([path]) => path)
  expect(offenders).toEqual([])
})

test('the scan rejects text that names the customer field', () => {
  expect(CHANNEL_WORD.test('channel: Channel | null')).toBe(true)
  expect(CHANNEL_WORD.test('const canal = 1')).toBe(false)
})
