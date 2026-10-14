/**
 * The gesture and pressed-state rules, read from the raw stylesheets (GH-77, "touch and
 * keyboard"): `html` and `body` do not bounce, the sheets' scrolling panels contain
 * their scroll, and the one pressed block (marked by a `pressed` comment) uses tokens only, never a bare
 * `button:active`. `e2e/pressed.spec.ts` measures the cue itself on the built front.
 */

import { expect, test } from 'vitest'
import { productSources, scanControls, type ScanResult } from './controlScan'
import { EXEMPT, type ExemptEntry } from './pressedExempt'

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

// ---- coverage: every tappable control the markup renders has a pressed state --------------

/** One rule of the pressed block, as `:is(...):active` over a list of classes. */
interface PressedRule {
  classes: string[]
  body: string
}

function classesIn(selector: string): string[] {
  return [...selector.matchAll(/\.[A-Za-z0-9_-]+/g)].map((match) => match[0])
}

/** The block's `:active` rules, in the order the stylesheet gives them. */
function pressedRules(css: string): PressedRule[] {
  const block = pressedBlock(css)
  if (block === null) return []
  return rules(block)
    .filter((rule) => rule.selector.includes(':active'))
    .map((rule) => ({ classes: classesIn(rule.selector), body: rule.body }))
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

// The last compound of a selector part is the element it paints (`.lista .fila--activa`
// paints `.fila--activa`).
function subjectOf(part: string): string {
  return part.trim().split(/\s*[>+~]\s*|\s+/).at(-1) ?? ''
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type Resting = { fill: string | null } | { unreadable: string }

/**
 * The fill `cls` rests on, from the rules before the pressed block whose subject is exactly
 * `.cls` (alone or under an ancestor). A rule that paints it through a compound subject
 * (`.a.cls`, `.cls[x]`, `.cls:not(.y)`) is not read: the answer is "unreadable", never a
 * silent `transparent`.
 */
function restingFill(css: string, cls: string): Resting {
  const at = css.indexOf('/* pressed */')
  const resting = at === -1 ? css : css.slice(0, at)
  const mention = new RegExp(`\\.${escapeRegExp(cls)}(?![A-Za-z0-9_-])`)
  const own: string[] = []
  for (const rule of rules(resting)) {
    const fills = [...rule.body.matchAll(/(?:^|;|\s)background(?:-color)?:\s*([^;]+)/g)].map((match) => (match[1] ?? '').trim())
    if (fills.length === 0) continue
    for (const part of rule.selector.split(',')) {
      const subject = subjectOf(part)
      if (subject === `.${cls}`) own.push(...fills)
      else if (mention.test(subject) && !subject.includes('::')) {
        return { unreadable: `${part.trim()} paints it through a compound selector` }
      }
    }
  }
  return { fill: own.at(-1) ?? null }
}

function tokenOf(fill: string): string | null {
  return /^var\((--[a-z0-9-]+)\)$/.exec(fill)?.[1] ?? null
}

/**
 * A selected control must show a pressed fill that differs from its resting fill: either
 * its own `:active` rule sets another token, or it is in the filled group (the `--papel`
 * ring) and rests on a token that is not `--papel`.
 */
export function selectedVariantViolations(css: string, scan: ScanResult): string[] {
  const pressed = pressedRules(css)
  const ringed = new Set(pressed.filter((rule) => RING.test(rule.body)).flatMap((rule) => rule.classes))
  const variants = new Set(scan.controls.flatMap((control) => control.classes).filter((cls) => SELECTED_SUFFIX.test(cls)))
  const out: string[] = []
  for (const variant of [...variants].sort()) {
    const base = variant.replace(SELECTED_SUFFIX, '')
    const own1 = restingFill(css, variant)
    if ('unreadable' in own1) {
      out.push(`.${variant}: its resting fill cannot be read (${own1.unreadable})`)
      continue
    }
    const own2 = own1.fill === null ? restingFill(css, base) : own1
    if ('unreadable' in own2) {
      out.push(`.${variant}: the resting fill of its base .${base} cannot be read (${own2.unreadable})`)
      continue
    }
    // No background declared on the variant or its base: it paints nothing of its own.
    const fill = own2.fill ?? 'transparent'
    const token = tokenOf(fill)
    if (token === null && !/^(transparent|none)$/.test(fill)) {
      out.push(`.${variant}: its resting fill "${fill}" cannot be read as a token, transparent or none`)
      continue
    }
    const inFilledGroup = ringed.has(`.${variant}`) || ringed.has(`.${base}`)
    if (inFilledGroup && token !== null && token !== '--papel') continue
    const own = pressed.some((rule) => {
      if (!rule.classes.includes(`.${variant}`)) return false
      const pressedToken = tokenOf(/background-color:\s*([^;]+)/.exec(rule.body)?.[1]?.trim() ?? '')
      return pressedToken !== null && pressedToken !== token
    })
    if (own) continue
    out.push(`.${variant} rests on ${fill} and its pressed fill does not differ from it`)
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
    '.pildora--activa rests on var(--papel) and its pressed fill does not differ from it',
  ])
  expect(selectedVariantViolations(filled('.pildora--activa { background-color: transparent; }'), scan)).toEqual([
    '.pildora--activa rests on transparent and its pressed fill does not differ from it',
  ])
  expect(selectedVariantViolations(filled('.pildora--activa { background: linear-gradient(red, blue); }'), scan)).toEqual([
    '.pildora--activa: its resting fill "linear-gradient(red, blue)" cannot be read as a token, transparent or none',
  ])

  // A resting fill painted under an ancestor is read; one painted through a compound
  // subject cannot be read, and that fails instead of reading as transparent.
  expect(
    selectedVariantViolations(filled('.lista .pildora--activa { background: var(--superficie); }'), scan),
  ).toEqual([])
  expect(
    selectedVariantViolations(filled('.pildora.pildora--activa:not(.x) { background: var(--superficie); }'), scan),
  ).toEqual([
    '.pildora--activa: its resting fill cannot be read (.pildora.pildora--activa:not(.x) paints it through a compound selector)',
  ])

  const own = scanOf(control(['mas__item', 'mas__item--activo']))
  const resting = (token: string): string => `.mas__item--activo { background: var(${token}); }`
  expect(selectedVariantViolations(sheet(resting('--superficie'), SUPERFICIE_RULE, LINEA_RULE), own)).toEqual([])
  expect(selectedVariantViolations(sheet(resting('--linea'), SUPERFICIE_RULE, LINEA_RULE), own)).toEqual([
    '.mas__item--activo rests on var(--linea) and its pressed fill does not differ from it',
  ])
  expect(selectedVariantViolations(sheet(resting('--superficie'), SUPERFICIE_RULE), own)).toEqual([
    '.mas__item--activo rests on var(--superficie) and its pressed fill does not differ from it',
  ])
  expect(selectedVariantViolations(sheet('.mas__item--activo { color: red; }', SUPERFICIE_RULE), own)).toEqual([
    '.mas__item--activo rests on transparent and its pressed fill does not differ from it',
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
