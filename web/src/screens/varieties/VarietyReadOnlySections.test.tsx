/**
 * The threshold and catalog sections in their `readOnly` mode (varieties.md, "An archived
 * variety's page"), through Testing Library: the stored setting and the stored attributes
 * only, with no switch, no "Editar" and nothing from the live computation.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import FlashProvider from '../../flash/FlashProvider'
import type { VarietyStock } from '../../api/stock'
import VarietyCatalogSection from './VarietyCatalogSection'
import VarietyThresholdSection from './VarietyThresholdSection'

function inApp(node: React.ReactNode) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <FlashProvider>{node}</FlashProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

const LOW: VarietyStock = { variety_id: 1, grams: 18, status: 'low', sold_out_since: null, threshold: 20, days_left: 24 }

function threshold(row: VarietyStock, readOnly: boolean) {
  inApp(<VarietyThresholdSection varietyId={1} row={row} refreshing={false} onGone={() => undefined} readOnly={readOnly} />)
}

test('a read-only threshold states the stored setting, never "Avisando", with no switch and no Editar', () => {
  threshold(LOW, true)

  expect(screen.getByRole('heading', { name: 'Aviso de stock bajo' })).toBeInTheDocument()
  expect(screen.getByText('Warn me below 20 g')).toBeInTheDocument()
  expect(screen.queryByText(/Avisando/)).toBeNull()
  expect(screen.queryByRole('switch')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Editar aviso' })).toBeNull()
})

test('a read-only threshold that is off says Warning off', () => {
  threshold({ ...LOW, threshold: null, status: 'ok' }, true)

  expect(screen.getByText('Warning off')).toBeInTheDocument()
})

test('the same threshold on a live variety keeps "Avisando", its switch and Editar', () => {
  threshold(LOW, false)

  expect(screen.getByText('Warning: 18 g left')).toBeInTheDocument()
  expect(screen.getByRole('switch')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Editar aviso' })).toBeInTheDocument()
})

const ATTRIBUTES = { shown: false, emoji: '🍪', indica_share: 70, aroma: 'Galletita y vainilla' }

test('a read-only catalog section shows the four stored attributes in words, with no Editar', () => {
  inApp(<VarietyCatalogSection row={ATTRIBUTES} readOnly />)

  expect(screen.getByRole('heading', { name: 'En el catálogo' })).toBeInTheDocument()
  expect(screen.getByText('No se muestra')).toBeInTheDocument()
  expect(screen.getByText('🍪')).toBeInTheDocument()
  expect(screen.getByText('70 %')).toBeInTheDocument()
  expect(screen.getByText('Galletita y vainilla')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Editar catálogo' })).toBeNull()
})

test('a read-only catalog section leaves out an attribute that was never set', () => {
  inApp(<VarietyCatalogSection row={{ shown: true, emoji: null, indica_share: null, aroma: 'Cítrico' }} readOnly />)

  expect(screen.getByText('Se muestra')).toBeInTheDocument()
  expect(screen.getByText('Cítrico')).toBeInTheDocument()
  expect(screen.queryByText('Emoji')).toBeNull()
  expect(screen.queryByText('% índica')).toBeNull()
  expect(screen.queryByText('—')).toBeNull()
})

test('the live catalog section keeps its dashes and Editar', () => {
  inApp(<VarietyCatalogSection row={{ shown: true, emoji: null, indica_share: null, aroma: null }} />)

  expect(screen.getAllByText('—')).toHaveLength(3)
  expect(screen.getByRole('button', { name: 'Editar catálogo' })).toBeInTheDocument()
})
