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
