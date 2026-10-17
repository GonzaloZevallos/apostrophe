import { describe, expect, test } from 'vitest'
import {
  parseRegistry,
  REGISTRY,
  SCREEN_NAMES,
  SKIP_COMPUTER_VIEWPORT,
  SKIP_NO_ROUTE,
  skippedScreens,
  STATE_NAMES,
  walkableScreens,
} from './registry.ts'

const entry = (extra: Record<string, unknown>) => ({ screen: 'X', route: '/x', path: '/x', ...extra })

describe('walkableScreens', () => {
  test('keeps a phone screen with a route', () => {
    const parsed = parseRegistry({ screens: [entry({ screen: 'Ventas' })] })
    expect(walkableScreens(parsed).map((s) => s.screen)).toEqual(['Ventas'])
  })

  test('skips a screen not built yet (route null), with its named reason', () => {
    const parsed = parseRegistry({ screens: [entry({ screen: 'Soon', route: null })] })
    expect(walkableScreens(parsed)).toEqual([])
    expect(skippedScreens(parsed)).toEqual([{ screen: 'Soon', reason: SKIP_NO_ROUTE }])
  })

  test('skips a computer layout (viewport width of 900 or more) but not 899', () => {
    const parsed = parseRegistry({
      screens: [
        entry({ screen: 'Compu', viewport: [1280, 920] }),
        entry({ screen: 'Edge', viewport: [900, 700] }),
        entry({ screen: 'Narrow', viewport: [899, 700] }),
      ],
    })
    expect(walkableScreens(parsed).map((s) => s.screen)).toEqual(['Narrow'])
    expect(skippedScreens(parsed)).toEqual([
      { screen: 'Compu', reason: SKIP_COMPUTER_VIEWPORT },
      { screen: 'Edge', reason: SKIP_COMPUTER_VIEWPORT },
    ])
  })

  test('every registry screen is walked or skipped with a reason, never dropped', () => {
    const walked = walkableScreens(REGISTRY).length
    expect(walked + skippedScreens(REGISTRY).length).toBe(REGISTRY.length)
    expect(walked).toBeGreaterThan(20)
  })
})

describe('parseRegistry', () => {
  test('refuses a screen without a name, a route of the wrong type and a bad viewport', () => {
    expect(() => parseRegistry({ screens: [{ route: '/x', path: '/x' }] })).toThrow()
    expect(() => parseRegistry({ screens: [entry({ route: 4 })] })).toThrow()
    expect(() => parseRegistry({ screens: [entry({ viewport: [1280] })] })).toThrow()
    expect(() => parseRegistry({})).toThrow()
  })

  test('refuses a repeated screen name', () => {
    expect(() => parseRegistry({ screens: [entry({}), entry({})] })).toThrow(/repeat/)
  })
})

describe('the screen vocabulary', () => {
  test('is the registry names plus the state names, with no repeat', () => {
    expect(SCREEN_NAMES.size).toBe(REGISTRY.length + STATE_NAMES.length)
    expect(SCREEN_NAMES.has('Entrar')).toBe(true)
    for (const name of STATE_NAMES) expect(SCREEN_NAMES.has(name)).toBe(true)
  })

  test('a state name that repeats a registry screen is refused', () => {
    expect(() => parseRegistry({ screens: [entry({ screen: 'A' })] }, ['A'])).toThrow(/repeat/)
  })
})
