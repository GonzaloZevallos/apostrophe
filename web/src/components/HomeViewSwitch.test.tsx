/**
 * `HomeViewSwitch` at the component seam: the Today | Analysis segment is navigation (two
 * links in a named group), the selected one told by `aria-current` and not by colour alone,
 * and it exists only on the phone.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ANALYSIS, HOME, type Viewport } from '../routes'
import { stubViewport } from '../test-viewport'
import HomeViewSwitch from './HomeViewSwitch'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderSwitch(selected: 'today' | 'analysis', viewport: Viewport = 'phone') {
  stubViewport(viewport)
  render(
    <MemoryRouter initialEntries={[selected === 'today' ? HOME : ANALYSIS]}>
      <Routes>
        <Route path={HOME} element={<HomeViewSwitch selected="today" />} />
        <Route path={ANALYSIS} element={<HomeViewSwitch selected="analysis" />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('on the phone', () => {
  test('Home shows Today selected, Analysis one tap away', async () => {
    renderSwitch('today')

    const group = screen.getByRole('group', { name: 'Home view' })
    expect(within(group).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
    const analysis = within(group).getByRole('link', { name: 'Analysis' })
    expect(analysis).not.toHaveAttribute('aria-current')

    await userEvent.click(analysis)

    const next = screen.getByRole('group', { name: 'Home view' })
    expect(within(next).getByRole('link', { name: 'Analysis' })).toHaveAttribute('aria-current', 'page')
    expect(within(next).getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current')
  })

  test('Analysis shows Analysis selected, and Today leads back to Home', async () => {
    renderSwitch('analysis')

    await userEvent.click(screen.getByRole('link', { name: 'Today' }))

    expect(within(screen.getByRole('group', { name: 'Home view' })).getByRole('link', { name: 'Today' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

test('on the computer the segment is absent', () => {
  renderSwitch('today', 'computer')

  expect(screen.queryByRole('group', { name: 'Home view' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Analysis' })).not.toBeInTheDocument()
})
