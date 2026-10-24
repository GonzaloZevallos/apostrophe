/**
 * Test helper: one `AmountRow` (or one named week, month or history group) inside a
 * scope. It never searches the whole page, because labels like "Stock shortfall" repeat
 * across weeks, months, the strip and the history block.
 */

import { within } from '@testing-library/react'

export function rowOf(scope: HTMLElement, name: string | RegExp): HTMLElement {
  return within(scope).getByRole('group', { name })
}
