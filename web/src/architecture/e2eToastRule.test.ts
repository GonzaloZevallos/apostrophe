// @vitest-environment node
/**
 * The e2e toast rule (GH-288, ADR-0040 "success toasts are observed in the page"): a step that
 * raises a success toast asserts it with `expectToast` (`web/e2e/helpers/toast.ts`), which reads
 * the in-page recorder, and not with `getByText(<toast>)` + `toBeVisible`/`waitFor`, which polls
 * from outside the page and can land after the toast's own timer.
 *
 * This guard reads every `web/e2e/**\/*.ts` with the TypeScript parser (as `copyOnly.ts` does) and
 * flags a `getByText(<a success toast>)`, or an unscoped `getByRole('status')`, that reaches
 * `toBeVisible()` or `waitFor()` - directly, through a same-file `const` alias, or by escaping the
 * file (returned, or passed as an argument), which it cannot follow. A flagged site must be on
 * `KEPT` (page text stays the better check, with a reason) or on `PENDING` (not migrated yet;
 * the list only shrinks). It also checks that no `browser.newContext(...)` outside `fixtures.ts`
 * escapes `withToastRecorder`, and that only the elements the evidence doc lists render
 * `.aviso-exito` or `.toast` with `role="status"` in `web/src`.
 *
 * It is a ratchet, not a proof: a locator built by a helper in another module, or a text held
 * in a variable, is invisible to it.
 */

import { readdirSync, readFileSync } from 'node:fs'
import * as path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import type { SuccessToast } from '../components/AvisoExito'
import { CATALOG_TEXT } from '../copy/catalog'
import { COMMON_TEXT } from '../copy/common'
import { CUSTOMERS_TEXT } from '../copy/customers'
import { EXPENSES_TEXT } from '../copy/expenses'
import { PAYMENTS_TEXT } from '../copy/payments'
import { PINNED_CATALOG_TEXT } from '../copy/pinnedCatalog'
import { SALES_TEXT } from '../copy/sales'
import { CATALOG_SAVED, PASSWORD_CHANGED_SUCCESS, PRICES_SAVED, RENAME_SUCCESS, SETTINGS_TEXT } from '../copy/settings'
import { STOCK_TEXT } from '../copy/stock'
import { PRICE_SAVED, THRESHOLD_SAVED, VARIETIES_TEXT } from '../copy/varieties'

// Vitest runs with `web/` as its root (`npm --prefix web test`).
const WEB_ROOT = process.cwd()
const SLASH = String.fromCharCode(47)
const E2E_DIR = path.join(WEB_ROOT, 'e2e')
const SRC_DIR = path.join(WEB_ROOT, 'src')

/** The text every `savedStillOwing(balance)` starts with; the balance after it is free. */
export const STILL_OWING_PREFIX = 'Payment saved · still owing '

/**
 * The closed set of success toasts (`SuccessToast`, `components/AvisoExito.tsx`), each copy
 * constant once. `savedStillOwing` is one prefix entry: the balance after the prefix is free.
 */
export const SUCCESS_TOASTS = [
  COMMON_TEXT.customerSaved,
  COMMON_TEXT.entrySaved,
  COMMON_TEXT.entryDeleted,
  VARIETIES_TEXT.variedadGuardada,
  VARIETIES_TEXT.variedadEliminada,
  VARIETIES_TEXT.variedadArchivada,
  VARIETIES_TEXT.variedadRestaurada,
  PRICE_SAVED,
  VARIETIES_TEXT.precioEliminado,
  EXPENSES_TEXT.expenseSaved,
  EXPENSES_TEXT.expenseDeleted,
  SETTINGS_TEXT.categorySaved,
  SETTINGS_TEXT.categoryDeleted,
  RENAME_SUCCESS,
  PASSWORD_CHANGED_SUCCESS,
  SETTINGS_TEXT.invitationReady,
  SALES_TEXT.customerAssigned,
  THRESHOLD_SAVED,
  CATALOG_SAVED,
  PRICES_SAVED,
  CATALOG_TEXT.catalogoCopiado,
  CUSTOMERS_TEXT.paymentDeleted,
  PAYMENTS_TEXT.saved,
  { prefix: STILL_OWING_PREFIX },
  SETTINGS_TEXT.testSent,
  PINNED_CATALOG_TEXT.catalogPublished,
  STOCK_TEXT.retiroGuardado,
  STOCK_TEXT.retiroEliminado,
] as const

