import { act, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test } from 'vitest'
import { markGone, useGoneNotice } from './goneNotice'
import { gone } from './feedback'
import { SheetRouterProvider } from './useSheetStack'

const LIST = '/lista'
const OTHER = '/otra'
const FORM = '/forma'

function Page({ name }: { name: string }) {
  const shown = useGoneNotice()
  return (
    <main>
      <h1>{name}</h1>
      {shown && <p role="status">Eso ya no está.</p>}
    </main>
  )
}

function setup(initialEntries: string[], initialIndex?: number, attached = true) {
  const router = createMemoryRouter(
    [
      { path: LIST, element: <Page name="Lista" /> },
      { path: OTHER, element: <Page name="Otra" /> },
      { path: FORM, element: <Page name="Forma" /> },
      { path: '/lejos', element: <Page name="Lejos" /> },
    ],
    { initialEntries, initialIndex },
  )
  const app = <RouterProvider router={router} />
  render(<StrictMode>{attached ? <SheetRouterProvider router={router}>{app}</SheetRouterProvider> : app}</StrictMode>)
  return router
}

test('a notice marked for the parent shows on that entry after going back to it, once', async () => {
  const router = setup([OTHER, LIST, FORM], 2)
  await act(async () => {
    markGone(LIST, router.state.location.key)
    await router.navigate(-1)
  })

  expect(router.state.location.pathname).toBe(LIST)
  expect(screen.getAllByRole('status')).toHaveLength(1)
})

test('an immediate second Back shows no notice on the screen before the parent', async () => {
  const router = setup([OTHER, LIST, FORM], 2)
  await act(async () => {
    markGone(LIST, router.state.location.key)
    await router.navigate(-1)
  })
  await act(async () => router.navigate(-1))

  expect(router.state.location.pathname).toBe(OTHER)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('a forward navigation off the parent shows no notice, and coming back to the parent does not either', async () => {
  const router = setup([LIST, FORM], 1)
  await act(async () => {
    markGone(LIST, router.state.location.key)
    await router.navigate(-1)
  })
  await act(async () => router.navigate(OTHER))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  await act(async () => router.navigate(-1))

  expect(router.state.location.pathname).toBe(LIST)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('a parent that never mounts leaves nothing behind: the next location change clears the slot', async () => {
  const router = setup([OTHER, FORM], 1)
  await act(async () => {
    markGone(LIST, router.state.location.key)
    await router.navigate(-1)
  })
  expect(router.state.location.pathname).toBe(OTHER)
  await act(async () => router.navigate(LIST))

  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('a notice carried in the entry state shows on that entry, whatever the slot holds', async () => {
  const router = setup([OTHER, FORM], 1)
  await act(async () => router.navigate(LIST, { replace: true, state: gone() }))

  expect(screen.getAllByRole('status')).toHaveLength(1)
})

test('without a router handle attached nothing binds the slot, so a back-exit shows no notice', async () => {
  const router = setup([LIST, FORM], 1, false)
  await act(async () => {
    markGone(LIST, router.state.location.key)
    await router.navigate(-1)
  })

  expect(router.state.location.pathname).toBe(LIST)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
