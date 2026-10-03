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
})
