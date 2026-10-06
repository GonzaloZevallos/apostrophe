import { matchRoutes } from 'react-router'
import { describe, expect, test } from 'vitest'
import { router } from './router'
import * as routes from './routes'
import contract from './api/contract.json'
import routerSource from './router.tsx?raw'

describe('routes.ts against the route table', () => {
  const mounted = {
    MORE: routes.MORE,
    EXPENSES: routes.EXPENSES,
    EXPENSE_NEW: routes.EXPENSE_NEW,
    EXPENSE_CATEGORIES: routes.EXPENSE_CATEGORIES,
    ANALYSIS: routes.ANALYSIS,
    VARIETIES: routes.VARIETIES,
    VARIETY: routes.VARIETY('7'),
    CATALOG: routes.CATALOG,
    ENTRY_NEW: routes.ENTRY_NEW,
    ENTRY: routes.ENTRY('7'),
  }

  test.each(Object.entries(mounted))('%s resolves to a route in router.tsx', (_name, path) => {
    const matches = matchRoutes(router.routes, path)
    expect(matches).not.toBeNull()
    const leaf = matches?.at(-1)
    expect(leaf?.route.path).not.toBe('*')
    // The list is an index route of its layout, whose own pathname ends in a slash.
    expect(leaf?.pathname.replace(/\/$/, '')).toBe(path)
  })

  test('the catalog screen is a detail: its route declares the card chrome, so no "+ Nueva venta"', () => {
    const leaf = matchRoutes(router.routes, routes.CATALOG)?.at(-1)

    expect(leaf?.route.handle).toEqual({ chrome: 'card' })
  })

  test('a path the table does not mount falls through to the catch-all', () => {
    const leaf = matchRoutes(router.routes, '/no-such-screen')?.at(-1)
    expect(leaf?.route.path).toBe('*')
  })

  test('relative drops the leading slash only', () => {
    expect(routes.relative('/gastos/categorias')).toBe('gastos/categorias')
  })
})

const FORBIDDEN_PATH_LITERAL = /(['"`])\/(mas|more|gastos|expenses|analisis)(?![\w-])/

interface Source {
  path: string
  content: string
}

/** Files that write one of the moved paths as a string literal. */
function findPathLiterals(files: Source[]): string[] {
  return files
    .filter(({ path }) => path !== 'src/routes.ts')
    // `redirects.ts` names the old paths on purpose: each line sends one to its new home.
    .filter(({ path }) => path !== 'src/redirects.ts')
    .filter(({ path }) => !/\.test\.tsx?$/.test(path))
    // `api/` names the server's own routes (`/expenses`), not front paths.
    .filter(({ path }) => !path.startsWith('src/api/'))
    .filter(({ content }) =>
      content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .some((line) => FORBIDDEN_PATH_LITERAL.test(line.replace(/\/\/.*$/, ''))),
    )
    .map(({ path }) => path)
}

describe('source scan for path literals', () => {
  test('flags a component that writes a moved path', () => {
    expect(
      findPathLiterals([
        { path: 'src/screens/X.tsx', content: `<Link to="/mas">` },
        { path: 'src/screens/Y.tsx', content: "navigate('/gastos?month=2026-01')" },
        { path: 'src/screens/Z.tsx', content: 'to={`/expenses/new`}' },
        { path: 'src/screens/W.tsx', content: "const a = '/analisis'" },
      ]),
    ).toEqual(['src/screens/X.tsx', 'src/screens/Y.tsx', 'src/screens/Z.tsx', 'src/screens/W.tsx'])
  })

  test('lets through the constants, other paths, comments and routes.ts itself', () => {
    expect(
      findPathLiterals([
        { path: 'src/screens/X.tsx', content: '<Link to={MORE}>' },
        { path: 'src/screens/Y.tsx', content: "to: '/variedades'" },
        { path: 'src/screens/Z.tsx', content: "// goes to '/mas'\n/* '/gastos' */" },
        { path: 'src/routes.ts', content: "export const MORE = '/mas'" },
        { path: 'src/screens/X.test.tsx', content: "initialEntries={['/mas']}" },
      ]),
    ).toEqual([])
  })

  test('the real front sources write none', () => {
    const modules = import.meta.glob(['/src/**/*.{ts,tsx}'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
    const files = Object.entries(modules).map(([path, content]) => ({
      path: path.replace(/^\//, ''),
      content,
    }))
    expect(files.length).toBeGreaterThan(10)
    expect(findPathLiterals(files)).toEqual([])
  })
})

describe('routes.ts against contract.json', () => {
  /** Every path `routes.ts` exports, with each id written as `7` (the contract's own sample). */
  function sampleRoutes(): string[] {
    return Object.entries(routes)
      .filter(([name]) => name !== 'relative')
      .map(([, value]) => (typeof value === 'function' ? (value as (id: string) => string)('7') : value))
      .filter((value): value is string => typeof value === 'string' && value.startsWith('/'))
  }

  const firstSegment = (path: string): string => path.split('/')[1] ?? ''

  // The API's first segments that a front path also starts with are exactly those the
  // contract lists as shared (`tests/test_refusal_codes.py` holds the other half: no API
  // segment overlaps `frontSegments` without a shared entry).
  const sharedSegments = new Set(contract.sharedFrontRoutes.map(firstSegment))

  /** The paths under an API segment that `sharedFrontRoutes` does not list. */
  function missingSharedRoutes(paths: string[]): string[] {
    return paths
      .filter((path) => sharedSegments.has(firstSegment(path)))
      .filter((path) => !contract.sharedFrontRoutes.includes(path))
  }

  test('every route constant under an API segment is in sharedFrontRoutes', () => {
    expect(missingSharedRoutes(sampleRoutes())).toEqual([])
  })

  test('every route constant starts with a segment the contract lists', () => {
    const unlisted = sampleRoutes().filter(
      (path) => !contract.frontSegments.includes(firstSegment(path)),
    )

    expect(unlisted).toEqual([])
  })

  test('the check refuses a shared-segment constant the contract does not list', () => {
    const forgotten = ['/varieties/7/forgotten']

    expect(missingSharedRoutes([...forgotten, '/varieties/7'])).toEqual(forgotten)
  })

  test('router.tsx names no /varieties path or old Spanish path as a literal', () => {
    const code = routerSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

    expect(code).not.toMatch(/['"`]\/?(varieties|variedades|catalogo|mi-stock\/)/)
  })
})
