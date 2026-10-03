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

test('floats in the same fixed slot a success toast uses, not inline in the page flow', () => {
  // review finding (e2e): a prior merge dropped this wrapper, so the notice
  // rendered inline at the bottom of Gastos/GastoCategorias instead of in
  // `Aviso`'s floating slot. A regression here must fail this test.
  render(<GoneNotice />)

  const status = screen.getByRole('status')
  expect(status.parentElement?.className).toContain('aviso-flotante')
})
