/**
 * The one test helper for what sits behind a phone sheet (ADR-0053): the pane is inert and hidden
 * from assistive technology, holds no `h1` and no id, and while its data is pending or after any
 * error it draws nothing at all (no text, no skeleton, no busy mark).
 */

import { expect } from 'vitest'

export function behindPane(container: ParentNode = document): HTMLElement {
  const pane = container.querySelector<HTMLElement>('.behind-pane')
  if (pane === null) throw new Error('no behind pane is drawn')
  return pane
}

/** What every pane holds, loaded or not. */
export function expectBehindPane(pane: HTMLElement): void {
  expect(pane).toHaveAttribute('inert')
  expect(pane).toHaveAttribute('aria-hidden', 'true')
  expect(pane.querySelector('h1')).toBeNull()
  expect(pane.querySelector('[id]')).toBeNull()
  expect(pane.querySelector('[aria-busy]')).toBeNull()
}

/** A pane that is pending or failed: nothing in it. */
export function expectBehindPaneEmpty(pane: HTMLElement): void {
  expectBehindPane(pane)
  expect(pane.textContent).toBe('')
  expect(pane.children).toHaveLength(0)
}
