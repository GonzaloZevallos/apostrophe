import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { GONE_NOTICE } from '../api/refusals'
import GoneNotice from './GoneNotice'

test('announces the fixed gone-record text, never styled or read as a success toast', () => {
  render(<GoneNotice />)

  const status = screen.getByRole('status')
  expect(status).toHaveTextContent(GONE_NOTICE)
  expect(status.className).not.toContain('exito')
})

test('renders with no floating wrapper of its own, so the screen decides the placement', () => {
  // review finding (e2e): GoneNotice used to hard-code `.aviso-flotante`, which
  // matched Gastos/GastoCategorias's floating toast but broke VariedadDetalle's
  // inline one. Each screen now wraps (or doesn't) to match its own toast —
  // see Gastos.test.tsx, GastoCategorias.test.tsx and VariedadDetalle.test.tsx.
  const { container } = render(<GoneNotice />)

  const status = screen.getByRole('status')
  expect(container.firstChild).toBe(status)
})
