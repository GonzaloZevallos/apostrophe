/**
 * What the Selector's tests share: a form inside the sheet stack over a memory router with one
 * earlier route, and the Payment method sample set. The sample set lives here and in the drawing
 * only: it is never declared in `fixedSets.ts` and no screen reads it (the payment-method testing
 * note in `docs/product/selector.md`).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, vi } from 'vitest'
import { testT } from '../i18n/testing'
import { HOME } from '../routes'
import type { SelectorOption } from './Selector'
import { Form } from './SelectorTestHost'
import { SheetRouterProvider, SheetStackProvider, sheetDepth } from './useSheetStack'

const FORM_TITLE = 'The form'
const EARLIER_TITLE = 'Before the form'

export const submitSpy = vi.fn()

/** The business's offered methods as `GET /api/payment-methods` answers them. */
export const PAYMENT_METHODS_LIST = [
  { id: 1, name: 'Cash', icon: 'banknote', position: 1, in_use: false },
  { id: 2, name: 'Transfer', icon: 'bank', position: 2, in_use: false },
]

/** A `fetch` answering the methods list with `PAYMENT_METHODS_LIST` and nothing else. */
export function stubPaymentMethodsFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(PAYMENT_METHODS_LIST), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      ),
    ),
  )
}

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
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
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
  // The phone's list closes through the history, a frame later; whoever types next must not race
  // the focus the closing list hands back to the field.
  await waitFor(() => expect(option).not.toBeInTheDocument())
}

/** Chooses New sale's Paid state, which is what opens the Payment method field. */
export async function choosePaid(user: Pick<UserEvent, 'click'>): Promise<void> {
  await user.click(await screen.findByRole('radio', { name: 'Paid' }))
}
