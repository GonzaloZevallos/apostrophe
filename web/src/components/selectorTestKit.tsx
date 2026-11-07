/**
 * What the Selector's tests share: a form (a real `<form onSubmit>`) inside the sheet stack over
 * a memory router with one earlier route, a controlled Selector, and the Payment method sample
 * set. The sample set lives here and in the drawing only: it is never declared in `fixedSets.ts`
 * and no screen reads it (the payment-method testing note in `docs/product/selector.md`).
 */

import { render } from '@testing-library/react'
import { type ReactNode, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import i18n from '../i18n'
import { HOME } from '../routes'
import Selector, { type SelectorOption, type SelectorProps } from './Selector'
import { SheetLevel, SheetRouterProvider, SheetStackProvider, sheetDepth } from './useSheetStack'

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
    { value: 'cash', label: i18n.t('common:paymentMethod'), glyph: '$' },
    { value: 'paid', label: i18n.t('common:paid') },
    { value: 'owing', label: i18n.t('common:owing') },
  ]
}

export type ControlledProps = Omit<SelectorProps, 'value' | 'onChange'> & {
  initial?: string | null
  onPick?: (value: string | null) => void
}

/** A Selector that holds its own value, as a screen's field does. */
export function Controlled({ initial = null, onPick, ...rest }: ControlledProps) {
  const [value, setValue] = useState<string | null>(initial)
  return (
    <Selector
      {...rest}
      value={value}
      onChange={(next) => {
        onPick?.(next)
        setValue(next)
      }}
    />
  )
}

function Form({ children, level }: { children: ReactNode; level: number }) {
  return (
    <main>
      <h1>The form</h1>
      <form onSubmit={submitSpy}>
        <SheetLevel.Provider value={level}>{children}</SheetLevel.Provider>
      </form>
    </main>
  )
}

/** Renders `ui` as a form at `/` over an earlier route; `level` is the SheetLevel it sits in. */
export function renderForm(
  ui: ReactNode,
  { level = 0, initialState }: { level?: number; initialState?: unknown } = {},
) {
  const router = createMemoryRouter(
    [
      {
        path: HOME,
        element: (
          <SheetStackProvider>
            <Form level={level}>{ui}</Form>
          </SheetStackProvider>
        ),
      },
      { path: '/afuera', element: <h1>Before the form</h1> },
    ],
    { initialEntries: ['/afuera', { pathname: '/', state: initialState }], initialIndex: 1 },
  )
  const view = render(
    <SheetRouterProvider router={router}>
      <RouterProvider router={router} />
    </SheetRouterProvider>,
  )
  return { router, depth: () => sheetDepth(router.state.location.state), ...view }
}
