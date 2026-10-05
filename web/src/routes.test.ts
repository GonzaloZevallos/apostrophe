import { matchRoutes } from 'react-router'
import { describe, expect, test } from 'vitest'
import { router } from './router'
import * as routes from './routes'

describe('routes.ts against the route table', () => {
  // EXPENSE_NEW is a placeholder until `routes-flip` mounts its route.
  const mounted = {
    MORE: routes.MORE,
    EXPENSES: routes.EXPENSES,
    EXPENSE_CATEGORIES: routes.EXPENSE_CATEGORIES,
    ANALYSIS: routes.ANALYSIS,
  }

  test.each(Object.entries(mounted))('%s resolves to a route in router.tsx', (_name, path) => {
    const matches = matchRoutes(router.routes, path)
    expect(matches).not.toBeNull()
    const leaf = matches?.at(-1)
    expect(leaf?.route.path).not.toBe('*')
    expect(leaf?.pathname).toBe(path)
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