type TextOf<E> = E extends { prefix: infer P extends string } ? `${P}${string}` : E
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

/** `true` only while the list and the `SuccessToast` union hold the same members, both ways. */
const listMatchesUnion: Equal<TextOf<(typeof SUCCESS_TOASTS)[number]>, SuccessToast> = true

const EXACT_TOASTS: ReadonlySet<string> = new Set(
  SUCCESS_TOASTS.flatMap((entry) => (typeof entry === 'string' ? [entry] : [])),
)

function isToastText(text: string): boolean {
  return EXACT_TOASTS.has(text) || text.startsWith(STILL_OWING_PREFIX)
}

/** A regex literal's source as the text it matches when it is a plain run of characters. */
function regexText(source: string): string {
  return source.replace(/^\^/, '').replace(/\$$/, '').replace(/\\(.)/g, '$1')
}

// ---------------------------------------------------------------------------------------------
// The scan of one e2e source
// ---------------------------------------------------------------------------------------------

export interface Site {
  /** 1-based line of the toast locator. */
  line: number
  kind: 'visible' | 'waitFor' | 'escapes'
}

/** Methods that keep a locator a locator, so the chain after them is still the same toast. */
const LOCATOR_STEPS = new Set(['first', 'last', 'nth', 'filter', 'and', 'or', 'locator', 'getByText', 'getByRole'])

function stripWrappers(node: ts.Node): ts.Node {
  let current = node
  while (ts.isParenthesizedExpression(current) || ts.isAwaitExpression(current) || ts.isNonNullExpression(current)) {
    current = current.expression
  }
  return current
}

function literalText(node: ts.Node | undefined): string | undefined {
  if (node === undefined) return undefined
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) return node.head.text
  return undefined
}

const REGEX_BODY = /^\/(.*)\/[a-z]*$/s

/** A `getByText` argument that is a success toast: its text, or a regex that starts with the prefix. */
function isToastArgument(node: ts.Node | undefined): boolean {
  if (node === undefined) return false
  if (ts.isRegularExpressionLiteral(node)) {
    const source = REGEX_BODY.exec(node.text)?.[1] ?? ''
    return regexText(source).startsWith(STILL_OWING_PREFIX.trimEnd())
  }
  const text = literalText(node)
  if (text === undefined) return false
  return ts.isTemplateExpression(node) ? text.startsWith(STILL_OWING_PREFIX) : isToastText(text)
}

function objectProperty(node: ts.Node | undefined, name: string): ts.Node | undefined {
  if (node === undefined || !ts.isObjectLiteralExpression(node)) return undefined
  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property) && property.name.getText() === name) return property.initializer
  }
  return undefined
}

function calledName(call: ts.CallExpression): string | undefined {
  return ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : undefined
}

/** True when `call` is `getByRole('status')` with no `name` option. */
function isUnscopedStatus(call: ts.CallExpression): boolean {
  if (calledName(call) !== 'getByRole') return false
  const [role, options] = call.arguments
  return literalText(role) === 'status' && objectProperty(options, 'name') === undefined
}

/** True when this call alone makes the locator a success toast's. */
function isToastLeaf(call: ts.CallExpression): boolean {
  const name = calledName(call)
  if (name === 'getByText') return isToastArgument(call.arguments[0])
  if (name === 'filter') return isToastArgument(objectProperty(call.arguments[0], 'hasText'))
  if (name === 'getByRole') {
    const [role, options] = call.arguments
    return literalText(role) === 'status' && isToastArgument(objectProperty(options, 'name'))
  }
  return false
}

