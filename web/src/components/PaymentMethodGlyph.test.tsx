/** The glyph's accessible name at the Testing Library seam. */

import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import PaymentMethodGlyph from './PaymentMethodGlyph'

test('beside a name, the glyph is decorative: nothing is announced twice', () => {
  render(
    <p>
      <PaymentMethodGlyph icon="card" /> Mercado
    </p>,
  )
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByText('Mercado')).toBeInTheDocument()
})

test('named, the glyph is an image carrying the key name', () => {
  render(<PaymentMethodGlyph icon="qr" named />)
  expect(screen.getByRole('img', { name: 'QR code' })).toBeInTheDocument()
})

test('an unknown key draws and is named as other', () => {
  render(<PaymentMethodGlyph icon="hologram" named />)
  expect(screen.getByRole('img', { name: 'Other' })).toBeInTheDocument()
})
