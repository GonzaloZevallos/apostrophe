/**
 * `theme.ts` at its own seam (ADR-0026, amended by the owner's decision of 2026-10-29): the
 * one module that names `localStorage` and the one that writes `data-tema` on `<html>`. The
 * stored value is `claro`, `oscuro` or nothing; nothing, any other value or a storage that
 * throws is Automatic, which follows the system through an injected port. The port here is a
 * fake that counts its live subscribers, so no test touches `matchMedia`.
 */

import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  chooseTheme,
  currentChoice,
  currentTheme,
  followSystem,
  resolveTheme,
  startAutomatic,
  type SystemTheme,
} from './theme'

const html = document.documentElement

type FakeSystem = SystemTheme & {
  /** Flips the phone's theme and tells whoever listens, as the media `change` event does. */
  flip(dark: boolean): void
  /** Flips the phone's theme without any event: what a hidden page may miss. */
  flipSilently(dark: boolean): void
  subscribers(): number
}

function fakeSystem(dark: boolean): FakeSystem {
  let isDark = dark
  const listeners = new Set<() => void>()
  return {
    isDark: () => isDark,
    onChange(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    flip(next) {
      isDark = next
      for (const cb of [...listeners]) cb()
    },
    flipSilently(next) {
      isDark = next
    },
    subscribers: () => listeners.size,
  }
}

/** Counts the `visibilitychange` and `pageshow` listeners this module has live. */
function trackPageListeners(): () => number {
  const live = { count: 0 }
  const watched = new Set(['visibilitychange', 'pageshow'])
  for (const target of [document, window] as const) {
    const add = target.addEventListener.bind(target) as (...args: unknown[]) => void
    const remove = target.removeEventListener.bind(target) as (...args: unknown[]) => void
    vi.spyOn(target, 'addEventListener').mockImplementation((...args: unknown[]) => {
      if (typeof args[0] === 'string' && watched.has(args[0])) live.count += 1
      add(...args)
    })
    vi.spyOn(target, 'removeEventListener').mockImplementation((...args: unknown[]) => {
      if (typeof args[0] === 'string' && watched.has(args[0])) live.count -= 1
      remove(...args)
    })
  }
  return () => live.count
}

function showAs(state: 'visible' | 'hidden'): void {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
}

function isDarkNow(): boolean {
  return html.getAttribute('data-tema') === 'oscuro'
}

beforeEach(() => {
  chooseTheme('claro')
  localStorage.clear()
  html.removeAttribute('data-tema')
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('resolveTheme: a choice wins over the system, Automatic is the system', () => {
  expect(resolveTheme('light', true)).toBe('claro')
  expect(resolveTheme('dark', false)).toBe('oscuro')
  expect(resolveTheme('automatic', true)).toBe('oscuro')
  expect(resolveTheme('automatic', false)).toBe('claro')
})

test('nothing stored follows a dark phone at once and a light one too', () => {
  startAutomatic(fakeSystem(true))
  expect(isDarkNow()).toBe(true)
  expect(currentChoice()).toBe('automatic')

  startAutomatic(fakeSystem(false))
  expect(isDarkNow()).toBe(false)
})

test('Dark, then Automatic: a later flip of the phone changes the attribute', () => {
  const system = fakeSystem(false)
  startAutomatic(system)
  chooseTheme('oscuro')
  expect(isDarkNow()).toBe(true)

  followSystem()
  expect(isDarkNow()).toBe(false)
  expect(localStorage.getItem('tema')).toBeNull()
  expect(currentChoice()).toBe('automatic')

  system.flip(true)
  expect(isDarkNow()).toBe(true)
  system.flip(false)
  expect(isDarkNow()).toBe(false)
})

test('Automatic, then Light: a flip of the phone no longer changes the attribute', () => {
  const system = fakeSystem(true)
  startAutomatic(system)
  expect(isDarkNow()).toBe(true)

  chooseTheme('claro')
  expect(isDarkNow()).toBe(false)
  expect(localStorage.getItem('tema')).toBe('claro')
  expect(system.subscribers()).toBe(0)

  system.flip(false)
  system.flip(true)
  expect(isDarkNow()).toBe(false)
  expect(currentChoice()).toBe('light')
})

test('a flip made while hidden, with no event, is corrected when the page turns visible', () => {
  const system = fakeSystem(false)
  startAutomatic(system)
  showAs('hidden')

  system.flipSilently(true)
  document.dispatchEvent(new Event('visibilitychange'))
  expect(isDarkNow()).toBe(false)

  showAs('visible')
  document.dispatchEvent(new Event('visibilitychange'))
  expect(isDarkNow()).toBe(true)
})

test('a flip made while away, with no event, is corrected on pageshow', () => {
  const system = fakeSystem(true)
  startAutomatic(system)
  expect(isDarkNow()).toBe(true)

  system.flipSilently(false)
  window.dispatchEvent(new Event('pageshow'))
  expect(isDarkNow()).toBe(false)
})

test('a stored Light or Dark does not re-resolve on visibility or pageshow', () => {
  const system = fakeSystem(false)
  startAutomatic(system)
  chooseTheme('claro')

  system.flipSilently(true)
  showAs('visible')
  document.dispatchEvent(new Event('visibilitychange'))
  window.dispatchEvent(new Event('pageshow'))

  expect(isDarkNow()).toBe(false)
})

test('a stored claro reads as Light even on a dark phone', () => {
  localStorage.setItem('tema', 'claro')

  startAutomatic(fakeSystem(true))

  expect(isDarkNow()).toBe(false)
  expect(currentChoice()).toBe('light')
})

test('an old stored oscuro reads as Dark even on a light phone', () => {
  localStorage.setItem('tema', 'oscuro')

  startAutomatic(fakeSystem(false))

  expect(isDarkNow()).toBe(true)
  expect(currentChoice()).toBe('dark')
})

test.each(['Oscuro', '', 'stale', '{"tema":"oscuro"}'])(
  'a stored %j reads as Automatic and is left alone',
  (value) => {
    localStorage.setItem('tema', value)
    const system = fakeSystem(true)

    startAutomatic(system)

    expect(isDarkNow()).toBe(true)
    expect(currentChoice()).toBe('automatic')
    expect(localStorage.getItem('tema')).toBe(value)
    expect(system.subscribers()).toBe(1)
  },
)

test('applying Automatic over a dark page on a light phone removes the attribute', () => {
  html.setAttribute('data-tema', 'oscuro')

  startAutomatic(fakeSystem(false))

  expect(isDarkNow()).toBe(false)
})

test('choosing Dark stores it, sets the attribute and stops following', () => {
  const system = fakeSystem(false)
  startAutomatic(system)

  chooseTheme('oscuro')

  expect(localStorage.getItem('tema')).toBe('oscuro')
  expect(isDarkNow()).toBe(true)
  expect(system.subscribers()).toBe(0)
})

test('choosing Light stores claro and removes the attribute', () => {
  chooseTheme('oscuro')

  chooseTheme('claro')

  expect(localStorage.getItem('tema')).toBe('claro')
  expect(html.hasAttribute('data-tema')).toBe(false)
})

test('a storage that throws on read reads as Automatic', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })

  expect(() => startAutomatic(fakeSystem(true))).not.toThrow()

  expect(isDarkNow()).toBe(true)
  expect(currentChoice()).toBe('automatic')
})

