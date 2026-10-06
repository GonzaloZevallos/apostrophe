/**
 * The gesture and pressed-state rules, read from the raw stylesheets (GH-77, "touch and
 * keyboard"): `html` and `body` do not bounce, the sheets' scrolling panels contain
 * their scroll, and the one pressed block (marked by a `pressed` comment) uses tokens only, never a bare
 * `button:active`. `e2e/pressed.spec.ts` measures the cue itself on the built front.
 */

import { expect, test } from 'vitest'

const files = import.meta.glob('/src/**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const TOKENS = '/src/styles/tokens.css'
const APP_CSS = '/src/styles/app.css'

function file(path: string): string {
  const content = files[path]
  if (content === undefined) throw new Error(`${path} was not loaded`)
  return content
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

interface Rule {
  selector: string
  body: string
}

function rules(css: string): Rule[] {
  return [...stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? '').replace(/@media[^{]*$/, '').trim(),
    body: match[2] ?? '',
  }))
}

function bodyOf(css: string, selector: string): string {
  return rules(css)
    .filter((rule) => rule.selector.split(',').some((part) => part.trim() === selector))
    .map((rule) => rule.body)
    .join('\n')
}

/** What the document's gesture rules must say, each as a regex over the rule's body. */
export function gestureViolations(css: string): string[] {
  const out: string[] = []
  const html = bodyOf(css, 'html')
  for (const [name, pattern] of [
    ['-webkit-text-size-adjust: 100%', /-webkit-text-size-adjust:\s*100%/],
    ['-webkit-tap-highlight-color: transparent', /-webkit-tap-highlight-color:\s*transparent/],
    ['touch-action: manipulation', /touch-action:\s*manipulation/],
  ] as const) {
    if (!pattern.test(html)) out.push(`html lacks ${name}`)
  }
  const htmlAndBody = rules(css).filter((rule) => rule.selector.replace(/\s+/g, ' ') === 'html, body')
  if (!htmlAndBody.some((rule) => /overscroll-behavior:\s*none/.test(rule.body))) {
    out.push('html, body lack overscroll-behavior: none')
  }
  for (const panel of ['.capa__contenido', '.cliente-sheet__contenido']) {
    if (!/overscroll-behavior:\s*contain/.test(bodyOf(css, panel))) {
      out.push(`${panel} lacks overscroll-behavior: contain`)
    }
  }
  if (/overscroll-behavior/.test(bodyOf(css, '.capa'))) out.push('.capa itself must not set overscroll-behavior')
  return out
}

/** The text of the pressed block: from its marker comment to the end of the sheet. */
function pressedBlock(css: string): string | null {
  const at = css.indexOf('/* pressed */')
  return at === -1 ? null : css.slice(at)
}

/** The pressed block exists, is one `:is(...):active` rule, uses declared tokens and no hex. */
export function pressedViolations(css: string, tokensCss: string): string[] {
  const block = pressedBlock(css)
  if (block === null) return ['no /* pressed */ block']
  const out: string[] = []
  const code = stripComments(block)
  if (!/:is\([^)]+\):active:not\(:disabled\):not\(\[aria-disabled='true'\]\)/.test(code)) {
    out.push('the pressed selector is not :is(...):active:not(:disabled):not([aria-disabled])')
  }
  if (/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl)a?\(/.test(code)) out.push('the pressed block uses a literal colour')
  if (!/transform:\s*scale\(/.test(code)) out.push('the pressed block has no transform cue')
  if (!/transition:\s*none/.test(code)) out.push('the pressed block keeps its transition')
  const declared = new Set(
    [...stripComments(tokensCss).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]),
  )
  for (const used of code.matchAll(/var\((--[a-z0-9-]+)/g)) {
    const name = used[1] ?? ''
    if (!declared.has(name)) out.push(`${name} is not declared in tokens.css`)
  }
  return out
}

/** A bare `button:active`, `a:active` or `*:active` would press `PasswordField` and the auth screens. */
export function bareActiveViolations(css: string): string[] {
  return rules(css)
    .flatMap((rule) => rule.selector.split(','))
    .map((selector) => selector.trim())
    .filter((selector) => /^(button|a|\*|html|body)(:active|:hover)/.test(selector))
}

test('the document does not bounce and the sheets contain their scroll', () => {
  expect(gestureViolations(file(APP_CSS))).toEqual([])
})

test('the pressed block is one token-only rule', () => {
  expect(pressedViolations(file(APP_CSS), file(TOKENS))).toEqual([])
})

