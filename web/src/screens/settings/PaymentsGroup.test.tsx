/**
 * Settings → Payments and expenses on the real router (`App` with `fetch` faked): the headings,
 * the line under the title, the Expense categories subtitle (server order, no front sort, none while
 * pending, failed or empty), and the one loading state `ContentArea` shows on `<main>`.
 */

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../../App'
import { queryClient } from '../../queryClient'
import { router } from '../../router'
import { EXPENSE_CATEGORIES, EXPENSES, HOME, SETTINGS_PAYMENTS } from '../../routes'
import { stubViewport } from '../../test-viewport'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', money: { symbol: '$', decimals: 0 } }
const METHODS = [
  { id: 1, name: 'Cash', icon: 'cash', archived: false },
  { id: 2, name: 'Transfer', icon: 'bank', archived: false },
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

type Answer = () => Promise<Response>

interface Served {
  urls: string[]
  bodies: unknown[]
}

function serve(categories: Answer, methods: Answer = () => Promise.resolve(json(METHODS))): Served {
  const served: Served = { urls: [], bodies: [] }
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      served.urls.push(path)
      served.bodies.push(init?.body)
      if (path.includes('/auth/me')) return Promise.resolve(json(ME))
      if (path.includes('/expense-categories')) return categories()
      if (path.includes('/payment-methods')) return methods()
      return Promise.resolve(json([]))
    }),
  )
  return served
}

async function open(): Promise<void> {
  stubViewport('phone')
  await act(() => router.navigate(SETTINGS_PAYMENTS))
  render(<App />)
  await screen.findByRole('main')
}

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

test('shows the line under the title and the two headings, each above its row', async () => {
  serve(() => Promise.resolve(json([])))
  await open()

  expect(await screen.findByText('How you get paid and what you spend on')).toBeInTheDocument()
  const payments = screen.getByRole('heading', { name: 'Payments' }).closest('section')
  const expenses = screen.getByRole('heading', { name: 'Expenses' }).closest('section')
  expect(payments).not.toBeNull()
  expect(expenses).not.toBeNull()
  expect(within(payments as HTMLElement).getByRole('link', { name: /^Payment methods/ })).toBeInTheDocument()
  expect(within(expenses as HTMLElement).getByRole('link', { name: /^Expense categories/ })).toBeInTheDocument()
})

test('the Expense categories subtitle lists the names in the order the server returned, joined with ", "', async () => {
  serve(() => Promise.resolve(json([{ id: 2, name: 'Zinc' }, { id: 1, name: 'Alquiler' }, { id: 3, name: 'Luz' }])))
  await open()

  expect(await screen.findByRole('link', { name: /^Expense categories\s*Zinc, Alquiler, Luz$/ })).toBeInTheDocument()
})

test('an empty list shows no subtitle', async () => {
  serve(() => Promise.resolve(json([])))
  await open()

  expect(await screen.findByRole('link', { name: /^Payment methods\s*Cash, Transfer$/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /^Expense categories$/ })).toBeInTheDocument()
})

test('a 500 on the categories shows no subtitle and no error, and the row still opens its screen', async () => {
  serve(() => Promise.resolve(json({ detail: 'boom' }, 500)))
  await open()

  expect(await screen.findByRole('link', { name: /^Payment methods\s*Cash, Transfer$/ })).toBeInTheDocument()
  const row = screen.getByRole('link', { name: /^Expense categories$/ })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText(/couldn't|try again/i)).not.toBeInTheDocument()

  await userEvent.click(row)

  await waitFor(() => expect(router.state.location.pathname).toBe(EXPENSE_CATEGORIES))
})

test('while both reads are held, main is busy and both row titles show; it clears once they settle', async () => {
  let release: (response: Response) => void = () => undefined
  const held = new Promise<Response>((resolve) => {
    release = resolve
  })
  serve(
    () => held.then((response) => response.clone()),
    () => held.then(() => json(METHODS)),
  )
  await open()

  const main = (await screen.findByRole('heading', { name: 'Payments' })).closest('main') as HTMLElement
  expect(main).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByText('Payment methods')).toBeVisible()
  expect(screen.getByText('Expense categories')).toBeVisible()

  await act(async () => {
    release(json([{ id: 1, name: 'Alquiler' }]))
  })

  await waitFor(() => expect(main).not.toHaveAttribute('aria-busy'))
})

test('main stops being busy when the categories read answers 500', async () => {
  serve(() => Promise.resolve(json({ detail: 'boom' }, 500)))
  await open()

  const main = (await screen.findByRole('heading', { name: 'Payments' })).closest('main') as HTMLElement
  await waitFor(() => expect(main).not.toHaveAttribute('aria-busy'))
})

test('no request names a business', async () => {
  const served = serve(() => Promise.resolve(json([{ id: 1, name: 'Alquiler' }])))
  await open()
  await screen.findByRole('link', { name: /^Expense categories\s*Alquiler$/ })

  const categoryCalls = served.urls.filter((url) => url.includes('/expense-categories'))
  expect(categoryCalls.length).toBeGreaterThan(0)
  for (const url of served.urls) expect(url).not.toMatch(/business/i)
  for (const body of served.bodies) expect(body === undefined || !/business/i.test(String(body))).toBe(true)
})

const EXPENSES_LINK = "See this month's expenses"

test('the link to this month\'s expenses opens plain Expenses, with no month in the address', async () => {
  serve(() => Promise.resolve(json([])))
  await open()

  const link = await screen.findByRole('link', { name: EXPENSES_LINK })
  expect(link).toHaveAttribute('href', EXPENSES)
})

test('the nav keeps its two rows and the link to the expenses sits outside it', async () => {
  serve(() => Promise.resolve(json([])))
  await open()

  const link = await screen.findByRole('link', { name: EXPENSES_LINK })
  const nav = screen.getByRole('navigation', { name: 'Payments and expenses' })
  expect(within(nav).getAllByRole('link')).toHaveLength(2)
  expect(nav).not.toContainElement(link)
})

test('the link shows while the reads are pending', async () => {
  const held = new Promise<Response>(() => undefined)
  serve(
    () => held,
    () => held,
  )
  await open()

  expect(await screen.findByRole('link', { name: EXPENSES_LINK })).toBeVisible()
})

test('the link shows after both reads fail', async () => {
  serve(
    () => Promise.resolve(json({ detail: 'boom' }, 500)),
    () => Promise.resolve(json({ detail: 'boom' }, 500)),
  )
  await open()

  const main = (await screen.findByRole('heading', { name: 'Payments' })).closest('main') as HTMLElement
  await waitFor(() => expect(main).not.toHaveAttribute('aria-busy'))
  expect(screen.getByRole('link', { name: EXPENSES_LINK })).toBeVisible()
})