/** True when `node` is a locator chain on `getByRole('status')` that a non-toast text narrows. */
function narrowedByOtherText(call: ts.CallExpression): boolean {
  const name = calledName(call)
  return name === 'getByText' || name === 'filter'
}

/** The first-line number of a node. */
function lineOf(file: ts.SourceFile, node: ts.Node): number {
  return file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
}

/**
 * Every toast assertion in one e2e source that polls the page for a success toast, in reading
 * order, once per line.
 */
export function findToastSites(source: string): Site[] {
  const file = ts.createSourceFile('spec.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

  // Pass 1: `const x = <toast locator>` aliases, by name.
  const aliases = new Set<string>()
  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
      if (isToastChain(node.initializer)) aliases.add(node.name.text)
    }
    ts.forEachChild(node, collect)
  }

  /** True when the locator chain `expression` ends on a success toast (or an alias of one). */
  function isToastChain(expression: ts.Node): boolean {
    const node = stripWrappers(expression)
    if (ts.isIdentifier(node)) return aliases.has(node.text)
    if (!ts.isCallExpression(node)) return false
    const name = calledName(node)
    if (name === undefined || !LOCATOR_STEPS.has(name)) return false
    if (isToastLeaf(node)) return true
    const receiver = ts.isPropertyAccessExpression(node.expression) ? node.expression.expression : undefined
    if (receiver === undefined) return false
    const inner = stripWrappers(receiver)
    if (ts.isCallExpression(inner) && isUnscopedStatus(inner)) return !narrowedByOtherText(node)
    return isToastChain(receiver)
  }
  collect(file)
  // A second round lets an alias defined from an alias resolve in any order.
  collect(file)

  const found = new Map<number, Site['kind']>()
  const note = (node: ts.Node, kind: Site['kind']): void => {
    const line = lineOf(file, node)
    if (!found.has(line)) found.set(line, kind)
  }

  /** The top of the locator chain that `node` starts, climbing through the steps that keep a locator. */
  const climb = (node: ts.Node): ts.Node => {
    let top: ts.Node = node
    for (;;) {
      let parent: ts.Node = top.parent
      while (ts.isParenthesizedExpression(parent) || ts.isAwaitExpression(parent)) {
        top = parent
        parent = parent.parent
      }
      if (ts.isPropertyAccessExpression(parent) && parent.expression === top && LOCATOR_STEPS.has(parent.name.text)) {
        const call = parent.parent
        if (ts.isCallExpression(call) && call.expression === parent) {
          top = call
          continue
        }
      }
      return top
    }
  }

  const visit = (node: ts.Node): void => {
    const isLeaf =
      (ts.isCallExpression(node) && (isToastLeaf(node) || isUnscopedStatus(node))) ||
      (ts.isIdentifier(node) && aliases.has(node.text) && !isDeclarationName(node))
    if (isLeaf && !(ts.isCallExpression(node) && partOfLongerLeaf(node))) {
      const top = climb(node)
      if (isToastChain(top) || (ts.isCallExpression(node) && isUnscopedStatus(node) && !narrowedAbove(top, node))) {
        classify(top, node)
      }
    }
    ts.forEachChild(node, visit)
  }

  /** `getByRole('status')` that a later `.getByText`/`.filter` on the same chain narrows. */
  function narrowedAbove(top: ts.Node, leaf: ts.Node): boolean {
    let current: ts.Node = leaf
    while (current !== top) {
      current = current.parent
      if (ts.isCallExpression(current) && current !== leaf && narrowedByOtherText(current)) return true
    }
    return false
  }

  /** A leaf call that is the receiver chain of a bigger toast leaf is reported by that leaf. */
  function partOfLongerLeaf(call: ts.CallExpression): boolean {
    let current: ts.Node = call
    while (current.parent !== undefined) {
      const parent: ts.Node = current.parent
      if (ts.isPropertyAccessExpression(parent) && parent.expression === current && ts.isCallExpression(parent.parent)) {
        const outer = parent.parent
        if (isToastLeaf(outer)) return true
        current = outer
        continue
      }
      return false
    }
    return false
  }

  function isDeclarationName(identifier: ts.Identifier): boolean {
    return ts.isVariableDeclaration(identifier.parent) && identifier.parent.name === identifier
  }

  function classify(top: ts.Node, leaf: ts.Node): void {
    const parent = top.parent
    // `<locator>.waitFor(...)`.
    if (ts.isPropertyAccessExpression(parent) && parent.expression === top) {
      if (parent.name.text === 'waitFor') note(leaf, 'waitFor')
      return
    }
    if (ts.isCallExpression(parent) && parent.arguments.includes(top as ts.Expression)) {
      // `expect(<locator>).toBeVisible()`; `.not` and the other matchers are not flagged.
      if (ts.isIdentifier(parent.expression) && parent.expression.text === 'expect') {
        const matcher = parent.parent
        if (ts.isPropertyAccessExpression(matcher) && matcher.name.text === 'toBeVisible') note(leaf, 'visible')
        return
      }
      note(leaf, 'escapes')
      return
    }
    if (ts.isReturnStatement(parent) || (ts.isArrowFunction(parent) && parent.body === top)) note(leaf, 'escapes')
  }

  visit(file)
  return [...found.entries()].sort(([a], [b]) => a - b).map(([line, kind]) => ({ line, kind }))
}

