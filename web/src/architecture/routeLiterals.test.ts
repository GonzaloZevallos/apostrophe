import { describe, expect, test } from 'vitest'
import { findRouteLiterals } from './routeLiterals'

function scan(content: string) {
  return findRouteLiterals([{ path: 'src/screens/X.tsx', content }]).map((hit) => hit.literal)
}

describe('findRouteLiterals', () => {
  test('flags an old Spanish path in a navigate, a Link and a template', () => {
    expect(scan("navigate('/ventas')")).toEqual(["'/ventas"])
    expect(scan('<Link to="/clientes/deben">')).toEqual(['"/clientes/deben'])
    expect(scan('navigate(`/clientes/${id}/editar`)')).toEqual(['`/clientes/${id}/editar'])
  })

  test('flags an English route path only where a route is used', () => {
    expect(scan("navigate('/sales/new')")).toEqual(["'/sales/new"])
    expect(scan('<Link to="/settings">')).toEqual(['"/settings'])
    expect(scan("const view = await get('/sales/10')")).toEqual([])
    expect(scan("fetch('/customers?q=a')")).toEqual([])
  })

  test('flags a bare home path in a route, not elsewhere', () => {
    expect(scan("navigate('/')")).toEqual(["'/'"])
    expect(scan("path.split('/')")).toEqual([])
  })

  test('does not flag the API paths that only look like a route segment', () => {
    expect(scan("post(`/invitations/${token}/accept`, body)")).toEqual([])
    expect(scan("get(`/reset-links/${token}`)")).toEqual([])
  })

  test('ignores comments', () => {
    expect(scan("// navigate('/ventas')\n/* to=\"/clientes\" */")).toEqual([])
  })

  test('reports the file and the line', () => {
    const [hit] = findRouteLiterals([{ path: 'src/a.ts', content: "const a = 1\nnavigate('/mi-stock')" }])
    expect(hit).toEqual({ path: 'src/a.ts', line: 2, literal: "'/mi-stock" })
  })
})
