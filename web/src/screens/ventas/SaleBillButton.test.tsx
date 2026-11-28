/**
 * `SaleBillButton` at its props seam (`share`, `hasBill`): what the presentational block draws for
 * each `SaleBillShare` it is handed. The tap logic belongs to `useSaleBillShare` and is not driven
 * here: the block only forwards its tap to `share.onCopy`.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { SaleBillShare } from '../../sales/useSaleBillShare'
import SaleBillButton from './SaleBillButton'

function makeShare(overrides: Partial<SaleBillShare> = {}): SaleBillShare {
  return { sharing: false, busy: false, onTap: vi.fn(), onCopy: vi.fn(), failure: null, ...overrides }
}

const SHARE_FAILED = "Couldn't share. Tap Copy and paste it into the chat."
const COPY_FAILED = "Couldn't copy. Select the text below and copy it by hand."

test('with a bill it draws a group named Sharing the bill holding one Copy button', () => {
  render(<SaleBillButton share={makeShare()} hasBill />)

  const group = screen.getByRole('group', { name: 'Sharing the bill' })
  expect(screen.queryByRole('group', { name: 'Sale bill' })).not.toBeInTheDocument()
  expect(within(group).getAllByRole('button')).toHaveLength(1)
  expect(within(group).getByRole('button', { name: 'Copy' })).toBeEnabled()
})

test('with no bill it renders nothing', () => {
  const { container } = render(<SaleBillButton share={makeShare()} hasBill={false} />)

  expect(container).toBeEmptyDOMElement()
})

test('it reads Copy and never Share, even when the device can share', () => {
  render(<SaleBillButton share={makeShare({ sharing: true })} hasBill />)

  const group = screen.getByRole('group', { name: 'Sharing the bill' })
  expect(within(group).getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  expect(group.textContent).not.toMatch(/Share(?!d)/)
  expect(within(group).queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
})

test('while the share is busy the button keeps its label, is disabled and busy, and shows no digit or $', async () => {
  const onCopy = vi.fn()
  render(<SaleBillButton share={makeShare({ busy: true, onCopy })} hasBill />)

  const button = screen.getByRole('button', { name: 'Copy' })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('group', { name: 'Sharing the bill' }).textContent).not.toMatch(/[0-9$]/)
  await userEvent.click(button)
  expect(onCopy).not.toHaveBeenCalled()
})

test('tapping Copy calls share.onCopy once, and never share.onTap', async () => {
  const share = makeShare({ sharing: true })
  render(<SaleBillButton share={share} hasBill />)

  await userEvent.click(screen.getByRole('button', { name: 'Copy' }))

  expect(share.onCopy).toHaveBeenCalledTimes(1)
  expect(share.onTap).not.toHaveBeenCalled()
})

test('with no failure it shows no notice and no copy-by-hand region', () => {
  render(<SaleBillButton share={makeShare()} hasBill />)

  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
})

test('a failed share shows its line, and Copy stays', () => {
  render(<SaleBillButton share={makeShare({ failure: { kind: 'share' } })} hasBill />)

  expect(screen.getByRole('alert')).toHaveTextContent(SHARE_FAILED)
  expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
})

test('a failed copy shows its line and the text in a block named Sale bill', () => {
  render(<SaleBillButton share={makeShare({ failure: { kind: 'copy', text: 'Flores del Sur\nTotal · $ 11.000' } })} hasBill />)

  expect(screen.getByRole('alert')).toHaveTextContent(COPY_FAILED)
  expect(screen.queryByText(SHARE_FAILED)).not.toBeInTheDocument()
  const block = screen.getByRole('region', { name: 'Sale bill' })
  expect(block.textContent).toBe('Flores del Sur\nTotal · $ 11.000')
  expect(screen.getByRole('group', { name: 'Sharing the bill' })).toContainElement(block)
})
