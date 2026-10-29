/**
 * The loading probes. While the screen's API is held: is the content area (`main`) drawn,
 * does it say it is busy, does a fixed empty-state wording show, does a digit or a
 * currency symbol show. After the release: what moved when the answers came (`layout-shift` sources
 * the toolkit buffered from the release on; what moved before it, a font swapping in, is
 * the page's own timing and not the data's). The page only reads; `judgeLoading` and
 * `judgeShifts` decide.
 */

import type { LoadingFacts } from '../../src/mobile-standard/loading.ts'
import { judgeLoading } from '../../src/mobile-standard/loading.ts'
import { judgeShifts, type ShiftSample } from '../../src/mobile-standard/layoutShift.ts'
import { forbiddenWhileLoading } from '../../src/mobile-standard/emptyStates.ts'
import { loadBundle } from '../../scripts/i18n/loadBundle.ts'
import { mobileLanguage } from '../env.js'
import type { Collector } from './collect.js'

/**
 * The wordings forbidden while loading in this run: English always, and the run's own bundle
 * read from disk when the run is not `en`. Read here, in `e2e/`: `mobile-standard/` only takes
 * the bundles it is given.
 */
export function runForbidden(): readonly string[] {
  const tag = mobileLanguage()
  return forbiddenWhileLoading(loadBundle('en'), loadBundle(tag), tag)
}

/** Reads the page; `judgeLoading` decides which texts are forbidden. */
export function probeLoading(): LoadingFacts {
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

  const texts: LoadingFacts['texts'][number][] = []
  const data: LoadingFacts['data'][number][] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement
    const text = phone.squash(node.textContent)
    if (parent === null || text === '' || parent.closest('script, style, noscript') !== null || !phone.visible(parent)) continue
    texts.push({ text, raw: phone.raw(parent) })
    if (main !== null && main.contains(parent) && /[\d$]/.test(text)) data.push(phone.raw(parent))
  }

  return {
    lang: document.documentElement.lang,
    blank: main === null || !drawn(main),
    busy: main !== null && (main.getAttribute('aria-busy') === 'true' || main.querySelector('[aria-busy="true"]') !== null),
    texts,
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
    .filter((entry) => entry.node.isConnected && entry.at >= phone.releasedAt)
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
  run: async (page, cell) => {
    const verdict = judgeLoading(await page.evaluate(probeLoading), cell, runForbidden(), mobileLanguage())
    // A page in the wrong language fails the step with its own reason, outside `Violation`s.
    if (verdict.language !== null) throw new Error(verdict.language)
    return verdict.violations
  },
}

export const SHIFT_COLLECTOR: Collector = {
  name: 'shift',
  phase: 'released',
  run: async (page, cell) => judgeShifts(await page.evaluate(probeShifts), cell),
}
