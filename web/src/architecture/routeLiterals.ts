/**
 * Invariant: no component, hook, test or `navigate`/`Link`/`Navigate` call holds a
 * literal route path; every path comes from `routes/paths.ts`. This finds a string or
 * template literal that starts with a route segment.
 *
 * The old Spanish segments never collide with an API path, so any literal starting
 * with one is a violation. The English segments (`/sales`, `/customers`...) are also
 * API paths, so they count only on a line that uses a route (`navigate`, `to=`,
 * `href`, `initialEntries`...). A bare `/` counts the same way: it is Inicio.
 *
 * Walks the files handed to it, so a test feeds it a fixture that must fail.
 */

import type { SourceFile } from './forbiddenApis'

export interface RouteLiteral {
  path: string
  line: number
  literal: string
}

const SPANISH_SEGMENTS = [
  'ventas',
  'clientes',
  'variedades',
  'mi-stock',
  'gastos',
  'analisis',
  'mas',
  'negocio',
  'catalogo',
  'entrar',
]
const ENGLISH_SEGMENTS = ['sales', 'customers', 'varieties', 'expenses', 'analysis', 'settings', 'more', 'login']
// No API path is spelled exactly like these, so they are always routes.
const ROUTE_ONLY_SEGMENTS = ['invitation', 'reset']

// A literal opens with a quote or a backtick, then `/segment` ending at the literal's end
// or at `/`, `?`, `#`, `$` (a template hole). `/invitations` or `/reset-links` do not match.
function startsWith(segments: string[]): RegExp {
  return new RegExp(`(['"\`])(/(?:${segments.join('|')})(?=[/?#$'"\`]|$)[\\w\\-/:\${}.?=&]*)`, 'g')
}
const ALWAYS = startsWith([...SPANISH_SEGMENTS, ...ROUTE_ONLY_SEGMENTS])
const NEEDS_CONTEXT = startsWith(ENGLISH_SEGMENTS)
const HOME = /(['"`])\/\1/g

const ROUTE_CONTEXT = /navigate|\bto[=:]|href|initialEntries|\bpath=|\bpath:|pathname|setCurrentPath|handleUnauthorized|Navigate|Link/

function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '')
}

export function findRouteLiterals(files: SourceFile[]): RouteLiteral[] {
  const found: RouteLiteral[] = []
  for (const file of files) {
    stripComments(file.content)
      .split('\n')
      .forEach((text, index) => {
        const inRouteContext = ROUTE_CONTEXT.test(text)
        const patterns = inRouteContext ? [ALWAYS, NEEDS_CONTEXT, HOME] : [ALWAYS]
        for (const pattern of patterns) {
          for (const match of text.matchAll(pattern)) {
            found.push({ path: file.path, line: index + 1, literal: match[0] })
          }
        }
      })
  }
  return found
}
