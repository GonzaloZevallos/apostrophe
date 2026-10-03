/**
 * `copyText` at its own seam (plan, "Clipboard over plain http"): the only function
 * allowed to name `navigator.clipboard` or `execCommand` anywhere in the front. A
 * secure context with the async Clipboard API uses it; everything else (plain http
 * on the home network, ADR-0002, or a browser with no Clipboard API at all) falls
 * back to the synchronous textarea + `execCommand('copy')` path, with no retry
 * either way.
 */

import { afterEach, expect, test, vi } from 'vitest'
import { copyText } from './clipboard'

function stubSecureContext(value: boolean): void {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true })
}

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(window, 'isSecureContext')
  Reflect.deleteProperty(navigator, 'clipboard')
})

test('a secure context with the Clipboard API writes through it and resolves true', async () => {
  stubSecureContext(true)
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

  const copied = await copyText('hola')

  expect(writeText).toHaveBeenCalledWith('hola')
  expect(copied).toBe(true)
})

test('a refused Clipboard permission resolves false, with no retry', async () => {
  stubSecureContext(true)
  const writeText = vi.fn().mockRejectedValue(new Error('denied'))
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

  const copied = await copyText('hola')

  expect(writeText).toHaveBeenCalledTimes(1)
  expect(copied).toBe(false)
})

test('an insecure context falls back to execCommand and leaves no textarea behind', async () => {
  stubSecureContext(false)
  const writeText = vi.fn()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  const execCommand = vi.fn().mockReturnValue(true)
  document.execCommand = execCommand

  const copied = await copyText('chau')

  expect(writeText).not.toHaveBeenCalled()
  expect(execCommand).toHaveBeenCalledWith('copy')
  expect(copied).toBe(true)
  expect(document.querySelector('textarea')).toBeNull()
})

test('a secure context with no Clipboard API also falls back to execCommand', async () => {
  stubSecureContext(true)
  Reflect.deleteProperty(navigator, 'clipboard')
  const execCommand = vi.fn().mockReturnValue(true)
  document.execCommand = execCommand

  const copied = await copyText('che')

  expect(execCommand).toHaveBeenCalledWith('copy')
  expect(copied).toBe(true)
})

test('execCommand reporting failure resolves false', async () => {
  stubSecureContext(false)
  const execCommand = vi.fn().mockReturnValue(false)
  document.execCommand = execCommand

  const copied = await copyText('posta')

  expect(copied).toBe(false)
})