test('a storage that throws on write still applies the choice for the page', () => {
  startAutomatic(fakeSystem(false))
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('full')
  })
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('full')
  })

  expect(() => chooseTheme('oscuro')).not.toThrow()
  expect(isDarkNow()).toBe(true)

  expect(() => chooseTheme('claro')).not.toThrow()
  expect(isDarkNow()).toBe(false)

  expect(() => followSystem()).not.toThrow()
  expect(isDarkNow()).toBe(false)
})

test('a choice that could not be stored reads as Automatic afterwards', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('full')
  })
  chooseTheme('oscuro')
  vi.restoreAllMocks()

  expect(currentChoice()).toBe('automatic')
})

test('a storage that cannot even be reached reads as Automatic and still applies a choice', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new Error('SecurityError')
  })

  expect(() => startAutomatic(fakeSystem(true))).not.toThrow()
  expect(isDarkNow()).toBe(true)
  expect(currentChoice()).toBe('automatic')

  expect(() => chooseTheme('claro')).not.toThrow()
  expect(isDarkNow()).toBe(false)
})

test('Dark, Automatic, Light, Automatic, Automatic leaves one subscription and one listener pair', () => {
  const liveListeners = trackPageListeners()
  const system = fakeSystem(false)
  startAutomatic(system)
  expect([system.subscribers(), liveListeners()]).toEqual([1, 2])

  chooseTheme('oscuro')
  expect([system.subscribers(), liveListeners()]).toEqual([0, 0])
  followSystem()
  expect([system.subscribers(), liveListeners()]).toEqual([1, 2])
  chooseTheme('claro')
  expect([system.subscribers(), liveListeners()]).toEqual([0, 0])
  followSystem()
  followSystem()

  expect([system.subscribers(), liveListeners()]).toEqual([1, 2])
})

test('starting again after a run that stored Dark and followed the system reads clean', () => {
  const first = fakeSystem(true)
  startAutomatic(first)
  chooseTheme('oscuro')
  followSystem()
  localStorage.clear()

  const second = fakeSystem(false)
  startAutomatic(second)

  expect(first.subscribers()).toBe(0)
  expect(second.subscribers()).toBe(1)
  expect(isDarkNow()).toBe(false)
  expect(currentChoice()).toBe('automatic')
})

test('currentTheme tells what the page shows now', () => {
  expect(currentTheme()).toBe('claro')

  chooseTheme('oscuro')
  expect(currentTheme()).toBe('oscuro')

  html.setAttribute('data-tema', 'otro')
  expect(currentTheme()).toBe('claro')
})
