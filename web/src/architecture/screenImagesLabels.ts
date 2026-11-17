/**
 * The label check of `scripts/design/screens.json`: every `fill` and `select` label of a row
 * must name exactly one control of the rendered page, with the whole text, so the next label
 * change fails in vitest and not only in the screen-images capture.
 *
 * `judgeLabel` works out each control's label in the order Playwright's `getByLabel` reads
 * (`aria-labelledby`, then `aria-label`, then the native labels, wrapping or `for`), collapses
 * whitespace, and compares the whole text, case included. `placeholder` and `title` are never
 * a source, and `computeAccessibleName` is not used (it would name a control by them).
 *
 * That order follows the implementation of Playwright `^1.63`, which is pinned in `web/package.json`,
 * not a documented contract: this check is a faithful early warning and the screen-images capture
 * (`scripts/design/comparisons.mjs`, exact and strict) is the final proof.
 *
 * `rowLabels` reads the rows `mobile-standard/registry.ts` parsed and resolves each label
 * through `resolveStep` with the bundle, as the capture does; it reads no file itself.
 */

import { resolveStep } from '../i18n/step'
import type { Bundle } from '../i18n/resolve'
import type { RegistryScreen } from '../mobile-standard/registry'

export interface LabelVerdict {
  ok: boolean
  /** How many controls of the page carry exactly the label. */
  matched: number
  problem: string | null
}

export interface RowLabel {
  screen: string
  /** The zero-based index of the step in the row's `steps`. */
  step: number
  kind: 'fill' | 'select'
  label: string
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** The controls Playwright reads native labels of (`INPUT` but a hidden one). */
function hasNativeLabels(element: Element): element is HTMLElement & { labels: NodeListOf<HTMLLabelElement> | null } {
  if (element instanceof HTMLInputElement) return element.type !== 'hidden'
  return (
    element instanceof HTMLButtonElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLMeterElement ||
    element instanceof HTMLOutputElement ||
    element instanceof HTMLProgressElement
  )
}

/** The labels of one control, normalized, in the order `getByLabel` tries them. */
function labelsOf(element: Element): string[] {
  const ids = (element.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter((id) => id !== '')
  const named = ids.flatMap((id) => {
    const target = element.ownerDocument.getElementById(id)
    return target === null ? [] : [target]
  })
  if (named.length > 0) return [collapse(named.map((target) => target.textContent).join(' '))]
  const aria = element.getAttribute('aria-label')
  if (aria !== null && aria.trim() !== '') return [collapse(aria)]
  if (hasNativeLabels(element) && element.labels !== null) {
    return [...element.labels].map((label) => collapse(label.textContent))
  }
  return []
}

/** Whether exactly one control inside `container` has exactly `label` (whitespace collapsed) as a label. */
export function judgeLabel(container: ParentNode, label: string): LabelVerdict {
  const wanted = collapse(label)
  const matched = [...container.querySelectorAll('*')].filter((element) => labelsOf(element).includes(wanted)).length
  if (matched === 0) return { ok: false, matched, problem: `no control on the page has the label "${wanted}"` }
  if (matched > 1) {
    return { ok: false, matched, problem: `the label "${wanted}" names ${matched} controls, it must name exactly one` }
  }
  return { ok: true, matched, problem: null }
}

/** Every `fill` and `select` label of the rows, as the capture reads it (keys resolved through `bundle`). */
export function rowLabels(rows: readonly RegistryScreen[], bundle: Bundle): RowLabel[] {
  return rows.flatMap((row) =>
    row.steps.flatMap((raw, step): RowLabel[] => {
      const resolved = resolveStep(raw, bundle)
      if ('fill' in resolved) return [{ screen: row.screen, step, kind: 'fill', label: resolved.fill.label }]
      if ('select' in resolved) return [{ screen: row.screen, step, kind: 'select', label: resolved.select.label }]
      return []
    }),
  )
}

/** The rows that have a `fill` or `select` label and no entry in `entries`: no allowlist, no skip, one line per row. */
export function rowsWithoutEntry(labels: readonly RowLabel[], entries: readonly string[]): string[] {
  const rows = [...new Set(labels.map((found) => found.screen))]
  return rows.filter((row) => !entries.includes(row)).map((row) => `${row}: has a fill or select and no render entry`)
}
