/**
 * `paymentMethodIcons` (GH-318, subtask `glyphs`): the wire value of a payment method's
 * icon mapped to the `Icono` that draws it. Exactly the six neutral icons of the PRD.
 */

import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import Icono from './Icono'
import { paymentMethodIcons } from './paymentMethodIcons'

const SIX = ['bank', 'card', 'coins', 'generic', 'phone', 'wallet']

test('the map has exactly the six payment-method icons', () => {
  expect(Object.keys(paymentMethodIcons).sort()).toEqual(SIX)
})

test.each(SIX)('%s renders a decorative glyph of its own', (wire) => {
  const props = paymentMethodIcons[wire as keyof typeof paymentMethodIcons]
  const { container } = render(<Icono {...props} />)
  const svg = container.querySelector('svg')
  expect(svg).toHaveAttribute('aria-hidden', 'true')
  expect(svg?.children.length).toBeGreaterThan(0)
})
