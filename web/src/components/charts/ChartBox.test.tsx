import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { flipViewport, renderWithViewport } from '../../test-viewport'
import ChartBox from './ChartBox'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('at computer width nothing is rendered, and a media change toggles it', () => {
  const { container } = renderWithViewport('computer', () => render(<ChartBox busy />))
  expect(container).toBeEmptyDOMElement()
  flipViewport('phone')
  expect(container).not.toBeEmptyDOMElement()
  flipViewport('computer')
  expect(container).toBeEmptyDOMElement()
})

test('on a phone the box has its token height from the first render, busy or loaded', () => {
  const busy = renderWithViewport('phone', () => render(<ChartBox busy />))
  expect(busy.container.firstElementChild).toHaveStyle({ blockSize: 'var(--alto-grafico-barra)' })
  busy.unmount()
  const loaded = render(<ChartBox>the chart</ChartBox>)
  expect(loaded.container.firstElementChild).toHaveStyle({ blockSize: 'var(--alto-grafico-barra)' })
})

test('while busy it is aria-busy with no text and no digit, even if given children', () => {
  const { container } = renderWithViewport('phone', () => render(<ChartBox busy>Total 120</ChartBox>))
  expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true')
  expect(container).toHaveTextContent(/^$/)
  expect(container.textContent).not.toMatch(/\d/)
})

test('once loaded it is no longer busy and shows its children', () => {
  const { container } = renderWithViewport('phone', () => render(<ChartBox>Seeds are the biggest share</ChartBox>))
  expect(container.firstElementChild).not.toHaveAttribute('aria-busy')
  expect(screen.getByText('Seeds are the biggest share')).toBeInTheDocument()
})
