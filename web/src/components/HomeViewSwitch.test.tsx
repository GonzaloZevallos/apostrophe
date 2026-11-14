/**
 * `HomeViewSwitch` at the component seam: the Today | Analysis segment is navigation (two
 * links in a named group), the marked one told by `aria-current` and not by colour alone, taken
 * from the registry through the leaf route, and it exists only on the phone.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ANALYSIS, HOME, type ScreenId, type Viewport } from '../routes'
import { screenRoute } from '../test/screenRoute'
import { stubViewport } from '../test-viewport'
import HomeViewSwitch from './HomeViewSwitch'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderSwitch(on: ScreenId, viewport: Viewport = 'phone') {
  stubViewport(viewport)
  const router = createMemoryRouter(
    [screenRoute('home', <HomeViewSwitch />), screenRoute('analysis', <HomeViewSwitch />)],
    { initialEntries: [on === 'home' ? HOME : ANALYSIS] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('on the phone', () => {
  test('Home marks Today, Analysis one tap away', async () => {
    renderSwitch('home')

    const group = screen.getByRole('group', { name: 'Home view' })
    expect(within(group).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
    const analysis = within(group).getByRole('link', { name: 'Analysis' })
    expect(analysis).not.toHaveAttribute('aria-current')

    await userEvent.click(analysis)

    const next = screen.getByRole('group', { name: 'Home view' })
    expect(within(next).getByRole('link', { name: 'Analysis' })).toHaveAttribute('aria-current', 'page')
    expect(within(next).getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current')
  })

  test('Analysis marks Analysis, and Today leads back to Home', async () => {
    const router = renderSwitch('analysis')

    await userEvent.click(screen.getByRole('link', { name: 'Today' }))

    expect(router.state.location.pathname).toBe(HOME)
    expect(within(screen.getByRole('group', { name: 'Home view' })).getByRole('link', { name: 'Today' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('the options are links, never tabs, and each opens its registry path', () => {
    renderSwitch('home')

    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('href', HOME)
    expect(screen.getByRole('link', { name: 'Analysis' })).toHaveAttribute('href', ANALYSIS)
  })

  test('a leaf route that declares no screen is a bug in the table: it throws, with no fallback', () => {
    stubViewport('phone')
    const router = createMemoryRouter([{ path: HOME, element: <HomeViewSwitch /> }], { initialEntries: [HOME] })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<RouterProvider router={router} />)

    expect(screen.getByText('Shell: the leaf route does not declare a screen (routes.ts)')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Home view' })).not.toBeInTheDocument()
  })
})

test('on the computer the segment is absent', () => {
  renderSwitch('home', 'computer')

  expect(screen.queryByRole('group', { name: 'Home view' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Analysis' })).not.toBeInTheDocument()
})