/**
 * A link or button with a pressed look of its own resting fill must say so: the selected
 * variants (`--activo`, `--activa`) rest on `--superficie`, so they need their own fill cue.
 * Also: a control that is a Link in the pressed list must opt out of text selection too.
 */
export function pressedGapViolations(css: string): string[] {
  const code = stripComments(css.slice(Math.max(css.indexOf('/* pressed */'), 0)))
  const out: string[] = []
  for (const selected of ['.riel-lateral__item--activo', '.selector-pago__opcion--activa']) {
    const own = rules(code).some(
      (rule) =>
        rule.selector.includes(selected) &&
        rule.selector.includes(':active') &&
        /background-color:\s*var\(--linea\)/.test(rule.body),
    )
    if (!own) out.push(`${selected} has no pressed fill that differs from its resting one`)
  }
  for (const cls of ['.bloque-deben__titulo']) {
    const inBlocks = rules(code).filter((rule) => rule.selector.includes(cls))
    if (inBlocks.length < 2) out.push(`${cls} is not in both the pressed and the user-select rules`)
  }
  return out
}

test('the selected variants and the Te deben link are covered by the pressed block', () => {
  expect(pressedGapViolations(file(APP_CSS))).toEqual([])
  expect(pressedGapViolations('/* pressed */\n.x:active { transform: scale(0.98); }')).toEqual([
    '.riel-lateral__item--activo has no pressed fill that differs from its resting one',
    '.selector-pago__opcion--activa has no pressed fill that differs from its resting one',
    '.bloque-deben__titulo is not in both the pressed and the user-select rules',
  ])
})

test('no bare button:active, a:active or *:active anywhere', () => {
  expect(bareActiveViolations(file(APP_CSS))).toEqual([])
})

const GOOD_APP = `
html { -webkit-text-size-adjust: 100%; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
html,
body { overscroll-behavior: none; }
.capa__contenido { overscroll-behavior: contain; }
.cliente-sheet__contenido { overscroll-behavior: contain; }
/* pressed */
:is(.boton, .mas__item):active:not(:disabled):not([aria-disabled='true']) {
  transform: scale(0.98);
  background-color: var(--superficie);
  transition: none;
}`
const GOOD_TOKENS = ':root { --superficie: red; }'

test('the checks reject a stylesheet that breaks the rule, and accept one that keeps it', () => {
  expect(gestureViolations(GOOD_APP)).toEqual([])
  expect(gestureViolations(GOOD_APP.replace('touch-action: manipulation;', ''))).toEqual([
    'html lacks touch-action: manipulation',
  ])
  expect(gestureViolations(GOOD_APP.replace('overscroll-behavior: none', 'overscroll-behavior: auto'))).toEqual([
    'html, body lack overscroll-behavior: none',
  ])
  expect(gestureViolations(GOOD_APP.replace('.capa__contenido { overscroll-behavior: contain; }', ''))).toEqual([
    '.capa__contenido lacks overscroll-behavior: contain',
  ])
  expect(gestureViolations(`${GOOD_APP}\n.capa { overscroll-behavior: contain; }`)).toEqual([
    '.capa itself must not set overscroll-behavior',
  ])

  expect(pressedViolations(GOOD_APP, GOOD_TOKENS)).toEqual([])
  expect(pressedViolations('.x { color: red; }', GOOD_TOKENS)).toEqual(['no /* pressed */ block'])
  expect(pressedViolations(GOOD_APP.replace('var(--superficie)', '#f2eee6'), GOOD_TOKENS)).toEqual([
    'the pressed block uses a literal colour',
  ])
  expect(pressedViolations(GOOD_APP.replace('var(--superficie)', 'var(--inventado)'), GOOD_TOKENS)).toEqual([
    '--inventado is not declared in tokens.css',
  ])
  expect(pressedViolations(GOOD_APP.replace(':not(:disabled)', ''), GOOD_TOKENS)).toEqual([
    'the pressed selector is not :is(...):active:not(:disabled):not([aria-disabled])',
  ])
  expect(pressedViolations(GOOD_APP.replace('transition: none;', ''), GOOD_TOKENS)).toEqual([
    'the pressed block keeps its transition',
  ])

  expect(bareActiveViolations('button:active { opacity: 0.5; }')).toEqual(['button:active'])
  expect(bareActiveViolations('.a, a:active { opacity: 0.5; }')).toEqual(['a:active'])
  expect(bareActiveViolations(GOOD_APP)).toEqual([])
})
