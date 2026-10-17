import { describe, expect, test } from 'vitest'
import {
  parseFacts,
  parseRegistry,
  resolvePlaceholders,
  REGISTRY,
  SCREEN_NAMES,
  SKIP_COMPUTER_VIEWPORT,
  SKIP_NO_ROUTE,
  SKIP_THEME_TWIN,
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

  test('skips a dark twin: every cell already runs both themes, so the twin repeats a walk', () => {
    const parsed = parseRegistry({
      screens: [entry({ screen: 'Ventas' }), entry({ screen: 'VentasOscuro', tema: 'oscuro' })],
    })
    expect(walkableScreens(parsed).map((s) => s.screen)).toEqual(['Ventas'])
    expect(skippedScreens(parsed)).toEqual([{ screen: 'VentasOscuro', reason: SKIP_THEME_TWIN }])
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

describe('steps', () => {
  test('parses click, fill, wait and offline steps in order', () => {
    const [screen] = parseRegistry({
      screens: [
        entry({
          steps: [
            { fill: { label: 'Email', value: '{email}' } },
            { click: 'Entrá' },
            { wait: 'Listo' },
            { offline: true },
          ],
        }),
      ],
    })
    expect(screen?.steps).toEqual([
      { fill: { label: 'Email', value: '{email}' } },
      { click: 'Entrá' },
      { wait: 'Listo' },
      { offline: true },
    ])
  })

  test('a screen without steps has none', () => {
    expect(parseRegistry({ screens: [entry({})] })[0]?.steps).toEqual([])
  })

  test.each([
    ['an unknown step', { tap: 'x' }],
    ['a click that is not text', { click: 3 }],
    ['a fill without its value', { fill: { label: 'Email' } }],
    ['an offline that is not true', { offline: false }],
    ['a step that is not an object', 'click'],
  ])('refuses %s', (_name, step) => {
    expect(() => parseRegistry({ screens: [entry({ steps: [step] })] })).toThrow(/step/)
  })

  test('refuses steps that are not a list', () => {
    expect(() => parseRegistry({ screens: [entry({ steps: {} })] })).toThrow(/steps/)
  })
})

describe('resolvePlaceholders', () => {
  const facts = { email: 'vos@lahuerta.com', debtor: 12 }

  test('fills every {name} from the facts, numbers as text', () => {
    expect(resolvePlaceholders('/clientes/{debtor}?e={email}', facts)).toBe(
      '/clientes/12?e=vos@lahuerta.com',
    )
  })

  test('leaves text without placeholders alone', () => {
    expect(resolvePlaceholders('/ventas', facts)).toBe('/ventas')
  })

  test('refuses a placeholder no fact names, saying which', () => {
    expect(() => resolvePlaceholders('/x/{nobody}', facts)).toThrow(/nobody/)
  })
})

describe('parseFacts', () => {
  test('keeps the ids and adds the email', () => {
    expect(parseFacts({ email: 'a@b.c', password: 'x', ids: { debtor: 3, reset_token: 'abc' } })).toEqual({
      debtor: 3,
      reset_token: 'abc',
      email: 'a@b.c',
    })
  })

  test.each([
    ['no email', { ids: {} }],
    ['no ids', { email: 'a@b.c' }],
    ['an id that is neither text nor a number', { email: 'a@b.c', ids: { debtor: null } }],
    ['a list', []],
  ])('refuses %s', (_name, raw) => {
    expect(() => parseFacts(raw)).toThrow(/facts/)
  })
})
