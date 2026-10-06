/**
 * The inset rules, read from the raw files (GH-77, "insets"): four tokens built from
 * `env(safe-area-inset-*)` and nothing else reading `env(`; no screen-tied `vh`;
 * every fixed or sticky selector owns an inset; the bar and the roots reference theirs.
 * `e2e/insets.spec.ts` is the real guard for what these regexes cannot see.
 */

import { expect, test } from 'vitest'

const files = import.meta.glob('/src/**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const WEB_TOKENS = '/src/styles/tokens.css'
const APP_CSS = '/src/styles/app.css'

const SIDES = ['arriba', 'abajo', 'izquierda', 'derecha'] as const
const ENV_SIDE: Record<(typeof SIDES)[number], string> = {
  arriba: 'top',
  abajo: 'bottom',
  izquierda: 'left',
  derecha: 'right',
}

function file(path: string): string {
  const content = files[path]
  if (content === undefined) throw new Error(`${path} was not loaded`)
  return content
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** The body of the first `:root {` block. */
function firstRoot(css: string): string {
  const start = css.indexOf(':root {')
  const end = css.indexOf('\n}', start)
  return css.slice(start, end)
}

interface Rule {
  selector: string
  body: string
}

/** Every `selector { body }`, flattened through one level of at-rule nesting. */
function rules(css: string): Rule[] {
  const out: Rule[] = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  for (const match of stripComments(css).matchAll(pattern)) {
    const selector = (match[1] ?? '').replace(/@media[^{]*$/, '').trim()
    if (selector !== '') out.push({ selector, body: match[2] ?? '' })
  }
  return out
}

function rulesFor(selector: string): Rule[] {
  return rules(file(APP_CSS)).filter((rule) =>
    rule.selector.split(',').some((part) => part.trim() === selector),
  )
}

/** The checks below, run over a stylesheet text; also fed an offender in the last test. */
export function fixedWithoutInset(css: string): string[] {
  return rules(css)
    .filter((rule) => /position:\s*(fixed|sticky)/.test(rule.body))
    .filter((rule) => !/var\(--inset-/.test(rule.body))
    .map((rule) => rule.selector)
}

export function screenTiedVh(css: string): string[] {
  return stripComments(css).match(/\d(\.\d+)?vh\b/g) ?? []
}

// The docs copy is outside Vite's file-serving root; `tests/test_design_tokens.py` keeps it byte-identical.
test('web tokens.css declares the four inset tokens in its first :root', () => {
  const path = WEB_TOKENS
  const root = firstRoot(file(path))
  for (const side of SIDES) {
    expect(root).toContain(`--inset-${side}: env(safe-area-inset-${ENV_SIDE[side]}, 0px);`)
  }
  expect(file(path).match(/--inset-[a-z]+:/g)).toHaveLength(4)
})

test('the inset tokens are not redeclared for the dark theme', () => {
  const dark = file(WEB_TOKENS).slice(file(WEB_TOKENS).indexOf("[data-tema='oscuro']"))
  expect(dark).not.toContain('--inset-')
})

test('env( appears only in the four inset tokens of tokens.css, never in another stylesheet', () => {
  for (const [path, css] of Object.entries(files)) {
    const uses = stripComments(css).match(/env\(/g) ?? []
    const isTokens = path === WEB_TOKENS
    expect(uses, path).toHaveLength(isTokens ? 4 : 0)
  }
})

test('no screen-tied vh remains in any stylesheet', () => {
  for (const [path, css] of Object.entries(files)) {
    expect(screenTiedVh(css), path).toEqual([])
  }
})

test('every fixed or sticky selector in app.css references an inset token', () => {
  const css = file(APP_CSS)
  expect(rules(css).some((rule) => /position:\s*(fixed|sticky)/.test(rule.body))).toBe(true)
  expect(fixedWithoutInset(css)).toEqual([])
})

test('the checks reject an offender', () => {
  expect(fixedWithoutInset('.x { position: fixed; top: 0; }')).toEqual(['.x'])
  expect(fixedWithoutInset('.x { position: sticky; top: var(--inset-arriba); }')).toEqual([])
  expect(screenTiedVh('.x { min-height: 100vh; }')).toEqual(['0vh'])
  expect(screenTiedVh('.x { min-height: 100dvh; }')).toEqual([])
})

test('.bar-inferior cancels and re-adds the side insets and clears the bottom one', () => {
  const body = rulesFor('.bar-inferior').map((rule) => rule.body).join('\n')
  for (const side of ['izquierda', 'derecha', 'abajo'] as const) {
    expect(body).toContain(`var(--inset-${side})`)
  }
  expect(body).toMatch(/margin-inline:\s*calc\(-1 \* var\(--inset-izquierda\)\) calc\(-1 \* var\(--inset-derecha\)\)/)
})

test('.disposicion owns top, left and right; .pantalla owns all four; a nested .pantalla resets', () => {
  const disposicion = rulesFor('.disposicion').map((rule) => rule.body).join('\n')
  expect(disposicion).toMatch(
    /padding:\s*var\(--inset-arriba\) var\(--inset-derecha\) 0 var\(--inset-izquierda\)/,
  )
  const pantalla = rulesFor('.pantalla').map((rule) => rule.body).join('\n')
  for (const side of SIDES) expect(pantalla).toContain(`var(--inset-${side})`)
  const nested = rulesFor('.disposicion .pantalla').map((rule) => rule.body).join('\n')
  expect(nested).toMatch(/padding:\s*0/)
})

test('the bottom with no bar belongs to the column', () => {
  expect(rulesFor('.columna-principal--sin-bar').map((rule) => rule.body).join('\n')).toContain(
    'padding-bottom: var(--inset-abajo)',
  )
})
