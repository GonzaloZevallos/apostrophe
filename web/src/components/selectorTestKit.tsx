/**
 * What the Selector's tests share: a form inside the sheet stack over a memory router with one
 * earlier route, and the Payment method sample set. The sample set lives here and in the drawing
 * only: it is never declared in `fixedSets.ts` and no screen reads it (the payment-method testing
 * note in `docs/product/selector.md`).
 */

import { render, screen } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { testT } from '../i18n/testing'
import { HOME } from '../routes'
import type { SelectorOption } from './Selector'
import { Form } from './SelectorTestHost'
import { SheetRouterProvider, SheetStackProvider, sheetDepth } from './useSheetStack'

const FORM_TITLE = 'The form'
const EARLIER_TITLE = 'Before the form'

export const submitSpy = vi.fn()

export function numbered(count: number): SelectorOption[] {
  return Array.from({ length: count }, (_unused, index) => ({
    value: `v${index + 1}`,
    label: `Option ${index + 1}`,
  }))
}

/** The Payment method sample set, from the copy keys the testing note names. */
export function paymentMethodOptions(): SelectorOption[] {
  return [
    { value: 'cash', label: testT('common:paymentMethod'), glyph: '$' },
    { value: 'paid', label: testT('common:paid') },
    { value: 'owing', label: testT('common:owing') },
  ]
}

/** Renders `ui` as a form at `/` over an earlier route; `level` is the SheetLevel it sits in. */
export function renderForm(ui: ReactNode, { level = 0 }: { level?: number } = {}) {
  const router = createMemoryRouter(
    [
      {
        path: HOME,
        element: (
          <SheetStackProvider>
            <Form level={level} onSubmit={submitSpy} title={FORM_TITLE}>
              {ui}
            </Form>
          </SheetStackProvider>
        ),
      },
      { path: '/afuera', element: <h1>{EARLIER_TITLE}</h1> },
    ],
    { initialEntries: ['/afuera', '/'], initialIndex: 1 },
  )
  const view = render(
    <SheetRouterProvider router={router}>
      <RouterProvider router={router} />
    </SheetRouterProvider>,
  )
  return { router, depth: () => sheetDepth(router.state.location.state), ...view }
}

/**
 * Chooses a Payment method the way a person does: opens the "Payment method" field, then picks the
 * option, in the computer's dropdown (`option`) or the phone's list (a button in the list).
 */
export async function choosePaymentMethod(user: Pick<UserEvent, 'click'>, method: 'Cash' | 'Transfer'): Promise<void> {
  await user.click(await screen.findByRole('button', { name: /^Payment method/ }))
  const option = screen.queryByRole('option', { name: method }) ?? (await screen.findByRole('button', { name: method }))
  await user.click(option)
}
