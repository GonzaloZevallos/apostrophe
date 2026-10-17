/**
 * What the colour, loading and layout-shift probes share in the page: naming an element
 * for a `Violation`, deciding whether it is visible, and the layout-shift sources buffered
 * since the document started. It is installed by an init script on every cell's context
 * (`newCell`), so it exists before the app's own scripts and sees the first shift. It is
 * self-contained (no closure) because Playwright serialises it.
 */

import type { RawTarget } from '../../src/mobile-standard/targets.ts'

export interface ShiftEntry {
  node: Element
  previous: DOMRectReadOnly
  current: DOMRectReadOnly
}

export interface PhoneToolkit {
  squash: (text: string | null) => string
  visible: (element: Element) => boolean
  raw: (element: Element, suffix?: string) => RawTarget
  /** Every `layout-shift` source since the document began, in order. */
  shifts: ShiftEntry[]
}

declare global {
  interface Window {
    __phone?: PhoneToolkit
  }
}

export function installToolkit(): void {
  const squash = (text: string | null): string => (text ?? '').replace(/\s+/g, ' ').trim()
  const visible = (element: Element): boolean => {
    const rect = element.getBoundingClientRect()
    return rect.width > 1 && rect.height > 1 && element.checkVisibility({ checkVisibilityCSS: true })
  }

  function labelOf(element: Element): string {
    const aria = element.getAttribute('aria-label')
    if (aria !== null && aria !== '') return aria
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      const label = squash(element.labels?.[0]?.textContent ?? '')
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
    if (tag === 'input' || tag === 'textarea') return 'textbox'
    if (tag === 'nav') return 'navigation'
    if (tag === 'header') return 'banner'
    return tag
  }

  function identityOf(element: Element): string {
    const parent = element.parentElement
    const tagged = parent?.closest('[data-testid]')
    if (tagged !== null && tagged !== undefined) return tagged.getAttribute('data-testid') ?? ''
    const item = parent?.closest('li, tr, article, [role=listitem], [role=dialog], dialog, form, section')
    return item === null || item === undefined ? '' : squash(item.textContent).slice(0, 30)
  }

  const shifts: ShiftEntry[] = []
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // `sources` is on layout-shift entries only; the type lib does not know it.
      const sources: unknown = Reflect.get(entry, 'sources')
      if (!Array.isArray(sources)) continue
      for (const source of sources as { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[]) {
        const node = source.node instanceof Text ? source.node.parentElement : source.node
        if (node instanceof Element) shifts.push({ node, previous: source.previousRect, current: source.currentRect })
      }
    }
  }).observe({ type: 'layout-shift', buffered: true })

  window.__phone = {
    squash,
    visible,
    shifts,
    raw: (element, suffix = '') => ({
      testid: element.getAttribute('data-testid') ?? '',
      role: roleOf(element),
      label: labelOf(element) + suffix,
      identity: identityOf(element),
    }),
  }
}