/** How many `expectToast(...)` calls `source` makes. */
export function countExpectToasts(source: string): number {
  const file = ts.createSourceFile('spec.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let count = 0
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'expectToast') count += 1
    ts.forEachChild(node, visit)
  }
  visit(file)
  return count
}

// ---------------------------------------------------------------------------------------------
// `browser.newContext(...)` outside `fixtures.ts`
// ---------------------------------------------------------------------------------------------

/** The lines of every `<x>.newContext(...)` call in `source` that is not the argument of `withToastRecorder`. */
export function findBareNewContexts(source: string): number[] {
  const file = ts.createSourceFile('spec.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const lines: number[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && calledName(node) === 'newContext') {
      let parent: ts.Node = node.parent
      while (ts.isAwaitExpression(parent) || ts.isParenthesizedExpression(parent)) parent = parent.parent
      const wrapped =
        ts.isCallExpression(parent) &&
        ts.isIdentifier(parent.expression) &&
        parent.expression.text === 'withToastRecorder' &&
        parent.arguments[0] !== undefined &&
        stripWrappers(parent.arguments[0]) === node
      if (!wrapped) lines.push(lineOf(file, node))
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return lines
}

// ---------------------------------------------------------------------------------------------
// The elements of `web/src` the recorder watches
// ---------------------------------------------------------------------------------------------

/**
 * The elements that render `.aviso-exito` or `.toast` with `role="status"`: file (relative to
 * `src/`) and class. `docs/evidence/GH-288-e2e-flake.md` lists the same ones; adding an element
 * means the recorder sees a new kind of toast, so the evidence and this list change together.
 */
export const TOAST_ELEMENTS: readonly string[] = [
  'components/AvisoExito.tsx .aviso-exito',
  'components/Notice.tsx .toast',
  'screens/clientes/ClienteFicha.tsx .toast',
]

const RECORDED_CLASSES = ['aviso-exito', 'toast']

function stringsIn(node: ts.Node): string[] {
  const text = literalText(node)
  const own = text === undefined ? [] : [text]
  const nested: string[] = []
  ts.forEachChild(node, (child) => {
    nested.push(...stringsIn(child))
  })
  return [...own, ...nested]
}

/** `<file> .<class>` for every JSX element in `source` with `role="status"` and a recorded class. */
export function findToastElements(source: string, name: string): string[] {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute)
      const valueOf = (attribute: string): string[] => {
        const match = attributes.find((candidate) => candidate.name.getText(file) === attribute)
        return match?.initializer === undefined ? [] : stringsIn(match.initializer)
      }
      if (valueOf('role').includes('status')) {
        const tokens = valueOf('className').flatMap((value) => value.split(/\s+/))
        for (const recorded of RECORDED_CLASSES) {
          if (tokens.includes(recorded)) found.push(`${name} .${recorded}`)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

// ---------------------------------------------------------------------------------------------
// The files
// ---------------------------------------------------------------------------------------------

function filesUnder(directory: string, accept: (file: string) => boolean): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) found.push(...filesUnder(full, accept))
    else if (accept(full)) found.push(full)
  }
  return found.sort()
}

