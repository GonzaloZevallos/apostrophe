/**
 * The loading probes. While the screen's API is held: is the content area (`main`) drawn,
 * does it say it is busy, does a fixed empty-state wording show, does a digit or a
 * currency symbol show. After the release: what moved (`layout-shift` sources buffered by
 * the toolkit since the document started). The page only reads; `judgeLoading` and
 * `judgeShifts` decide.
 */

import type { LoadingFacts } from '../../src/mobile-standard/loading.ts'
import { judgeLoading } from '../../src/mobile-standard/loading.ts'
import { judgeShifts, type ShiftSample } from '../../src/mobile-standard/layoutShift.ts'
import { FORBIDDEN_WHILE_LOADING } from '../../src/mobile-standard/emptyStates.ts'
import type { Collector } from './collect.js'

export function probeLoading(forbidden: readonly string[]): LoadingFacts {
  const phone = window.__phone
  if (phone === undefined) throw new Error('the phone toolkit is not installed in this page')
  const main = document.querySelector('main')

  const drawn = (area: Element): boolean =>
    Array.from(area.querySelectorAll('*')).some((element) => {
      if (!phone.visible(element)) return false
      const hasText = Array.from(element.childNodes).some((n) => n instanceof Text && phone.squash(n.data) !== '')
      const style = getComputedStyle(element)
      const surface = !/^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(style.backgroundColor)
      const rect = element.getBoundingClientRect()
      return hasText || (surface && rect.width >= 8 && rect.height >= 8)
    })

  const falseEmpty: LoadingFacts['falseEmpty'][number][] = []
  const data: LoadingFacts['data'][number][] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement
    const text = phone.squash(node.textContent)
    if (parent === null || text === '' || parent.closest('script, style, noscript') !== null || !phone.visible(parent)) continue
    if (forbidden.some((wording) => text.includes(wording))) falseEmpty.push(phone.raw(parent))
    if (main !== null && main.contains(parent) && /[\d$]/.test(text)) data.push(phone.raw(parent))
  }

  return {
    blank: main === null || !drawn(main),
    busy: main !== null && (main.getAttribute('aria-busy') === 'true' || main.querySelector('[aria-busy="true"]') !== null),
    falseEmpty,
    data,
  }
}

export function probeShifts(): ShiftSample[] {
  const phone = window.__phone
  if (phone === undefined) throw new Error('the phone toolkit is not installed in this page')
  const nodes = new Map<Element, number>()
  const box = (rect: DOMRectReadOnly) => ({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
  const fixed = (element: Element): boolean => {
    for (let at: Element | null = element; at !== null; at = at.parentElement) {
      if (getComputedStyle(at).position === 'fixed') return true
    }
    return false
  }
  const chrome = (element: Element): boolean =>
    element.closest('nav.bar-inferior, a.boton-nueva-venta') !== null ||
    element.closest('header') !== null && element.closest('header')?.closest('article, section, li, form, dialog, [role=dialog]') === null ||
    fixed(element)
  return phone.shifts
    .filter((entry) => entry.node.isConnected)
    .map((entry) => {
      if (!nodes.has(entry.node)) nodes.set(entry.node, nodes.size)
      return {
        node: nodes.get(entry.node) ?? 0,
        chrome: chrome(entry.node),
        previous: box(entry.previous),
        current: box(entry.current),
        raw: phone.raw(entry.node),
      }
    })
}

export const LOADING_COLLECTOR: Collector = {
  name: 'loading',
  phase: 'loading',
  run: async (page, cell) => judgeLoading(await page.evaluate(probeLoading, FORBIDDEN_WHILE_LOADING), cell),
}

export const SHIFT_COLLECTOR: Collector = {
  name: 'shift',
  phase: 'released',
  run: async (page, cell) => judgeShifts(await page.evaluate(probeShifts), cell),
}
