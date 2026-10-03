/**
 * `App`'s router split (plan, "Session"; invariants): the public branch never mounts
 * a gated query. `/entrar` is the seam this pins — no `fetch` at all until the person
 * submits the form.
 */

import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { queryClient } from './queryClient'

beforeEach(() => {
  window.history.pushState({}, '', '/entrar')
})

afterEach(() => {
  vi.unstubAllGlobals()
  queryClient.clear()
  window.history.pushState({}, '', '/')
})

test('the public /entrar route renders Entrar without running a gated query', () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  render(<App />)

  expect(screen.getByRole('main')).toHaveTextContent('apostrophe')
  expect(fetchMock).not.toHaveBeenCalled()
})
