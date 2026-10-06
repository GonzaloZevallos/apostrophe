/**
 * `theme.ts` at its own seam (ADR-0024): the one module that names `localStorage` and the
 * one that touches `data-tema` on `<html>`. The stored value is `oscuro` or nothing; any
 * other value reads as light and is left alone; a storage that throws never breaks the
 * page, and choosing still applies the attribute for the page's lifetime.
 */

import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { applyStoredTheme, chooseTheme, currentTheme } from './theme'

const html = document.documentElement

beforeEach(() => {
  localStorage.clear()
  html.removeAttribute('data-tema')
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('nothing stored opens light', () => {
  applyStoredTheme()

  expect(html.hasAttribute('data-tema')).toBe(false)
})

test('a stored oscuro opens dark', () => {
  localStorage.setItem('tema', 'oscuro')

  applyStoredTheme()

  expect(html.getAttribute('data-tema')).toBe('oscuro')
})

test.each(['claro', 'Oscuro', '', 'stale', '{"tema":"oscuro"}'])(
  'a stored %j reads as light and is left alone',
  (value) => {
    localStorage.setItem('tema', value)

    applyStoredTheme()

    expect(html.hasAttribute('data-tema')).toBe(false)
    expect(localStorage.getItem('tema')).toBe(value)
  },
)

test('applying a stored light over a dark page removes the attribute', () => {
  html.setAttribute('data-tema', 'oscuro')

  applyStoredTheme()

  expect(html.hasAttribute('data-tema')).toBe(false)
})

test('choosing Oscuro stores it and sets the attribute', () => {
  chooseTheme('oscuro')

  expect(localStorage.getItem('tema')).toBe('oscuro')
  expect(html.getAttribute('data-tema')).toBe('oscuro')
})

test('choosing Claro removes the key and the attribute, storing nothing', () => {
  chooseTheme('oscuro')

  chooseTheme('claro')

  expect(localStorage.getItem('tema')).toBeNull()
  expect(localStorage.length).toBe(0)
  expect(html.hasAttribute('data-tema')).toBe(false)
})

test('a storage that throws on read gives light', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  html.setAttribute('data-tema', 'oscuro')

  expect(() => applyStoredTheme()).not.toThrow()
  expect(html.hasAttribute('data-tema')).toBe(false)
})

test('a storage that throws on write still applies the choice for the page', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('full')
  })
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('full')
  })

  expect(() => chooseTheme('oscuro')).not.toThrow()
  expect(html.getAttribute('data-tema')).toBe('oscuro')

  expect(() => chooseTheme('claro')).not.toThrow()
  expect(html.hasAttribute('data-tema')).toBe(false)
})

test('a storage that cannot even be reached gives light', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new Error('SecurityError')
  })

  expect(() => applyStoredTheme()).not.toThrow()
  expect(() => chooseTheme('oscuro')).not.toThrow()
  expect(html.getAttribute('data-tema')).toBe('oscuro')
})

test('currentTheme tells what the page shows now', () => {
  expect(currentTheme()).toBe('claro')

  chooseTheme('oscuro')
  expect(currentTheme()).toBe('oscuro')

  html.setAttribute('data-tema', 'otro')
  expect(currentTheme()).toBe('claro')
})
