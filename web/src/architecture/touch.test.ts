/**
 * The gesture and pressed-state rules, read from the raw stylesheets (GH-77, "touch and
 * keyboard"): `html` and `body` do not bounce, the sheets' scrolling panels contain
 * their scroll, and the one pressed block (marked by a `pressed` comment) uses tokens only, never a bare
 * `button:active`. `e2e/pressed.spec.ts` measures the cue itself on the built front.
 */

import { expect, test } from 'vitest'
import { productSources, scanControls, type ScanResult } from './controlScan'
import { EXEMPT, type ExemptEntry } from './pressedExempt'
import { PRESSED_BLOCK_AT_BDC2945 } from './pressedBlock.bdc2945'

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
  for (const panel of ['.capa__contenido', '.cliente-sheet__contenido', '.sheet__body']) {
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

// ---- coverage: every tappable control the markup renders has a pressed state --------------

/** One rule of the pressed block, as `:is(...):active` over a list of classes. */
interface PressedRule {
  selector: string
  classes: string[]
  body: string
}

/** The selector with its `:not(...)` groups removed: what they exclude is never pressed. */
function withoutNot(selector: string): string {
  let out = selector
  for (let at = out.indexOf(':not('); at !== -1; at = out.indexOf(':not(')) {
    let depth = 0
    let end = at
    for (; end < out.length; end += 1) {
      if (out[end] === '(') depth += 1
      if (out[end] === ')' && (depth -= 1) === 0) break
    }
    out = out.slice(0, at) + out.slice(end + 1)
  }
  return out
}

/** The last compound of a selector (`.a .b.c:x` -> `.b.c:x`), outside parentheses and brackets. */
function lastCompound(selector: string): string {
  let depth = 0
  let start = 0
  for (let at = 0; at < selector.length; at += 1) {
    const ch = selector[at] ?? ''
    if ('(['.includes(ch)) depth += 1
    else if (')]'.includes(ch)) depth -= 1
    else if (depth === 0 && /[\s>+~]/.test(ch)) start = at + 1
  }
  return selector.slice(start)
}

/** The classes of the element a selector presses: its last compound, `:not(...)` aside. */
function classesIn(selector: string): string[] {
  return [...lastCompound(withoutNot(selector)).matchAll(/\.[A-Za-z0-9_-]+/g)].map((match) => match[0])
}

/** The block's `:active` rules, in the order the stylesheet gives them. */
function pressedRules(css: string): PressedRule[] {
  const block = pressedBlock(css)
  if (block === null) return []
  return rules(block)
    .filter((rule) => rule.selector.includes(':active'))
    .map((rule) => ({ selector: rule.selector, classes: classesIn(rule.selector), body: rule.body }))
}

function pressedClasses(css: string): Set<string> {
  return new Set(pressedRules(css).flatMap((rule) => rule.classes))
}

const RING = /box-shadow:\s*inset[^;]*var\(--papel\)/
const FILL_SUPERFICIE = /background-color:\s*var\(--superficie\)/
const FILL_LINEA = /background-color:\s*var\(--linea\)/

/** The control scan over the product's sources, minus the test harnesses that live in `src/`. */
function scannedControls(): ScanResult {
  return scanControls(productSources().filter((source) => !source.source.includes('@testing-library')))
}

/**
 * A control a person can tap (found in the markup by `controlScan`) that carries none of the
 * pressed block's classes and is not in `EXEMPT` shows no pressed state. `EXEMPT` entries
 * are checked too: one whose classes no control carries any more, or that the block now
 * covers, is stale and fails.
 */
export function coverageViolations(css: string, scan: ScanResult, exempt: ExemptEntry[]): string[] {
  const covered = pressedClasses(css)
  const exemptClasses = new Set(exempt.flatMap((entry) => entry.classes))
  const out: string[] = []
  const seen = new Set<string>()
  for (const control of scan.controls) {
    const where = `${control.file}:${control.line}`
    if (control.classes.length === 0) {
      out.push(`${where} <${control.tag}> has no class, so it can carry no pressed state`)
      continue
    }
    if (control.classes.some((cls) => covered.has(`.${cls}`) || exemptClasses.has(cls))) continue
    const key = [...control.classes].sort().join(' ')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(`${where} <${control.tag}> .${control.classes.join(' .')} has no pressed state`)
  }
  const scanned = new Set(scan.controls.flatMap((control) => control.classes))
  for (const entry of exempt) {
    const label = entry.classes.map((cls) => `.${cls}`).join(' ')
    if (!entry.classes.some((cls) => scanned.has(cls))) out.push(`EXEMPT ${label} (${entry.screen}) is no longer rendered`)
    if (entry.classes.some((cls) => covered.has(`.${cls}`))) out.push(`EXEMPT ${label} (${entry.screen}) is now covered`)
  }
  return out
}

// A class ending in one of these two suffixes is a selected variant (`--activo` for a
// bar or period button, `--activa` for a tab or option). A new convention is added here.
const SELECTED_SUFFIX = /--(activo|activa)$/

function tokenOf(fill: string): string | null {
  return /^var\((--[a-z0-9-]+)\)$/.exec(fill)?.[1] ?? null
}

interface FlatRule {
  selector: string
  body: string
  /** The at-rule preludes around it (`@media (min-width: 900px)`). */
  media: string[]
}

/** Every style rule of a sheet, with the at-rules it sits in. */
function flatRules(css: string): FlatRule[] {
  const text = stripComments(css)
  const out: FlatRule[] = []
  const stack: string[] = []
  let start = 0
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '{') {
      const prelude = (text.slice(start, i).split(';').at(-1) ?? '').trim()
      if (prelude.startsWith('@')) {
        stack.push(prelude)
        start = i + 1
      } else {
        const end = text.indexOf('}', i)
        out.push({ selector: prelude, body: text.slice(i + 1, end), media: [...stack] })
        i = end
        start = end + 1
      }
    } else if (text[i] === '}') {
      stack.pop()
      start = i + 1
    }
  }
  return out
}

