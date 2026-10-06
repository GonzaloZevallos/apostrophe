/**
 * `canShare` and `shareText` at their own seam (plan, "Compartir"): the only functions
 * allowed to name `navigator.share`. A share function in a secure context is the only
 * way sharing is offered; a seller's cancel (`AbortError`) is not a failure; and no
 * outcome carries the error object or the text out of the module.
 */

import { afterEach, expect, test, vi } from 'vitest'
import { canShare, shareText } from './share'

function stubSecureContext(value: boolean): void {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true })
}

function stubShare(share: unknown): void {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(window, 'isSecureContext')
  Reflect.deleteProperty(navigator, 'share')
  vi.restoreAllMocks()
})

test('canShare is true in a secure context with a share function', () => {
  stubSecureContext(true)
  stubShare(vi.fn())

  expect(canShare()).toBe(true)
})

test('canShare is false when the browser has no share function', () => {
  stubSecureContext(true)

  expect(canShare()).toBe(false)
})

test('canShare is false over plain http even when a share function exists', () => {
  stubSecureContext(false)
  stubShare(vi.fn())

  expect(canShare()).toBe(false)
})

test('shareText hands the text, only the text, to the share sheet and resolves shared', async () => {
  stubSecureContext(true)
  const share = vi.fn().mockResolvedValue(undefined)
  stubShare(share)

  const outcome = await shareText('**CATÁLOGO**\n• Precio x gramo: $11.000')

  expect(share).toHaveBeenCalledTimes(1)
  expect(share).toHaveBeenCalledWith({ text: '**CATÁLOGO**\n• Precio x gramo: $11.000' })
  expect(outcome).toBe('shared')
})

test('a seller who closes the share sheet resolves cancelled, not failed', async () => {
  stubSecureContext(true)
  stubShare(vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')))

  expect(await shareText('hola')).toBe('cancelled')
})

test('any other rejection resolves failed', async () => {
  stubSecureContext(true)
  stubShare(vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')))

  expect(await shareText('hola')).toBe('failed')
})

test('a rejection that is not a DOMException resolves failed', async () => {
  stubSecureContext(true)
  stubShare(vi.fn().mockRejectedValue(new Error('boom')))

  expect(await shareText('hola')).toBe('failed')
})

test('a synchronous throw from the share function resolves failed', async () => {
  stubSecureContext(true)
  stubShare(() => {
    throw new TypeError('bad data')
  })

  expect(await shareText('hola')).toBe('failed')
})

test('shareText with no share function available resolves failed without throwing', async () => {
  stubSecureContext(true)

  expect(await shareText('hola')).toBe('failed')
})

test('no outcome writes the text or the error to the console', async () => {
  stubSecureContext(true)
  stubShare(vi.fn().mockRejectedValue(new Error('hola secreto')))
  const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((method) =>
    vi.spyOn(globalThis.console, method).mockImplementation(() => {}),
  )

  await shareText('hola secreto')

  for (const spy of spies) expect(spy).not.toHaveBeenCalled()
})
