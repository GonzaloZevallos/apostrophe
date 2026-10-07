/**
 * `Icono` at the component seam (GH-97): every icon is drawn at 22 px with stroke 1.6,
 * decorative unless a caller names it. No prop can change the size or the stroke:
 * `tests/test_design_icons.py` fails if one comes back.
 */

import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import Icono, { ICON_NAMES } from './Icono'

test.each(ICON_NAMES)('%s is drawn at 22 px with stroke 1.6 in currentColor', (nombre) => {
  const { container } = render(<Icono nombre={nombre} />)
  const svg = container.querySelector('svg')
  expect(svg).not.toBeNull()
  expect(svg).toHaveAttribute('width', '22')
  expect(svg).toHaveAttribute('height', '22')
  expect(svg).toHaveAttribute('stroke-width', '1.6')
  expect(svg).toHaveAttribute('stroke', 'currentColor')
  expect(svg).toHaveAttribute('fill', 'none')
  expect(svg?.querySelector('svg')).toBeNull()
})

test.each(ICON_NAMES)('%s draws something', (nombre) => {
  const { container } = render(<Icono nombre={nombre} />)
  expect(container.querySelector('svg')?.children.length).toBeGreaterThan(0)
})

test('an icon without a label is hidden from assistive technology', () => {
  const { container } = render(<Icono nombre="tacho" />)
  const svg = container.querySelector('svg')
  expect(svg).toHaveAttribute('aria-hidden', 'true')
  expect(svg).not.toHaveAttribute('role')
  expect(svg).not.toHaveAttribute('aria-label')
})

test('an icon with a label is an image with that name', () => {
  const { getByRole } = render(<Icono nombre="tacho" label="Borrar" />)
  expect(getByRole('img', { name: 'Borrar' })).not.toHaveAttribute('aria-hidden')
})
