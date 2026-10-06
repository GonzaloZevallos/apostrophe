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

function bodyOf(css: string, selector: string): string {
  return rules(css)
    .filter((rule) => rule.selector.split(',').some((part) => part.trim() === selector))
    .map((rule) => rule.body)
    .join('\n')
}

/** Each check returns the violations it finds, so the tests can feed it a stylesheet it must reject. */
export function fixedWithoutInset(css: string): string[] {
  return rules(css)
    .filter((rule) => /position:\s*(fixed|sticky)/.test(rule.body))
    .filter((rule) => !/var\(--inset-/.test(rule.body))
    .map((rule) => rule.selector)
}

export function screenTiedVh(css: string): string[] {
  return stripComments(css).match(/\d(\.\d+)?vh\b/g) ?? []
}

/** `env(` is read exactly `allowed` times: four in the tokens, never in another stylesheet. */
export function envViolations(css: string, allowed: number): string[] {
  const uses = stripComments(css).match(/env\(/g) ?? []
  return uses.length === allowed ? [] : [`env( appears ${uses.length} times, expected ${allowed}`]
}

/** The four tokens in the first `:root`, in their exact form, and no fifth `--inset-*`. */
export function tokenViolations(tokensCss: string): string[] {
  const root = firstRoot(tokensCss)
  const out: string[] = []
  for (const side of SIDES) {
    const declaration = `--inset-${side}: env(safe-area-inset-${ENV_SIDE[side]}, 0px);`
    if (!root.includes(declaration)) out.push(`missing ${declaration}`)
  }
  const declared = stripComments(tokensCss).match(/--inset-[a-z]+\s*:/g) ?? []
  if (declared.length !== SIDES.length) out.push(`${declared.length} --inset-* declarations`)
  return out
}

/** The insets are the light `:root`'s alone: the dark block redeclares none. */
export function darkRedeclares(tokensCss: string): string[] {
  const at = tokensCss.indexOf("[data-tema='oscuro']")
  if (at === -1) return ['no dark block found']
  return tokensCss.slice(at).includes('--inset-') ? ['the dark block redeclares an inset'] : []
}

/** Who owns each side: `.disposicion`, `.pantalla`, the nested reset, the bar and the bare column. */
export function ownerViolations(css: string): string[] {
  const out: string[] = []
  const disposicion = bodyOf(css, '.disposicion')
  if (!/padding:\s*var\(--inset-arriba\) var\(--inset-derecha\) 0 var\(--inset-izquierda\)/.test(disposicion)) {
    out.push('.disposicion does not own top, left and right')
  }
  const pantalla = bodyOf(css, '.pantalla')
  for (const side of SIDES) {
    if (!pantalla.includes(`var(--inset-${side})`)) out.push(`.pantalla does not own ${side}`)
  }
  if (!/padding:\s*0\s*;/.test(bodyOf(css, '.disposicion .pantalla'))) {
    out.push('.disposicion .pantalla does not reset to 0')
  }
  const bar = bodyOf(css, '.bar-inferior')
  for (const side of ['izquierda', 'derecha', 'abajo'] as const) {
    if (!bar.includes(`var(--inset-${side})`)) out.push(`.bar-inferior does not use ${side}`)
  }
  if (!/margin-inline:\s*calc\(-1 \* var\(--inset-izquierda\)\) calc\(-1 \* var\(--inset-derecha\)\)/.test(bar)) {
    out.push('.bar-inferior does not cancel the side insets')
  }
  if (!bodyOf(css, '.columna-principal--sin-bar').includes('padding-bottom: var(--inset-abajo)')) {
    out.push('.columna-principal--sin-bar does not own the bottom')
  }
  return out
}

// The docs copy is outside Vite's file-serving root; `tests/test_design_tokens.py` keeps it byte-identical.
test('web tokens.css declares the four inset tokens in its first :root, and not for the dark theme', () => {
  expect(tokenViolations(file(WEB_TOKENS))).toEqual([])
  expect(darkRedeclares(file(WEB_TOKENS))).toEqual([])
})

test('env( appears only in the four inset tokens of tokens.css, never in another stylesheet', () => {
  for (const [path, css] of Object.entries(files)) {
    expect(envViolations(css, path === WEB_TOKENS ? 4 : 0), path).toEqual([])
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

test('the owners of app.css are in place', () => {
  expect(ownerViolations(file(APP_CSS))).toEqual([])
})

const GOOD_TOKENS = `:root {
  --inset-arriba: env(safe-area-inset-top, 0px);
  --inset-abajo: env(safe-area-inset-bottom, 0px);
  --inset-izquierda: env(safe-area-inset-left, 0px);
  --inset-derecha: env(safe-area-inset-right, 0px);
}
[data-tema='oscuro'] {
  --papel: red;
}`

const GOOD_OWNERS = `
.disposicion { padding: var(--inset-arriba) var(--inset-derecha) 0 var(--inset-izquierda); }
.pantalla { padding: var(--inset-arriba) var(--inset-derecha) var(--inset-abajo) var(--inset-izquierda); }
.disposicion .pantalla { padding: 0; }
.bar-inferior {
  margin-inline: calc(-1 * var(--inset-izquierda)) calc(-1 * var(--inset-derecha));
  padding: 14px calc(16px + var(--inset-derecha)) calc(20px + var(--inset-abajo)) calc(16px + var(--inset-izquierda));
}
.columna-principal--sin-bar { padding-bottom: var(--inset-abajo); }`

test('the checks reject a stylesheet that breaks the rule, and accept one that keeps it', () => {
  expect(fixedWithoutInset('.x { position: fixed; top: 0; }')).toEqual(['.x'])
  expect(fixedWithoutInset('.x { position: sticky; top: var(--inset-arriba); }')).toEqual([])
  expect(screenTiedVh('.x { min-height: 100vh; }')).toEqual(['0vh'])
  expect(screenTiedVh('.x { min-height: 100dvh; }')).toEqual([])

  expect(envViolations('.x { padding: env(safe-area-inset-top); }', 0)).toHaveLength(1)
  expect(envViolations('.x { padding: 0; }', 0)).toEqual([])
  expect(envViolations(`/* env( in a comment */ ${GOOD_TOKENS}`, 4)).toEqual([])

  expect(tokenViolations(GOOD_TOKENS)).toEqual([])
  expect(tokenViolations(GOOD_TOKENS.replace('top, 0px', 'top'))).toHaveLength(1)
  expect(tokenViolations(GOOD_TOKENS.replace('\n}', '\n  --inset-extra: 1px;\n}'))).toHaveLength(1)
  expect(tokenViolations(GOOD_TOKENS.replace('--inset-abajo', '--inset-fondo'))).toHaveLength(1)

  expect(darkRedeclares(GOOD_TOKENS)).toEqual([])
  expect(
    darkRedeclares(GOOD_TOKENS.replace('--papel: red;', '--inset-arriba: 0px;')),
  ).toHaveLength(1)

  expect(ownerViolations(GOOD_OWNERS)).toEqual([])
  expect(ownerViolations(GOOD_OWNERS.replace('.disposicion { padding: var(--inset-arriba)', '.disposicion { padding: 0'))).toEqual([
    '.disposicion does not own top, left and right',
  ])
  expect(ownerViolations(GOOD_OWNERS.replace(' var(--inset-abajo) var(--inset-izquierda); }\n.disposicion .pantalla', ' var(--inset-izquierda); }\n.disposicion .pantalla'))).toEqual([
    '.pantalla does not own abajo',
  ])
  expect(ownerViolations(GOOD_OWNERS.replace('.disposicion .pantalla { padding: 0; }', ''))).toEqual([
    '.disposicion .pantalla does not reset to 0',
  ])
  expect(ownerViolations(GOOD_OWNERS.replace('margin-inline:', 'margin:'))).toEqual([
    '.bar-inferior does not cancel the side insets',
  ])
  expect(ownerViolations(GOOD_OWNERS.replace('calc(20px + var(--inset-abajo))', '20px'))).toEqual([
    '.bar-inferior does not use abajo',
  ])
  expect(ownerViolations(GOOD_OWNERS.replace('.columna-principal--sin-bar { padding-bottom: var(--inset-abajo); }', ''))).toEqual([
    '.columna-principal--sin-bar does not own the bottom',
  ])
})