function relativeTo(directory: string, file: string): string {
  return path.relative(directory, file).replaceAll(path.sep, SLASH)
}

const E2E_FILES = filesUnder(E2E_DIR, (file) => file.endsWith('.ts')).map((file) => relativeTo(E2E_DIR, file))
const TOAST_HELPER = 'helpers/toast.ts'
const FIXTURES = 'fixtures.ts'

/** Every flagged site of `web/e2e`, as `file:line`, in file then line order. */
export function scanE2e(): { site: string; kind: Site['kind'] }[] {
  return E2E_FILES.filter((file) => file !== TOAST_HELPER).flatMap((file) =>
    findToastSites(readFileSync(path.join(E2E_DIR, file), 'utf-8')).map((found) => ({
      site: `${file}:${found.line}`,
      kind: found.kind,
    })),
  )
}

// ---------------------------------------------------------------------------------------------
// KEPT and PENDING
// ---------------------------------------------------------------------------------------------

const NO_TIMER = 'no product timer: page visibility is the stronger check'
const CATEGORY_TOAST = '.aviso-toast: the recorder does not watch the category toasts'

/**
 * Flagged sites that stay on page text, one `file:line — reason` per line, sorted by file then
 * line. A reason is always given.
 */
export const KEPT: readonly string[] = [
  `flow.spec.ts:50 — ${NO_TIMER}`,
  `flow.spec.ts:176 — ${CATEGORY_TOAST}`,
  `flow.spec.ts:180 — ${CATEGORY_TOAST}`,
  `panel.spec.ts:210 — ${NO_TIMER}`,
]

/**
 * Flagged sites not yet moved to `expectToast`, one `file:line` per line, sorted by file then
 * line. The list only shrinks: a migration removes its sites, and nothing is added.
 */
