/**
 * How a New sale test reaches a line's Product field and picks a Product: the field is the
 * Selector's button, named `Line N product` followed by its value, and the list is its Sheet's
 * dialog. The one place a test says how a line's Product is picked.
 */

import { screen, waitFor, within } from '@testing-library/react'
import { expect } from 'vitest'
import type userEvent from '@testing-library/user-event'

export function productFieldName(n: number): RegExp {
  return new RegExp(`^Line ${n} product`)
}

export function productField(n: number): HTMLElement {
  return screen.getByRole('button', { name: productFieldName(n) })
}

export function queryProductField(n: number): HTMLElement | null {
  return screen.queryByRole('button', { name: productFieldName(n) })
}

/** Opens line `n`'s list and taps the Product called `name`. */
export async function pickProduct(
  user: ReturnType<typeof userEvent.setup>,
  n: number,
  name: string,
): Promise<void> {
  // The Products arrive after the form mounts: the field waits (disabled) until they have.
  await waitFor(() => expect(productField(n)).toBeEnabled())
  await user.click(productField(n))
  const computerList = screen.queryByRole('listbox', { name: `Line ${n} product options` })
  if (computerList !== null) {
    await user.click(within(computerList).getByRole('option', { name: new RegExp(`^${name}`) }))
    await waitFor(() => expect(computerList).not.toBeInTheDocument())
    return
  }
  const list = await screen.findByRole('dialog', { name: `Line ${n} product options` })
  await user.click(within(list).getByRole('button', { name: new RegExp(`^${name}`) }))
  // The pick closes the list through the history, a moment after the tap.
  await waitFor(() => expect(list).not.toBeInTheDocument())
}
