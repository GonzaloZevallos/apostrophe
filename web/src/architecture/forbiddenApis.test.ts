import { describe, expect, test } from 'vitest'
import { findForbiddenUsages } from './forbiddenApis'

describe('findForbiddenUsages', () => {
  test('flags a module other than api/client.ts calling fetch', () => {
    const violations = findForbiddenUsages([
      { path: 'src/screens/Clientes.tsx', content: 'fetch("/customers")' },
    ])

    expect(violations).toEqual([{ path: 'src/screens/Clientes.tsx', rule: 'fetch' }])
  })

  test('allows fetch only inside api/client.ts', () => {
    const violations = findForbiddenUsages([{ path: 'src/api/client.ts', content: 'fetch(path)' }])

    expect(violations).toEqual([])
  })

  test('flags console, every kind of browser storage and the Cache API', () => {
    const violations = findForbiddenUsages([
      { path: 'src/a.ts', content: 'console.log(1)' },
      { path: 'src/b.ts', content: 'localStorage.setItem("a", "b")' },
      { path: 'src/c.ts', content: 'sessionStorage.getItem("a")' },
      { path: 'src/d.ts', content: 'indexedDB.open("a")' },
      { path: 'src/e.ts', content: 'caches.open("a")' },
      { path: 'src/f.ts', content: 'new XMLHttpRequest()' },
    ])

    expect(violations.map((v) => v.rule).sort()).toEqual(
      ['CacheStorage', 'XMLHttpRequest', 'console', 'indexedDB', 'localStorage', 'sessionStorage'].sort(),
    )
  })

  test('flags a service worker fetch handler', () => {
    const violations = findForbiddenUsages([
      { path: 'public/sw.js', content: "self.addEventListener('fetch', () => {})" },
    ])

    expect(violations).toEqual([{ path: 'public/sw.js', rule: 'fetchHandler' }])
  })

  test('a clean file raises nothing', () => {
    const violations = findForbiddenUsages([
      { path: 'src/format/dates.ts', content: 'export function formatDate() {}' },
    ])

    expect(violations).toEqual([])
  })

  test('flags a module other than clipboard.ts naming navigator.clipboard or execCommand', () => {
    const violations = findForbiddenUsages([
      { path: 'src/screens/Negocio.tsx', content: 'await navigator.clipboard.writeText(url)' },
      { path: 'src/screens/Catalogo.tsx', content: "document.execCommand('copy')" },
    ])

    expect(violations.map((v) => v.rule).sort()).toEqual(['execCommand', 'navigatorClipboard'])
  })

  test('allows navigator.clipboard and execCommand only inside clipboard.ts', () => {
    const violations = findForbiddenUsages([
      {
        path: 'src/clipboard.ts',
        content: "navigator.clipboard.writeText(text); document.execCommand('copy')",
      },
    ])

    expect(violations).toEqual([])
  })

  test('flags optional-chained and bracket-notation navigator.clipboard too', () => {
    const violations = findForbiddenUsages([
      { path: 'src/screens/Catalogo.tsx', content: 'navigator?.clipboard?.writeText(text)' },
      { path: 'src/screens/Negocio.tsx', content: 'navigator["clipboard"].writeText(text)' },
    ])

    expect(violations.map((v) => v.path)).toEqual([
      'src/screens/Catalogo.tsx',
      'src/screens/Negocio.tsx',
    ])
    expect(violations.every((v) => v.rule === 'navigatorClipboard')).toBe(true)
  })

  test('a file merely named clipboard.ts elsewhere than src/clipboard.ts is not exempt', () => {
    const violations = findForbiddenUsages([
      {
        path: 'src/screens/clipboard.ts',
        content: "navigator.clipboard.writeText(text); document.execCommand('copy')",
      },
    ])

    expect(violations.map((v) => v.rule).sort()).toEqual(['execCommand', 'navigatorClipboard'])
  })

  test('allows localStorage only inside src/theme.ts (ADR-0026)', () => {
    const body = 'localStorage.setItem("tema", "oscuro")'

    expect(findForbiddenUsages([{ path: 'src/theme.ts', content: body }])).toEqual([])
    expect(
      findForbiddenUsages([
        { path: 'src/screens/settings/AppearanceGroup.tsx', content: body },
        { path: 'src/screens/theme.ts', content: body },
      ]),
    ).toEqual([
      { path: 'src/screens/settings/AppearanceGroup.tsx', rule: 'localStorage' },
      { path: 'src/screens/theme.ts', rule: 'localStorage' },
    ])
  })

  test('theme.ts is not exempt from sessionStorage or indexedDB', () => {
    const violations = findForbiddenUsages([
      { path: 'src/theme.ts', content: 'sessionStorage.setItem("a", "b"); indexedDB.open("a")' },
    ])

    expect(violations.map((v) => v.rule).sort()).toEqual(['indexedDB', 'sessionStorage'])
  })

  test('flags a module other than components/useLeaveGuard.ts using useBlocker', () => {
    const violations = findForbiddenUsages([
      {
        path: 'src/screens/expenses/ExpenseNewRoute.tsx',
        content: "import { useBlocker } from 'react-router'\nconst blocker = useBlocker(shouldBlock)",
      },
    ])

    expect(violations).toEqual([
      { path: 'src/screens/expenses/ExpenseNewRoute.tsx', rule: 'useBlocker' },
    ])
  })

  test('allows useBlocker only inside src/components/useLeaveGuard.ts', () => {
    const violations = findForbiddenUsages([
      { path: 'src/components/useLeaveGuard.ts', content: 'const blocker = useBlocker(shouldBlock)' },
    ])

    expect(violations).toEqual([])
  })

  describe('the document\'s scroll (ADR-0064)', () => {
    const banned: Array<[string, string]> = [
      ['window.scrollTo', "window.scrollTo({ top: 0, left: 0, behavior: 'instant' })"],
      ['window.scrollBy', 'window.scrollBy(0, 40)'],
      ['window.scroll', 'window.scroll(0, 0)'],
      ['globalThis.scrollTo', 'globalThis.scrollTo(0, 0)'],
      ['optional-chained window?.scrollTo', 'window?.scrollTo(0, 0)'],
      ['bracket window["scrollTo"]', "window['scrollTo'](0, 0)"],
      ['document.scrollTo', 'document.scrollTo(0, 0)'],
      ['documentElement.scrollTop =', 'document.documentElement.scrollTop = 0'],
      ['body.scrollTop +=', 'document.body.scrollTop += 10'],
      ['scrollingElement.scrollLeft =', 'document.scrollingElement.scrollLeft = 0'],
      ['history.scrollRestoration read', "const mode = window.history.scrollRestoration"],
      ['history.scrollRestoration write', "history.scrollRestoration = 'manual'"],
    ]

    test.each(banned)('flags %s outside the scroll owners', (_name, content) => {
      expect(findForbiddenUsages([{ path: 'src/screens/Inicio.tsx', content }])).toEqual([
        { path: 'src/screens/Inicio.tsx', rule: 'documentScroll' },
      ])
    })

    test.each(banned)('allows %s inside each scroll owner', (_name, content) => {
      const owners = [
        'src/shell/ScrollSync.tsx',
        'src/shell/scrollPlaces.ts',
        'src/shell/scrollFollow.ts',
        'src/components/useReturnToPlace.ts',
      ]
      expect(findForbiddenUsages(owners.map((path) => ({ path, content })))).toEqual([])
    })

    test('a file merely named like an owner elsewhere is not exempt', () => {
      expect(
        findForbiddenUsages([{ path: 'src/screens/ScrollSync.tsx', content: 'window.scrollTo(0, 0)' }]),
      ).toEqual([{ path: 'src/screens/ScrollSync.tsx', rule: 'documentScroll' }])
    })

    test('in-page scrolling of an element, reads of the offset and comparisons stay allowed', () => {
      const content = [
        'row.scrollIntoView({ block: "nearest" })',
        'list.scrollTo({ top: 0 })',
        'panel.scrollTop = 0',
        'const here = window.scrollY',
        'const tall = document.documentElement.scrollHeight',
        'if (document.body.scrollTop === 0) return',
        "window.addEventListener('scroll', onScroll)",
      ].join('\n')
      expect(findForbiddenUsages([{ path: 'src/screens/Inicio.tsx', content }])).toEqual([])
    })
  })
})
