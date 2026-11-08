/**
 * The chrome facts of the phone standard (GH-283): which of the bar, "+ New sale" and the
 * header the screen renders, whether each sits in the viewport, and whether it is covered
 * (inside `[inert]` or `[aria-hidden="true"]`, or beneath an open modal), at the top of the
 * page and scrolled to the middle. It returns facts and decides nothing: `judgeChrome`
 * (`mobile-standard/chrome.ts`) alone says which are violations, by the screen's kind.
 * `collectChromeFacts` must be self-contained, with no closure over this file:
 * `page.evaluate` serialises it. It is not one of `COLLECTORS`: it needs the kind.
 */

import type { Page } from '@playwright/test'
import {
  judgeChrome,
  type ChromeExpectation,
  type ChromeFact,
  type ChromeFacts,
} from '../../src/mobile-standard/chrome.ts'
import type { Violation } from '../../src/mobile-standard/violation.ts'
import type { CellId } from './collect.js'

export function collectChromeFacts({ width }: { width: number }): ChromeFacts {
  const MODAL = 'dialog:modal, [role=dialog][aria-modal="true"], [role=alertdialog][aria-modal="true"]'
  const ELEMENTS = [
    { element: 'bar', selector: 'nav.bar-inferior' },
    { element: 'newSale', selector: 'a.boton-nueva-venta' },
    { element: 'header', selector: 'header' },
  ] as const

  // Rendered, not necessarily live: an inert bar under a sheet is present, and covered.
  const rendered = (element: Element): boolean => {
    const rect = element.getBoundingClientRect()
    return rect.width > 1 && rect.height > 1 && element.checkVisibility({ checkVisibilityCSS: true })
  }
  const modals = (): Element[] => Array.from(document.querySelectorAll(MODAL)).filter((m) => m.checkVisibility())
  const covered = (element: Element, open: Element[]): boolean =>
    element.closest('[inert], [aria-hidden="true"]') !== null ||
    (open.length > 0 && !open.some((modal) => modal.contains(element)))
  const outside = (element: Element): boolean => {
    const rect = element.getBoundingClientRect()
    return rect.top < -0.5 || rect.bottom > window.innerHeight + 0.5 || rect.left < -0.5 || rect.right > width + 0.5
  }
  const matches = (selector: string, element: string): Element[] =>
    Array.from(document.querySelectorAll(selector)).filter(
      (found) =>
        rendered(found) &&
        (element !== 'header' || found.closest('article, section, li, form, dialog, [role=dialog]') === null),
    )

  const read = (phase: 'load' | 'mid'): ChromeFact[] => {
    const open = modals()
    return ELEMENTS.map(({ element, selector }) => {
      const found = matches(selector, element)
      const uncovered = found.filter((one) => !covered(one, open))
      return {
        element,
        phase,
        present: found.length > 0,
        covered: found.length > 0 && uncovered.length === 0,
        inView: uncovered.every((one) => !outside(one)),
      }
    })
  }

  window.scrollTo(0, 0)
  const load = read('load')
  const scrollers = Array.from(document.querySelectorAll('*')).filter(
    (element) =>
      element !== document.body &&
      element !== document.documentElement &&
      element.scrollHeight > element.clientHeight + 1 &&
      ['auto', 'scroll'].includes(getComputedStyle(element).overflowY),
  )
  window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) / 2)
  for (const element of scrollers) element.scrollTop = (element.scrollHeight - element.clientHeight) / 2
  const mid = read('mid')
  window.scrollTo(0, 0)
  for (const element of scrollers) element.scrollTop = 0
  return { modalOpen: modals().length > 0, elements: [...load, ...mid] }
}

/** The chrome Violations of the loaded screen, judged by the kind it is expected to be. */
export async function runChrome(
  page: Page,
  cell: CellId,
  expectation: ChromeExpectation,
): Promise<Violation[]> {
  const width = Number(cell.size.split('x')[0])
  return judgeChrome(expectation, await page.evaluate(collectChromeFacts, { width }), cell)
}