export const PENDING: readonly string[] = [
  'analysis.spec.ts:41',
  'analysis.spec.ts:46',
  'analysis.spec.ts:57',
  'analysis.spec.ts:75',
  'analysis.spec.ts:167',
  'analysis.spec.ts:180',
  'analysis.spec.ts:198',
  'analysis.spec.ts:209',
  'archivadas.spec.ts:41',
  'archivadas.spec.ts:51',
  'archivadas.spec.ts:61',
  'archivadas.spec.ts:71',
  'archivadas.spec.ts:106',
  'catalog.spec.ts:44',
  'catalog.spec.ts:49',
  'catalog.spec.ts:56',
  'catalog.spec.ts:70',
  'catalog.spec.ts:81',
  'catalog.spec.ts:100',
  'catalogInsecureOrigin.spec.ts:100',
  'catalogInsecureOrigin.spec.ts:107',
  'catalogInsecureOrigin.spec.ts:122',
  'clientesCobrar.spec.ts:39',
  'clientesCobrar.spec.ts:83',
  'clientesCobrar.spec.ts:88',
  'clientesCobrar.spec.ts:123',
  'cobroHoja.spec.ts:42',
  'cobroHoja.spec.ts:47',
  'cobroHoja.spec.ts:126',
  'cobroHoja.spec.ts:139',
  'cobroModal.spec.ts:26',
  'cobroModal.spec.ts:31',
  'customers.spec.ts:53',
  'customers.spec.ts:58',
  'customers.spec.ts:65',
  'customers.spec.ts:85',
  'customers.spec.ts:127',
  'inicioCobrar.spec.ts:42',
  'inicioCobrar.spec.ts:47',
  'inicioCobrar.spec.ts:79',
  'inicioCobrar.spec.ts:89',
  'insets.spec.ts:119',
  'insets.spec.ts:124',
  'leaveWithBack.spec.ts:35',
  'leaveWithBack.spec.ts:40',
  'nuevaVentaTelefono.spec.ts:44',
  'nuevaVentaTelefono.spec.ts:50',
  'passwords.spec.ts:70',
  'payments.spec.ts:64',
  'payments.spec.ts:69',
  'payments.spec.ts:77',
  'payments.spec.ts:105',
  'payments.spec.ts:136',
  'payments.spec.ts:147',
  'payments.spec.ts:202',
  'payments.spec.ts:224',
  'pinnedCatalog.spec.ts:43',
  'pinnedCatalog.spec.ts:48',
  'pinnedCatalog.spec.ts:88',
  'pinnedCatalog.spec.ts:100',
  'pinnedCatalog.spec.ts:108',
  'pressed.spec.ts:286',
  'pressed.spec.ts:291',
  'priceModal.spec.ts:21',
  'settings.spec.ts:47',
  'settings.spec.ts:66',
  'settings.spec.ts:80',
  'settings.spec.ts:91',
  'settings.spec.ts:98',
  'settings.spec.ts:111',
  'settings.spec.ts:130',
  'tapBudget.spec.ts:106',
  'toastRecorder.spec.ts:163',
  'varietiesAutoSelect.spec.ts:31',
  'ventasLinea.spec.ts:26',
  'ventasLinea.spec.ts:31',
  'ventasPhone.spec.ts:57',
  'ventasPhone.spec.ts:63',
  'ventasTelefono.spec.ts:67',
  'ventasTelefono.spec.ts:73',
  'withdrawals.spec.ts:33',
  'withdrawals.spec.ts:40',
  'withdrawals.spec.ts:52',
  'withdrawals.spec.ts:64',
  'withdrawals.spec.ts:74',
  'withdrawals.spec.ts:85',
  'withdrawals.spec.ts:96',
]

/** The most `PENDING` may hold; lowered with each migration, never raised. */
export const PENDING_CEILING = 87

// ---------------------------------------------------------------------------------------------
// The tests
// ---------------------------------------------------------------------------------------------

function siteOf(entry: string): string {
  const cut = entry.indexOf(' — ')
  return cut === -1 ? entry : entry.slice(0, cut)
}

function order(entries: readonly string[]): string[] {
  const parts = (entry: string): [string, number] => {
    const [file = '', line = '0'] = siteOf(entry).split(':')
    return [file, Number(line)]
  }
  return [...entries].sort((a, b) => {
    const [fileA, lineA] = parts(a)
    const [fileB, lineB] = parts(b)
    return fileA === fileB ? lineA - lineB : fileA < fileB ? -1 : 1
  })
}