function splitTop(selector: string): string[] {
  const parts: string[] = []
  let depth = 0
  let from = 0
  for (let at = 0; at < selector.length; at += 1) {
    const ch = selector[at] ?? ''
    if ('(['.includes(ch)) depth += 1
    else if (')]'.includes(ch)) depth -= 1
    else if (ch === ',' && depth === 0) {
      parts.push(selector.slice(from, at))
      from = at + 1
    }
  }
  parts.push(selector.slice(from))
  return parts.map((part) => part.replace(/\s+/g, ' ').trim())
}

/** A place where a control rests: the part of a selector that paints it, and its fill. */
export type RestingContext = { selector: string; fill: string } | { selector: string; unreadable: true }

const STATE_PSEUDO = /:(hover|focus|focus-visible|focus-within|checked|active|disabled)(?![\w-])/

/**
 * Every comma-part before the pressed block whose last compound contains `.cls` and declares a
 * background: bare, compound, descendant, or inside a width `@media`. A part in a state
 * (`:hover`, `:checked`, `:disabled`...) is not resting. A fill that is not `var(--token)`,
 * `transparent` or `none`, or that is scoped to a theme (`[data-tema`, `prefers-color-scheme`),
 * is `unreadable`: it is named, never read as transparent.
 */
export function restingContexts(css: string, cls: string): RestingContext[] {
  const at = css.indexOf('/* pressed */')
  const named = new RegExp(`\\.${cls}(?![\\w-])`)
  const out: RestingContext[] = []
  for (const rule of flatRules(at === -1 ? css : css.slice(0, at))) {
    for (const part of splitTop(rule.selector)) {
      const subject = lastCompound(withoutNot(part))
      if (!named.test(subject) || STATE_PSEUDO.test(subject) || subject.includes('::')) continue
      const declared = [...rule.body.matchAll(/(?:^|;|\s)background(?:-color)?:\s*([^;]+)/g)].at(-1)?.[1]
      if (declared === undefined) continue
      const fill = declared.trim()
      const themed = part.includes('[data-tema') || rule.media.some((prelude) => /prefers-color-scheme/.test(prelude))
      const readable = tokenOf(fill) !== null || /^(transparent|none)$/.test(fill)
      out.push(themed || !readable ? { selector: part, unreadable: true } : { selector: part, fill })
    }
  }
  return out
}

