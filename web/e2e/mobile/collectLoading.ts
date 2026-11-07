/**
 * The loading probes. The content area is the topmost element `CONTENT_AREA` names: the last
 * open modal area, else the first one with no content area above it. While the screen's API is
 * held: is it drawn, does a fixed empty-state wording show, does a digit or a currency symbol
 * show; and a snapshot of it (the element, whether it says it is busy, a print of what it
 * shows) is left on `window`. After the release: did the area change since that snapshot, which is
 * what an area that was waiting does (`probeWaiting`), and what moved when the answers came (`layout-shift` sources
 * the toolkit buffered from the release on; what moved before it, a font swapping in, is
 * the page's own timing and not the data's). The page only reads; `judgeLoading` and
 * `judgeShifts` decide.
 */

import type { LoadingFacts, WaitingFacts } from '../../src/mobile-standard/loading.ts'
import { judgeLoading, judgeWaiting } from '../../src/mobile-standard/loading.ts'
import { CONTENT_AREA } from '../../src/mobile-standard/contentArea.ts'
import { judgeShifts, type ShiftSample } from '../../src/mobile-standard/layoutShift.ts'
import { forbiddenWhileLoading } from '../../src/mobile-standard/emptyStates.ts'
import { loadBundle } from '../../scripts/i18n/loadBundle.ts'
import { mobileLanguage } from '../env.js'
import type { Collector } from './collect.js'

/** What the held pass saw of the content area; `probeWaiting` compares the area after the release with it. */
export interface HeldArea {
  node: Element | null
  /** The area itself carried `aria-busy="true"`. */
  busy: boolean
  /** Its visible texts in order and its count of visible elements. */
  print: string
}

declare global {
  interface Window {
    __heldArea?: HeldArea
  }
}

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
export function probeLoading(area: typeof CONTENT_AREA): LoadingFacts {
  const phone = window.__phone
  if (phone === undefined) throw new Error('the phone toolkit is not installed in this page')
  // The topmost area, spelled again in `probeWaiting`: Playwright serialises each probe alone.
  const modal = Array.from(document.querySelectorAll(area.modal))
  const topmost =
    modal.at(-1) ??
    Array.from(document.querySelectorAll(area.any)).find((element) => element.parentElement?.closest(area.any) == null) ??
    null

  const drawn = (root: Element): boolean =>
    Array.from(root.querySelectorAll('*')).some((element) => {
      if (!phone.visible(element)) return false
      const hasText = Array.from(element.childNodes).some((n) => n instanceof Text && phone.squash(n.data) !== '')
      const style = getComputedStyle(element)
      const surface = !/^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(style.backgroundColor)
      const rect = element.getBoundingClientRect()
      return hasText || (surface && rect.width >= 8 && rect.height >= 8)
    })

  const texts: LoadingFacts['texts'][number][] = []
  const data: LoadingFacts['data'][number][] = []
  const shown: string[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement
    const text = phone.squash(node.textContent)
    if (parent === null || text === '' || parent.closest('script, style, noscript') !== null || !phone.visible(parent)) continue
    texts.push({ text, raw: phone.raw(parent) })
    if (topmost !== null && topmost.contains(parent)) {
      shown.push(text)
      if (/[\d$]/.test(text)) data.push(phone.raw(parent))
    }
  }
  const visibleElements = topmost === null ? 0 : Array.from(topmost.querySelectorAll('*')).filter((element) => phone.visible(element)).length
  window.__heldArea = {
    node: topmost,
    busy: topmost !== null && topmost.getAttribute('aria-busy') === 'true',
    print: `${shown.join('\u001f')}\u001e${visibleElements}`,
  }

  return {
    lang: document.documentElement.lang,
    blank: topmost === null || !drawn(topmost),
    texts,
    data,
  }
}

/**
 * Reads the area after the release against the held snapshot: it was waiting if it is another
 * element now, or is gone, or shows other texts or a different count of visible elements.
 * `busy` is what the area said while it was held. With no snapshot (the page was reloaded
 * since) there is nothing to compare, and nothing is judged.
 */
export function probeWaiting(area: typeof CONTENT_AREA): WaitingFacts {
  const phone = window.__phone
  if (phone === undefined) throw new Error('the phone toolkit is not installed in this page')
  const held = window.__heldArea
  if (held === undefined) return { waiting: false, busy: false }
  const modal = Array.from(document.querySelectorAll(area.modal))
  const topmost =
    modal.at(-1) ??
    Array.from(document.querySelectorAll(area.any)).find((element) => element.parentElement?.closest(area.any) == null) ??
    null
  if (topmost === null) return { waiting: held.node !== null, busy: held.busy }
  if (topmost !== held.node || !held.node.isConnected) return { waiting: true, busy: held.busy }
  const shown: string[] = []
  const walker = document.createTreeWalker(topmost, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement
    const text = phone.squash(node.textContent)
    if (parent === null || text === '' || parent.closest('script, style, noscript') !== null || !phone.visible(parent)) continue
    shown.push(text)
  }
  const visibleElements = Array.from(topmost.querySelectorAll('*')).filter((element) => phone.visible(element)).length
  const print = `${shown.join('\u001f')}\u001e${visibleElements}`
  return { waiting: print !== held.print, busy: held.busy }
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
    const verdict = judgeLoading(await page.evaluate(probeLoading, CONTENT_AREA), cell, runForbidden(), mobileLanguage())
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

export const WAITING_COLLECTOR: Collector = {
  name: 'waiting',
  phase: 'released',
  run: async (page, cell) => judgeWaiting(await page.evaluate(probeWaiting, CONTENT_AREA), cell),
}
