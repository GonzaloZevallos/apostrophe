/**
 * `CatalogAttributesForm` at the component seam, API faked at `fetch`: its save marks
 * stale every query key that reads a variety's stored catalog values, the catalog's own
 * (`keys.catalog()`) and the one the archived page reads (`keys.catalogVariety(id)`).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { keys } from '../../api/keys'
import { jsonResponse } from './renderVarieties'
import CatalogAttributesForm from './CatalogAttributesForm'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a save marks the catalog and the variety\'s stored values stale', async () => {
  const user = userEvent.setup()
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { text: null, header: '', footer: '', varieties: [] })))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(keys.catalog(), { text: null, header: '', footer: '', varieties: [] })
  queryClient.setQueryData(keys.catalogVariety('1'), { shown: true, emoji: null, indica_share: null, aroma: null })
  queryClient.setQueryData(keys.catalogVariety('2'), { shown: true, emoji: null, indica_share: null, aroma: null })
  const onDone = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <CatalogAttributesForm
        row={{ id: 1, shown: true, emoji: null, indica_share: null, aroma: null }}
        onDone={onDone}
        onCancel={vi.fn()}
        onDirtyChange={vi.fn()}
        onGone={vi.fn()}
      />
    </QueryClientProvider>,
  )

  await user.type(screen.getByLabelText('Aroma/sabor'), 'cítrico')
  await user.click(screen.getByRole('button', { name: 'Guardá el catálogo' }))
  await vi.waitFor(() => expect(onDone).toHaveBeenCalled())

  expect(queryClient.getQueryState(keys.catalog())?.isInvalidated).toBe(true)
  expect(queryClient.getQueryState(keys.catalogVariety('1'))?.isInvalidated).toBe(true)
})