/** The resting contexts of a class; `transparent` only when no part of the sheet gives it a background. */
export function restingFill(css: string, cls: string): RestingContext[] {
  const found = restingContexts(css, cls)
  return found.length > 0 ? found : [{ selector: `.${cls}`, fill: 'transparent' }]
}

/**
 * Whether one of the pressed rules shows a fill that differs from `fill`: the `--papel` ring
 * differs unless the control rests on `--papel` (and, for a selected variant, unless it paints
 * nothing, since a ring needs a token under it), a `background-color` token differs unless it is
 * the resting one.
 */
function pressedDiffers(rulesFor: PressedRule[], fill: string, ringNeedsToken: boolean): boolean {
  const token = tokenOf(fill)
  return rulesFor.some((rule) => {
    if (RING.test(rule.body) && token !== '--papel' && (!ringNeedsToken || token !== null)) return true
    const pressedToken = tokenOf(/background-color:\s*([^;]+)/.exec(rule.body)?.[1]?.trim() ?? '')
    return pressedToken !== null && pressedToken !== token
  })
}

function contextViolations(cls: string, contexts: RestingContext[], rulesFor: PressedRule[], ringNeedsToken: boolean): string[] {
  const out: string[] = []
  for (const context of contexts) {
    if ('unreadable' in context) {
      out.push(`.${cls}: the resting fill of "${context.selector}" cannot be read (not a token, transparent or none, or theme-scoped)`)
    } else if (!pressedDiffers(rulesFor, context.fill, ringNeedsToken)) {
      out.push(`.${cls} rests on ${context.fill} in "${context.selector}" and its pressed fill does not differ from it`)
    }
  }
  return out
}

/**
 * A selected control must show a pressed fill that differs from its resting fill in every
 * context the stylesheet gives it (its own and its base class's): either its own `:active` rule
 * sets another token, or it is in the filled group (the `--papel` ring) and rests on a token that
 * is not `--papel`. A context that cannot be read is a violation, never `transparent`.
 */
export function selectedVariantViolations(css: string, scan: ScanResult): string[] {
  const pressed = pressedRules(css)
  const variants = new Set(scan.controls.flatMap((control) => control.classes).filter((cls) => SELECTED_SUFFIX.test(cls)))
  return [...variants].sort().flatMap((variant) => {
    const base = variant.replace(SELECTED_SUFFIX, '')
    const found = [...restingContexts(css, variant), ...restingContexts(css, base)]
    const contexts: RestingContext[] = found.length > 0 ? found : [{ selector: `.${variant}`, fill: 'transparent' }]
    const rulesFor = pressed.filter(
      (rule) => rule.classes.includes(`.${variant}`) || (RING.test(rule.body) && rule.classes.includes(`.${base}`)),
    )
    return contextViolations(variant, contexts, rulesFor, true)
  })
}

/**
 * An ordinary covered control must not rest on the fill its own pressed rule paints, in any
 * context: one in the `--superficie` group on `--superficie`, one in the `--linea` group on
 * `--linea`, a ringed one on `--papel`. Selected variants have their own check.
 */
export function controlFillViolations(css: string, scan: ScanResult): string[] {
  const pressed = pressedRules(css)
  const covered = pressedClasses(css)
  const classes = new Set(
    scan.controls.flatMap((control) => control.classes).filter((cls) => !SELECTED_SUFFIX.test(cls) && covered.has(`.${cls}`)),
  )
  return [...classes].sort().flatMap((cls) =>
    contextViolations(cls, restingFill(css, cls), pressed.filter((rule) => rule.classes.includes(`.${cls}`)), false),
  )
}

/**
 * A control behind a label (`pressedOn`, the label a stretched native input sits in) must be in
 * the pressed block, in no rule that sets `transform` (the label would move from under the
 * finger), and only in rules that exclude its `--inactiva` class (the label never matches
 * `:disabled`).
 */