describe('SUCCESS_TOASTS', () => {
  it('holds the same members as the SuccessToast union, in both directions', () => {
    expect(listMatchesUnion).toBe(true)
  })

  it('holds each text once', () => {
    const texts = SUCCESS_TOASTS.map((entry) => (typeof entry === 'string' ? entry : entry.prefix))
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('matches savedStillOwing by its prefix', () => {
    expect(PAYMENTS_TEXT.savedStillOwing('$ 1').startsWith(STILL_OWING_PREFIX)).toBe(true)
  })
})

describe('findToastSites, on inputs it must reject', () => {
  const lines = (source: string): string[] => findToastSites(source).map((found) => `${found.line} ${found.kind}`)

  it('flags getByText(<toast>) reaching toBeVisible', () => {
    expect(lines("await expect(page.getByText('Entry saved')).toBeVisible()")).toEqual(['1 visible'])
  })

  it('flags it through first(), a timeout option and an await', () => {
    expect(lines("await expect(page.getByText('Price saved').first()).toBeVisible({ timeout: 5000 })")).toEqual([
      '1 visible',
    ])
  })

  it('flags a waitFor', () => {
    expect(lines("await page.getByText('Test sent').waitFor()")).toEqual(['1 waitFor'])
  })

  it('flags the still-owing prefix as text, template and regex', () => {
    const source = [
      "await expect(page.getByText('Payment saved · still owing $ 5')).toBeVisible()",
      'await expect(page.getByText(`Payment saved · still owing ${money}`)).toBeVisible()',
      'await expect(page.getByText(/^Payment saved · still owing/)).toBeVisible()',
    ].join('\n')
    expect(lines(source)).toEqual(['1 visible', '2 visible', '3 visible'])
  })

  it('flags a same-file const alias at its use', () => {
    const source = ["const toast = page.getByText('Customer saved')", 'await expect(toast).toBeVisible()'].join('\n')
    expect(lines(source)).toEqual(['2 visible'])
  })

  it('flags a locator that escapes the file as unresolved', () => {
    const source = [
      "export const savedToast = (page: Page) => page.getByText('Entry saved')",
      "export function other(page: Page) { return page.getByText('Entry saved') }",
      "await check(page.getByText('Entry saved'))",
    ].join('\n')
    expect(lines(source)).toEqual(['1 escapes', '2 escapes', '3 escapes'])
  })

  it('flags an unscoped getByRole(status), not one a non-toast text narrows', () => {
    const source = [
      "await expect(page.getByRole('status')).toBeVisible()",
      "await expect(page.getByRole('status').getByText('Sale saved')).toBeVisible()",
      "await expect(page.getByRole('status').filter({ hasText: 'Sale saved' })).toBeVisible()",
      "await expect(page.getByRole('status', { name: 'Sale saved' })).toBeVisible()",
    ].join('\n')
    expect(lines(source)).toEqual(['1 visible'])
  })

  it('flags a status narrowed to a toast text once', () => {
    const source = [
      "await expect(page.getByRole('status').getByText('Entry saved')).toBeVisible()",
      "await expect(page.getByRole('status').filter({ hasText: 'Entry saved' })).toBeVisible()",
      "await expect(page.getByRole('status', { name: 'Entry saved' })).toBeVisible()",
    ].join('\n')
    expect(lines(source)).toEqual(['1 visible', '2 visible', '3 visible'])
  })
})

describe('findToastSites, on inputs it must accept', () => {
  const none = (source: string): void => {
    expect(findToastSites(source)).toEqual([])
  }

  it('lets a negative assertion pass', () => {
    none("await expect(page.getByText('Entry saved')).not.toBeVisible()")
    none("await expect(page.getByText('Entry saved')).toBeHidden()")
    none("await expect(page.getByText('Entry saved')).toHaveCount(0)")
  })

  it('lets page text that is not a toast pass', () => {
    none("await expect(page.getByText('Carla Pérez')).toBeVisible()")
    none("await expect(page.getByText('saved')).toBeVisible()")
    none("await expect(page.getByText(/Entry saved/)).toBeVisible()")
    none("await expect(page.getByText('Sale saved')).toBeVisible()")
  })

  it('lets a locator that is only acted on pass', () => {
    none("await page.getByText('Entry saved').click()")
    none("const text = await page.getByText('Entry saved').textContent()")
  })

  it('lets an alias that is never asserted pass', () => {
    none("const toast = page.getByText('Entry saved')\nawait toast.click()")
  })
})

describe('findBareNewContexts', () => {
  it('rejects a newContext that is not the argument of withToastRecorder', () => {
    expect(findBareNewContexts('const context = await browser.newContext({ baseURL })')).toEqual([1])
    expect(findBareNewContexts('const context = await withToastRecorder(other, browser.newContext({}))')).toEqual([1])
  })

  it('accepts a newContext wrapped in withToastRecorder', () => {
    expect(findBareNewContexts('const context = await withToastRecorder(browser.newContext({ baseURL }))')).toEqual([])
    expect(findBareNewContexts('const page = await (await withToastRecorder(browser.newContext())).newPage()')).toEqual([])
  })
})

describe('findToastElements', () => {
  it('finds the recorded classes with role status, conditional classes included', () => {
    expect(findToastElements('const a = <div className="aviso-exito" role="status" />', 'A.tsx')).toEqual(['A.tsx .aviso-exito'])
    expect(
      findToastElements(
        "const a = <div className={kind === 'toast' ? 'toast' : 'aviso-ambar'} role=\"status\" />",
        'B.tsx',
      ),
    ).toEqual(['B.tsx .toast'])
  })

  it('rejects nothing it should not: other classes and other roles are not recorded', () => {
    expect(findToastElements('const a = <div className="aviso-toast" role="status" />', 'C.tsx')).toEqual([])
    expect(findToastElements('const a = <div className="toast" role="alert" />', 'D.tsx')).toEqual([])
    expect(findToastElements('const a = <div className="toast" />', 'E.tsx')).toEqual([])
  })
})

describe('the real web/e2e sources', () => {
  const scanned = scanE2e()
  const flagged = scanned.map((found) => found.site)

  it('puts every flagged site on KEPT or PENDING, and no listed site that no longer flags', () => {
    const listed = [...KEPT, ...PENDING].map(siteOf)
    expect([...new Set(listed)].sort()).toEqual([...new Set(flagged)].sort())
    expect(new Set(listed).size).toBe(listed.length)
  })

  it('keeps KEPT and PENDING sorted, one line per entry, KEPT with a reason', () => {
    expect([...KEPT]).toEqual(order(KEPT))
    expect([...PENDING]).toEqual(order(PENDING))
    for (const entry of KEPT) expect(entry).toMatch(/^\S+:\d+ — \S.*/)
    for (const entry of [...KEPT, ...PENDING]) expect(entry).not.toContain('\n')
    for (const entry of PENDING) expect(entry).toMatch(/^\S+:\d+$/)
  })

  it('only lets PENDING shrink', () => {
    expect(PENDING.length).toBeLessThanOrEqual(PENDING_CEILING)
  })

  it('reports the counts', () => {
    const observed = E2E_FILES.filter((file) => file !== TOAST_HELPER && !file.endsWith('toastRecorder.spec.ts')).reduce(
      (count, file) => count + countExpectToasts(readFileSync(path.join(E2E_DIR, file), 'utf-8')),
      0,
    )
    // The reporter line the evidence doc quotes: `npm --prefix web test -- e2eToastRule`.
    process.stdout.write(
      `e2eToastRule: ${observed} sites observed in the page, ${KEPT.length} kept on page text, ${PENDING.length} pending\n`,
    )
    expect(KEPT.length + PENDING.length).toBe(flagged.length)
  })

  it('has no browser.newContext outside fixtures.ts that escapes withToastRecorder', () => {
    const bare = E2E_FILES.filter((file) => file !== FIXTURES).flatMap((file) =>
      findBareNewContexts(readFileSync(path.join(E2E_DIR, file), 'utf-8')).map((line) => `${file}:${line}`),
    )
    expect(bare).toEqual([])
  })
})

describe('the elements of web/src the recorder watches', () => {
  it('are exactly TOAST_ELEMENTS', () => {
    const sources = filesUnder(SRC_DIR, (file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'))
    const found = sources.flatMap((file) => {
      const name = relativeTo(SRC_DIR, file)
      return findToastElements(readFileSync(file, 'utf-8'), name)
    })
    expect([...new Set(found)].sort()).toEqual([...TOAST_ELEMENTS].sort())
  })
})
