/**
 * The geometry, type and input checkers of the phone standard (GH-80), as one collector
 * run inside the page on the loaded screen: it returns `Violation`s and decides nothing
 * (`diffOffenders` alone says whether one is allowed). It must be self-contained, with no
 * closure over this file: `page.evaluate` serialises it. Targets follow the plan: the
 * element's `data-testid`, else `role:accessible name` with digit runs as `#`, cut to 60
 * characters; a repeated target carries the identity of its nearest identified ancestor,
 * and one that is still repeated (no identity, or the identity is shared) takes a positional
 * ordinal `[n]` in document order, so N identical offenders are N Violations and fixing or
 * adding one always changes the diff.
 *
 * Rules: h-scroll, chrome-at-load, chrome-mid-scroll, touch-target, input-font,
 * text-size, figure-split, name-overflow, autocomplete, inputmode, input-type,
 * user-select, touch-action and overscroll. The 60-character fixture names are the ones
 * with a word of 30 characters or more (`scripts/design/sample_app.py`'s LONG_NAME).
 */

import type { Rule, Violation } from '../../src/mobile-standard/violation.ts'
import type { CellId } from './collect.js'

export function collectGeometry({ cell, loginPath }: { cell: CellId; loginPath: string }): Violation[] {
  const MIN_TOUCH = 44
  const MIN_INPUT_FONT = 16
  const MIN_TEXT = 12
  const TARGET_MAX = 60
  const width = Number(cell.size.split('x')[0])

  const found: { rule: Rule; element: Element | null }[] = []
  const add = (rule: Rule, element: Element | null): void => {
    if (!found.some((entry) => entry.rule === rule && entry.element === element)) found.push({ rule, element })
  }

  const squash = (text: string | null): string => (text ?? '').replace(/\s+/g, ' ').trim()
  const visible = (element: Element): boolean => {
    const rect = element.getBoundingClientRect()
    return rect.width > 1 && rect.height > 1 && element.checkVisibility({ checkVisibilityCSS: true })
  }
  const all = (selector: string): Element[] => Array.from(document.querySelectorAll(selector)).filter(visible)

  const FIELDS =
    'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=range]):not([type=file]), textarea, select'

  // A label that wraps its control also holds the control's options: only its own words name it.
  function labelText(label: Element | undefined): string {
    if (label === undefined) return ''
    const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT)
    const words: string[] = []
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (node.parentElement?.closest('select, textarea, option') === null) words.push(node.textContent ?? '')
    }
    return squash(words.join(' '))
  }

  function labelOf(element: Element): string {
    const aria = element.getAttribute('aria-label')
    if (aria !== null && aria !== '') return aria
    const by = element.getAttribute('aria-labelledby')
    if (by !== null) {
      const text = squash(
        by
          .split(' ')
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' '),
      )
      if (text !== '') return text
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      const label = labelText(element.labels?.[0])
      if (label !== '') return label
      if ('placeholder' in element && element.placeholder !== '') return element.placeholder
    }
    return squash(element.textContent) || element.getAttribute('title') || element.getAttribute('name') || ''
  }

  function roleOf(element: Element): string {
    const explicit = element.getAttribute('role')
    if (explicit !== null) return explicit
    const tag = element.tagName.toLowerCase()
    if (tag === 'a') return 'link'
    if (tag === 'button') return 'button'
    if (tag === 'select') return 'combobox'
    if (tag === 'input') return element.getAttribute('type') === 'checkbox' ? 'checkbox' : 'textbox'
    if (tag === 'textarea') return 'textbox'
    if (tag === 'nav') return 'navigation'
    if (tag === 'header') return 'banner'
    return tag
  }

  const shorten = (text: string): string => text.replace(/\d+/g, '#').slice(0, TARGET_MAX)

  function baseTarget(element: Element): string {
    const id = element.getAttribute('data-testid')
    if (id !== null && id !== '') return shorten(id)
    const header = element.tagName === 'HEADER' ? squash(element.querySelector('h1, h2')?.textContent ?? '') : ''
    return shorten(`${roleOf(element)}:${header || labelOf(element)}`)
  }

  function identityOf(element: Element): string {
    const parent = element.parentElement
    const tagged = parent?.closest('[data-testid]')
    if (tagged !== null && tagged !== undefined) return shorten(tagged.getAttribute('data-testid') ?? '')
    const item = parent?.closest('li, tr, article, [role=listitem], [role=dialog], dialog, form, section')
    if (item === null || item === undefined) return ''
    return shorten(squash(item.textContent)).slice(0, 30)
  }

  const lineCount = (range: Range): number => {
    const tops = Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0)
      .map((rect) => Math.round(rect.top))
      .sort((a, b) => a - b)
    let lines = 0
    let last = -Infinity
    for (const top of tops) {
      if (top - last > 3) lines += 1
      last = top
    }
    return lines
  }

  function textNodes(): Text[] {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const parent = node.parentElement
      if (!(node instanceof Text) || parent === null || squash(node.data) === '') continue
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName) || !visible(parent)) continue
      nodes.push(node)
    }
    return nodes
  }

  // --- page rules ---------------------------------------------------------------------
  if (document.documentElement.scrollWidth > width) add('h-scroll', null)
  for (const root of [document.documentElement, document.body]) {
    const style = getComputedStyle(root)
    if (style.overscrollBehaviorX !== 'none' || style.overscrollBehaviorY !== 'none') {
      add('overscroll', null)
      break
    }
  }

  // --- chrome -------------------------------------------------------------------------
  const chrome = (): Element[] => [
    ...all('nav.bar-inferior'),
    ...all('a.boton-nueva-venta'),
    ...all('header').filter((h) => h.closest('article, section, li, form, dialog, [role=dialog]') === null),
  ]
  const outside = (element: Element): boolean => {
    const rect = element.getBoundingClientRect()
    return rect.top < -0.5 || rect.bottom > window.innerHeight + 0.5 || rect.left < -0.5 || rect.right > width + 0.5
  }
  window.scrollTo(0, 0)
  for (const element of chrome()) if (outside(element)) add('chrome-at-load', element)

  const scrollers = Array.from(document.querySelectorAll('*')).filter(
    (element) =>
      element !== document.body &&
      element !== document.documentElement &&
      element.scrollHeight > element.clientHeight + 1 &&
      ['auto', 'scroll'].includes(getComputedStyle(element).overflowY),
  )
  window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) / 2)
  for (const element of scrollers) element.scrollTop = (element.scrollHeight - element.clientHeight) / 2
  for (const element of chrome()) if (outside(element)) add('chrome-mid-scroll', element)
  window.scrollTo(0, 0)
  for (const element of scrollers) element.scrollTop = 0

  // --- touch, type -------------------------------------------------------------------
  const TAPPABLE = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=tab], summary'
  for (const element of all(TAPPABLE)) {
    const rect = element.getBoundingClientRect()
    if (rect.width >= MIN_TOUCH && rect.height >= MIN_TOUCH) continue
    const inText =
      element.tagName === 'A' &&
      Array.from(element.parentElement?.childNodes ?? []).some((n) => n instanceof Text && squash(n.data) !== '')
    if (!inText) add('touch-target', element)
  }
  for (const element of all(FIELDS)) {
    if (parseFloat(getComputedStyle(element).fontSize) < MIN_INPUT_FONT) add('input-font', element)
  }
  for (const node of textNodes()) {
    const parent = node.parentElement
    if (parent !== null && parseFloat(getComputedStyle(parent).fontSize) < MIN_TEXT) add('text-size', parent)
  }

  // --- figures and names -------------------------------------------------------------
  const FIGURE = /[−-]?\$\s?\d[\d.]*|^[−-]?\$$/g
  for (const node of textNodes()) {
    const parent = node.parentElement
    if (parent === null) continue
    for (const match of node.data.matchAll(FIGURE)) {
      const range = document.createRange()
      range.setStart(node, match.index)
      range.setEnd(node, match.index + match[0].length)
      if (lineCount(range) > 1) add('figure-split', parent)
    }
    for (const word of node.data.match(/\S{30,}/g) ?? []) {
      const range = document.createRange()
      range.setStart(node, node.data.indexOf(word))
      range.setEnd(node, node.data.indexOf(word) + word.length)
      const rects = Array.from(range.getClientRects())
      const right = Math.max(...rects.map((rect) => rect.right))
      const clipped = (element: Element): boolean => {
        const style = getComputedStyle(element)
        return style.textOverflow === 'ellipsis' && style.overflowX !== 'visible'
      }
      let truncated = false
      let overflows = right > width + 1
      for (let at: Element | null = parent, depth = 0; at !== null && depth < 4; at = at.parentElement, depth += 1) {
        if (clipped(at)) truncated = true
        else if (at.clientWidth > 0 && at.scrollWidth > at.clientWidth + 1) overflows = true
      }
      if (!truncated && overflows) add('name-overflow', parent)
    }
  }
  for (const element of all('*')) {
    if (element.children.length < 2 || element.querySelectorAll('*').length > 6) continue
    if (!/^[−-]?\$\s?\d[\d.]*$/.test(squash(element.textContent))) continue
    const range = document.createRange()
    range.selectNodeContents(element)
    if (lineCount(range) > 1) add('figure-split', element)
  }

  // --- inputs ------------------------------------------------------------------------
  const onSignIn = location.pathname.startsWith(loginPath)
  for (const element of all(FIELDS)) {
    const name = labelOf(element).toLowerCase()
    const type = element.getAttribute('type') ?? ''
    const own = element.getAttribute('autocomplete')
    // A select is never typed into: no inputmode, no type, no expected autocomplete.
    const typed = !(element instanceof HTMLSelectElement)
    const inCustomer =
      /^(nombre|tel[eé]fono|celular|whatsapp)/.test(name) &&
      /cliente/i.test((element.closest('form, [role=dialog], dialog, main') ?? document.body).textContent ?? '')
    let expected: string | null = null
    if (!typed) expected = null
    else if (inCustomer) expected = 'off'
    else if (type === 'password') expected = /actual/.test(name) || onSignIn ? 'current-password' : 'new-password'
    else if (onSignIn && /email/.test(name)) expected = 'username'
    else if (/negocio/.test(name) && /^(nombre|negocio)/.test(name)) expected = 'organization'
    if (own === null || own === '' || (expected !== null && own !== expected)) add('autocomplete', element)

    const mode = element.getAttribute('inputmode')
    const grams = /gramos|\(g\)/.test(name)
    const pesos = !grams && /precio|monto|importe|costo|pesos|\$|env[ií]o|cobr/.test(name)
    if (typed && ((grams && mode !== 'decimal') || (pesos && mode !== 'numeric'))) add('inputmode', element)

    if (typed && /email|correo/.test(name) && type !== 'email') add('input-type', element)
    if (typed && /tel[eé]fono|celular|whatsapp/.test(name) && type !== 'tel') add('input-type', element)
  }

  // --- gestures ----------------------------------------------------------------------
  for (const element of all('button, [role=button], [role=tab], nav.bar-inferior, nav.bar-inferior a')) {
    const style = getComputedStyle(element)
    if (style.userSelect !== 'none') add('user-select', element)
    if (style.touchAction !== 'manipulation') add('touch-action', element)
  }

  // --- targets -----------------------------------------------------------------------
  const base = found.map((entry) => ({
    ...entry,
    target: entry.element === null ? '' : baseTarget(entry.element),
  }))
  const named = base.map((entry) => {
    const repeated = base.filter((other) => other.rule === entry.rule && other.target === entry.target).length > 1
    const identity = repeated && entry.element !== null ? identityOf(entry.element) : ''
    return { ...entry, target: identity === '' ? entry.target : `${entry.target}@${identity}` }
  })
  const seen = new Map<string, number>()
  return named.map((entry) => {
    const key = `${entry.rule}|${entry.target}`
    const same = named.filter((other) => `${other.rule}|${other.target}` === key).length
    const ordinal = (seen.get(key) ?? 0) + 1
    seen.set(key, ordinal)
    const target = same > 1 ? `${entry.target}[${ordinal}]` : entry.target
    return { screen: cell.screen, size: cell.size, theme: cell.theme, rule: entry.rule, target }
  })
}