export function pressedOnViolations(css: string, scan: ScanResult, exempt: ExemptEntry[]): string[] {
  const pressed = pressedRules(css)
  const scanned = new Set(scan.controls.flatMap((control) => control.classes))
  const out: string[] = []
  for (const entry of exempt) {
    if (entry.pressedOn === undefined) continue
    const label = `.${entry.pressedOn}`
    const named = `EXEMPT .${entry.classes.join(' .')} presses ${label}`
    if (!entry.classes.some((cls) => scanned.has(cls))) out.push(`${named}, but no scanned control carries its classes`)
    const rulesOn = pressed.filter((rule) => rule.classes.includes(label))
    if (rulesOn.length === 0) out.push(`${named}, which is in no pressed rule`)
    for (const rule of rulesOn) {
      if (/transform:/.test(rule.body)) out.push(`${named}, which is in a pressed rule that sets transform`)
      if (!rule.selector.includes(`:not(${label}--inactiva)`)) out.push(`${named}, whose pressed rule does not exclude :not(${label}--inactiva)`)
    }
  }
  return out
}

/** Every pressed rule that sets `--linea` comes after every one that sets `--superficie`. */
export function orderViolations(css: string): string[] {
  const pressed = pressedRules(css)
  const out: string[] = []
  const lastSuperficie = pressed.findLastIndex((rule) => FILL_SUPERFICIE.test(rule.body))
  pressed.forEach((rule, index) => {
    if (FILL_LINEA.test(rule.body) && index < lastSuperficie) {
      out.push(`the --linea rule of ${rule.classes.join(', ')} comes before a --superficie rule and loses to it`)
    }
  })
  return out
}

/**
 * Rows whose text is the business's data. A tap on them opts out of the pressed state's
 * `user-select: none`, because their text stays selectable, as today (#77).
 */
const SELECTABLE: Record<string, string> = Object.fromEntries(
  [
    '.fila-venta',
    '.fila-gasto',
    '.fila-entrada',
    '.lista-clientes__fila',
    '.bloque-deben__fila',
    '.variedad-item',
    '.fila-entrada__enlace',
    '.bloque-deben__datos',
    '.variedad-fila',
    '.catalogo__fila-nombre',
  ].map(
    (cls) => [cls, 'row text is data and stays selectable, as today (#77)'],
  ),
)

/** The classes the `user-select: none` rule of the pressed block lists, and its bad selectors. */
function userSelectList(css: string): { listed: string[]; bad: string[] } {
  const block = pressedBlock(css)
  const listed: string[] = []
  const bad: string[] = []
  if (block === null) return { listed, bad }
  for (const rule of rules(block).filter((candidate) => /user-select:\s*none/.test(candidate.body))) {
    const inner = rule.selector.replace(/^:is\(([\s\S]*)\)$/, '$1')
    for (const part of inner.split(',').map((piece) => piece.trim())) {
      if (/^\.[A-Za-z0-9_-]+$/.test(part)) listed.push(part)
      else bad.push(part)
    }
  }
  return { listed, bad }
}

/**
 * The `user-select: none` rule names single classes only (never an element such as `input`,
 * `textarea`, `select`, `label` or `p`, which would make a field's or a list's text
 * unselectable), and every pressed class is in it, under a listed BEM block, or in
 * `SELECTABLE` with its reason.
 */
export function userSelectViolations(css: string, selectable: Record<string, string> = SELECTABLE): string[] {
  const { listed, bad } = userSelectList(css)
  const pressed = pressedClasses(css)
  const out = bad.map((selector) => `user-select: none lists "${selector}", which is not a single class`)
  const listedSet = new Set(listed)
  for (const cls of [...pressed].sort()) {
    // A modifier (`--activa`) answers as its base class; a BEM element as its block.
    const base = cls.replace(/--.*$/, '')
    const block = base.replace(/__.*$/, '')
    const opted = Object.hasOwn(selectable, cls) || Object.hasOwn(selectable, base)
    const isListed = listedSet.has(cls) || listedSet.has(base)
    if (opted && isListed) out.push(`${cls} is both in user-select: none and in SELECTABLE`)
    else if (!opted && !isListed && !listedSet.has(block)) {
      out.push(`${cls} is pressed but is neither in user-select: none nor in SELECTABLE`)
    }
  }
  for (const cls of Object.keys(selectable)) {
    if (!pressed.has(cls)) out.push(`SELECTABLE ${cls} is not a pressed class`)
  }
  return out
}

test('every tappable control the markup renders has a pressed state', () => {
  const scan = scannedControls()
  expect(scan.errors).toEqual([])
  expect(coverageViolations(file(APP_CSS), scan, EXEMPT)).toEqual([])
})

test('a selected control shows a pressed fill that differs from its resting one', () => {
  expect(selectedVariantViolations(file(APP_CSS), scannedControls())).toEqual([])
})

test('an ordinary control shows a pressed fill that differs from its resting one, in every context', () => {
  expect(controlFillViolations(file(APP_CSS), scannedControls())).toEqual([])
})

test('a label-wrapped control is pressed by fill only, and never when disabled', () => {
  expect(EXEMPT.some((entry) => entry.pressedOn === 'opcion-interruptor')).toBe(true)
  expect(pressedOnViolations(file(APP_CSS), scannedControls(), EXEMPT)).toEqual([])
})

test('the --linea pressed rules come after the --superficie ones', () => {
  expect(orderViolations(file(APP_CSS))).toEqual([])
})

test('every pressed class opts out of text selection, or says why its text stays selectable', () => {
  expect(userSelectViolations(file(APP_CSS))).toEqual([])
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
.sheet__body { overscroll-behavior: contain; }
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
  expect(gestureViolations(GOOD_APP.replace('.sheet__body { overscroll-behavior: contain; }', ''))).toEqual([
    '.sheet__body lacks overscroll-behavior: contain',
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

// ---- the coverage checks reject what they must ------------------------------------------

const GUARD = ":not(:disabled):not([aria-disabled='true'])"

function ruleFor(classes: string[], body: string): string {
  return `:is(${classes.join(', ')}):active${GUARD} { transform: scale(0.98); ${body} transition: none; }`
}

/** A stylesheet with a resting part and a pressed block made of the given rules. */
function sheet(resting: string, ...pressed: string[]): string {
  return `${resting}\n/* pressed */\n${pressed.join('\n')}`
}

function control(classes: string[], tag = 'button'): ScanResult['controls'][number] {
  return { file: 'src/Fixture.tsx', line: 7, tag, classes }
}

function scanOf(...controls: ScanResult['controls']): ScanResult {
  return { controls, errors: [] }
}

const RING_RULE = ruleFor(['.boton', '.pildora'], 'box-shadow: inset 0 0 0 3px var(--papel);')
const SUPERFICIE_RULE = ruleFor(['.mas__item'], 'background-color: var(--superficie);')
const LINEA_RULE = ruleFor(['.mas__item--activo'], 'background-color: var(--linea);')

test('a control with no pressed class fails, unless it is exempt for a reason', () => {
  const css = sheet('', RING_RULE)
  const exemptEntry: ExemptEntry = {
    classes: ['ajustes__item'],
    screen: 'Configuración',
    variant: 'none',
    reason: 'unclear whether it is tappable',
  }
  expect(coverageViolations(css, scanOf(control(['boton', 'boton--suave'])), [])).toEqual([])
  expect(coverageViolations(css, scanOf(control(['ajustes__item'], 'Link')), [])).toEqual([
    'src/Fixture.tsx:7 <Link> .ajustes__item has no pressed state',
  ])
  expect(coverageViolations(css, scanOf(control([], 'InAppLink')), [])).toEqual([
    'src/Fixture.tsx:7 <InAppLink> has no class, so it can carry no pressed state',
  ])
  expect(coverageViolations(css, scanOf(control(['ajustes__item'], 'Link')), [exemptEntry])).toEqual([])
  expect(coverageViolations(css, scanOf(control(['boton'])), [exemptEntry])).toEqual([
    'EXEMPT .ajustes__item (Configuración) is no longer rendered',
  ])
  expect(coverageViolations(css, scanOf(control(['pildora'])), [{ ...exemptEntry, classes: ['pildora'] }])).toEqual([
    'EXEMPT .pildora (Configuración) is now covered',
  ])
})

test('a selected variant must show a pressed fill that differs from its resting one', () => {
  const scan = scanOf(control(['pildora', 'pildora--activa']))
  const filled = (resting: string): string => sheet(resting, RING_RULE)
  expect(selectedVariantViolations(filled('.pildora--activa { background: var(--acento); }'), scan)).toEqual([])
  expect(selectedVariantViolations(filled('.pildora--activa { background: var(--papel); }'), scan)).toEqual([
    '.pildora--activa rests on var(--papel) in ".pildora--activa" and its pressed fill does not differ from it',
  ])
  expect(selectedVariantViolations(filled('.pildora--activa { background-color: transparent; }'), scan)).toEqual([
    '.pildora--activa rests on transparent in ".pildora--activa" and its pressed fill does not differ from it',
  ])
  expect(selectedVariantViolations(filled('.pildora--activa { background: linear-gradient(red, blue); }'), scan)).toEqual([
    '.pildora--activa: the resting fill of ".pildora--activa" cannot be read (not a token, transparent or none, or theme-scoped)',
  ])

  const own = scanOf(control(['mas__item', 'mas__item--activo']))
  const resting = (token: string): string => `.mas__item--activo { background: var(${token}); }`
  expect(selectedVariantViolations(sheet(resting('--superficie'), SUPERFICIE_RULE, LINEA_RULE), own)).toEqual([])
  expect(selectedVariantViolations(sheet(resting('--linea'), SUPERFICIE_RULE, LINEA_RULE), own)).toEqual([
    '.mas__item--activo rests on var(--linea) in ".mas__item--activo" and its pressed fill does not differ from it',
  ])
  expect(selectedVariantViolations(sheet(resting('--superficie'), SUPERFICIE_RULE), own)).toEqual([
    '.mas__item--activo rests on var(--superficie) in ".mas__item--activo" and its pressed fill does not differ from it',
  ])
  expect(selectedVariantViolations(sheet('.mas__item--activo { color: red; }', SUPERFICIE_RULE), own)).toEqual([
    '.mas__item--activo rests on transparent in ".mas__item--activo" and its pressed fill does not differ from it',
  ])
})

test('the --linea rules must come after the --superficie rules', () => {
  expect(orderViolations(sheet('', SUPERFICIE_RULE, LINEA_RULE))).toEqual([])
  expect(orderViolations(sheet('', LINEA_RULE, SUPERFICIE_RULE))).toEqual([
    'the --linea rule of .mas__item--activo comes before a --superficie rule and loses to it',
  ])
})

test('user-select: none lists single classes, and every pressed class is listed, in a listed block or selectable', () => {
  const none = (...selectors: string[]): string => `:is(${selectors.join(', ')}) { user-select: none; }`
  const pressedRules = sheet('', SUPERFICIE_RULE, LINEA_RULE)
  expect(userSelectViolations(`${pressedRules}\n${none('.mas__item')}`, {})).toEqual([])
  expect(userSelectViolations(`${pressedRules}\n${none('.otro')}`, {})).toEqual([
    '.mas__item is pressed but is neither in user-select: none nor in SELECTABLE',
    '.mas__item--activo is pressed but is neither in user-select: none nor in SELECTABLE',
  ])
  expect(userSelectViolations(`${pressedRules}\n${none('.mas__item', '.mas__item--activo')}`, {})).toEqual([])
  expect(userSelectViolations(`${pressedRules}\n${none('.mas')}`, {})).toEqual([])
  expect(userSelectViolations(pressedRules, { '.mas__item': 'row text is data' })).toEqual([])
  expect(userSelectViolations(`${pressedRules}\n${none('.mas__item')}`, { '.mas__item': 'row text is data' })).toEqual([
    '.mas__item is both in user-select: none and in SELECTABLE',
    '.mas__item--activo is both in user-select: none and in SELECTABLE',
  ])
  expect(userSelectViolations(`${pressedRules}\n${none('.mas__item')}`, { '.fila': 'row text is data' })).toEqual([
    'SELECTABLE .fila is not a pressed class',
  ])
  for (const bad of ['input', 'textarea', 'label', 'p', '*', '.mas__item input', "[contenteditable='true']"]) {
    expect(userSelectViolations(`${pressedRules}\n${none('.mas__item', bad)}`, {})).toEqual([
      `user-select: none lists "${bad}", which is not a single class`,
    ])
  }
})

// ---- resting contexts, the fill checks and the pressedOn check reject what they must ---------

const LIGHT_RING = ruleFor(['.boton'], 'box-shadow: inset 0 0 0 3px var(--papel);')
const SUPERFICIE_ROW = ruleFor(['.fila'], 'background-color: var(--superficie);')
const LINEA_BLOCK = ruleFor(['.aviso'], 'background-color: var(--linea);')

test('restingFill lists every context a class rests in, and never reads an unreadable one as transparent', () => {
  const fills = (css: string, cls: string): unknown => restingFill(css, cls)
  // a class nobody paints is transparent, and that is the only way to get transparent
  expect(fills('.x { color: red; }', 'x')).toEqual([{ selector: '.x', fill: 'transparent' }])
  expect(fills('.x { background: none; }', 'x')).toEqual([{ selector: '.x', fill: 'none' }])
  // a descendant part and a compound part
  expect(fills('.lista .x { background: var(--superficie); }', 'x')).toEqual([{ selector: '.lista .x', fill: 'var(--superficie)' }])
  expect(fills('.a.x { background-color: var(--linea); }', 'x')).toEqual([{ selector: '.a.x', fill: 'var(--linea)' }])
  // two agreeing contexts and two differing ones are all listed
  expect(fills('.x { background: var(--papel); } .lista .x { background: var(--papel); }', 'x')).toEqual([
    { selector: '.x', fill: 'var(--papel)' },
    { selector: '.lista .x', fill: 'var(--papel)' },
  ])
  expect(fills('.x, .y { background: var(--papel); } .lista .x { background: var(--superficie); }', 'x')).toEqual([
    { selector: '.x', fill: 'var(--papel)' },
    { selector: '.lista .x', fill: 'var(--superficie)' },
  ])
  // inside a width @media it is one more context
  expect(fills('@media (min-width: 900px) { .x { background: var(--linea); } }', 'x')).toEqual([
    { selector: '.x', fill: 'var(--linea)' },
  ])
  // unreadable, naming the selector: a literal, a theme attribute, a colour-scheme query
  expect(fills('.x { background: #fff; }', 'x')).toEqual([{ selector: '.x', unreadable: true }])
  expect(fills('[data-tema=oscuro] .x { background: var(--papel); }', 'x')).toEqual([
    { selector: '[data-tema=oscuro] .x', unreadable: true },
  ])
  expect(fills('@media (prefers-color-scheme: dark) { .x { background: var(--papel); } }', 'x')).toEqual([
    { selector: '.x', unreadable: true },
  ])
  // a state, a pseudo-element, a :not() class and the pressed block are not resting
  expect(fills('.x:hover, .x:checked, .x:disabled { background: var(--linea); } .x::before { background: red; }', 'x')).toEqual([
    { selector: '.x', fill: 'transparent' },
  ])
  expect(fills('.y:not(.x) { background: var(--linea); }', 'x')).toEqual([{ selector: '.x', fill: 'transparent' }])
  expect(fills(`.x { color: red; }\n/* pressed */\n.x { background: var(--linea); }`, 'x')).toEqual([
    { selector: '.x', fill: 'transparent' },
  ])
})

test('a selected variant is checked in every resting context, and an unreadable one is named', () => {
  const scan = scanOf(control(['mas__item', 'mas__item--activo']))
  const pressed = [SUPERFICIE_RULE, LINEA_RULE]
  expect(selectedVariantViolations(sheet('.lista .mas__item--activo { background: var(--superficie); }', ...pressed), scan)).toEqual([])
  expect(selectedVariantViolations(sheet('.lista .mas__item--activo { background: var(--linea); }', ...pressed), scan)).toEqual([
    '.mas__item--activo rests on var(--linea) in ".lista .mas__item--activo" and its pressed fill does not differ from it',
  ])
  // both contexts are checked, so the differing one that collides is the one reported
  expect(
    selectedVariantViolations(
      sheet('.mas__item--activo { background: var(--superficie); } .lista .mas__item--activo { background: var(--linea); }', ...pressed),
      scan,
    ),
  ).toEqual(['.mas__item--activo rests on var(--linea) in ".lista .mas__item--activo" and its pressed fill does not differ from it'])
  const unreadable = '.mas__item--activo: the resting fill of "[data-tema=oscuro] .mas__item--activo" cannot be read (not a token, transparent or none, or theme-scoped)'
  expect(
    selectedVariantViolations(sheet('[data-tema=oscuro] .mas__item--activo { background: var(--superficie); }', ...pressed), scan),
  ).toEqual([unreadable])
  expect(
    selectedVariantViolations(sheet('.mas__item--activo { background: #fff; }', ...pressed), scan),
  ).toEqual(['.mas__item--activo: the resting fill of ".mas__item--activo" cannot be read (not a token, transparent or none, or theme-scoped)'])
})

test('an ordinary control must not rest on its own pressed fill in any context', () => {
  const scan = scanOf(control(['fila']), control(['aviso']), control(['boton']))
  const css = (resting: string): string => sheet(resting, SUPERFICIE_ROW, LINEA_BLOCK, LIGHT_RING)
  expect(controlFillViolations(css('.fila { background: none; } .aviso { background: var(--superficie); } .boton { background: var(--boton); }'), scan)).toEqual([])
  expect(controlFillViolations(css('.fila { background: var(--superficie); }'), scan)).toEqual([
    '.fila rests on var(--superficie) in ".fila" and its pressed fill does not differ from it',
  ])
  expect(controlFillViolations(css('.aviso { background: var(--linea); }'), scan)).toEqual([
    '.aviso rests on var(--linea) in ".aviso" and its pressed fill does not differ from it',
  ])
  expect(controlFillViolations(css('.boton { background: var(--papel); }'), scan)).toEqual([
    '.boton rests on var(--papel) in ".boton" and its pressed fill does not differ from it',
  ])
  // only one of its contexts collides
  expect(controlFillViolations(css('.fila { background: none; } .lista .fila { background: var(--superficie); }'), scan)).toEqual([
    '.fila rests on var(--superficie) in ".lista .fila" and its pressed fill does not differ from it',
  ])
  expect(controlFillViolations(css('.fila { background: rgb(1, 2, 3); }'), scan)).toEqual([
    '.fila: the resting fill of ".fila" cannot be read (not a token, transparent or none, or theme-scoped)',
  ])
})

test('classesIn counts the pressed element only', () => {
  expect(classesIn(".venta-guardada .boton--enlace:active:not(:disabled):not([aria-disabled='true'])")).toEqual(['.boton--enlace'])
  expect(classesIn('.opcion-interruptor:not(.opcion-interruptor--inactiva):active')).toEqual(['.opcion-interruptor'])
  expect(classesIn(':is(.a, .b.c):active:not(:disabled)')).toEqual(['.a', '.b', '.c'])
  expect(classesIn('.lista > .fila + .otra:active')).toEqual(['.otra'])
})

test('the pressedOn check rejects the switch as #102 left it, and a rule without the --inactiva exclusion', () => {
  const switchScan = scanControls(productSources().filter((source) => source.path.endsWith('OpcionInterruptor.tsx')))
  expect(switchScan.errors).toEqual([])
  expect(switchScan.controls.flatMap((found) => found.classes)).toContain('opcion-interruptor__input')
  expect(pressedOnViolations(file(APP_CSS), switchScan, EXEMPT)).toEqual([])

  const label = '.opcion-interruptor'
  const named = 'EXEMPT .opcion-interruptor__input presses .opcion-interruptor'
  expect(pressedOnViolations(PRESSED_BLOCK_AT_BDC2945, switchScan, EXEMPT)).toEqual([
    `${named}, which is in a pressed rule that sets transform`,
    `${named}, whose pressed rule does not exclude :not(${label}--inactiva)`,
  ])
  expect(pressedOnViolations(sheet('', ruleFor(['.fila'], 'background-color: var(--superficie);')), switchScan, EXEMPT)).toEqual([
    `${named}, which is in no pressed rule`,
  ])
  const fillOnly = (selector: string): string => sheet('', `${selector} { background-color: var(--superficie); transition: none; }`)
  expect(pressedOnViolations(fillOnly('.opcion-interruptor:active'), switchScan, EXEMPT)).toEqual([
    `${named}, whose pressed rule does not exclude :not(${label}--inactiva)`,
  ])
  expect(pressedOnViolations(fillOnly('.opcion-interruptor:not(.opcion-interruptor--inactiva):active'), switchScan, EXEMPT)).toEqual([])
  expect(pressedOnViolations(fillOnly('.opcion-interruptor:not(.opcion-interruptor--inactiva):active'), scanOf(control(['boton'])), EXEMPT)).toEqual([
    `${named}, but no scanned control carries its classes`,
  ])
})
