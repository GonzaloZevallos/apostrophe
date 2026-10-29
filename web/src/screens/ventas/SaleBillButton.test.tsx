/**
 * `SaleBillButton` at its props seam (`state`, `refreshing`, `onCopied`): what it draws while the
 * detail loads or refreshes, when there is no bill, and the one tap's outcomes. The browser's share
 * and clipboard APIs are stubbed where the app's two modules call them.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { SaleBill } from '../../api/sales'
import SALE_DETAIL from '../../api/fixtures/sale-detail.json'
import SaleBillButton from './SaleBillButton'

const BILL = SALE_DETAIL.bill as SaleBill
const BILL_TEXT = 'Flores del Sur\n14/09\n\nFlor A 3,5 g · $ 10.500\nShipping · $ 500\n\nTotal · $ 11.000\nStill owed on this sale: $ 11.000\nYour balance: $ 11.000'

function setSecureContext(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true })
}

beforeEach(() => {
  setSecureContext(true)
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'clipboard')
  Reflect.deleteProperty(document, 'execCommand')
  vi.restoreAllMocks()
})

function stubShare(impl: (data: ShareData) => Promise<void>) {
  const share = vi.fn(impl)
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  return share
}

test('while loading it keeps its label, is disabled and busy, and shows no digit or $', () => {
  render(<SaleBillButton state={{ kind: 'loading' }} refreshing={false} onCopied={() => undefined} />)

  const button = screen.getByRole('button', { name: 'Copy' })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('aria-busy', 'true')
  expect(button.textContent).not.toMatch(/[0-9$]/)
})

test('a ready detail with no bill renders nothing', () => {
  const { container } = render(
    <SaleBillButton state={{ kind: 'ready', bill: null }} refreshing={false} onCopied={() => undefined} />,
  )

  expect(container).toBeEmptyDOMElement()
})

test('a ready bill that is refreshing is busy and disabled like loading', () => {
  render(<SaleBillButton state={{ kind: 'ready', bill: BILL }} refreshing onCopied={() => undefined} />)

  const button = screen.getByRole('button', { name: 'Copy' })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('aria-busy', 'true')
})

test('Share calls navigator.share with the rendered text and shows nothing after', async () => {
  const share = stubShare(() => Promise.resolve())
  const onCopied = vi.fn()
  render(<SaleBillButton state={{ kind: 'ready', bill: BILL }} refreshing={false} onCopied={onCopied} />)

  await userEvent.click(screen.getByRole('button', { name: 'Share' }))

  expect(share).toHaveBeenCalledWith({ text: BILL_TEXT })
  expect(onCopied).not.toHaveBeenCalled()
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
})

test('a cancelled share shows nothing and the label stays Share', async () => {
  const share = stubShare(() => Promise.reject(new DOMException('closed', 'AbortError')))
  render(<SaleBillButton state={{ kind: 'ready', bill: BILL }} refreshing={false} onCopied={() => undefined} />)

  await userEvent.click(screen.getByRole('button', { name: 'Share' }))

  await waitFor(() => expect(share).toHaveBeenCalled())
  expect(screen.queryByText("Couldn't share. Tap Copy and paste it into the chat.")).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
})

test('a failed share shows its line with the attention icon and the label becomes Copy', async () => {
  stubShare(() => Promise.reject(new Error('boom')))
  render(<SaleBillButton state={{ kind: 'ready', bill: BILL }} refreshing={false} onCopied={() => undefined} />)

  await userEvent.click(screen.getByRole('button', { name: 'Share' }))

  const line = await screen.findByText("Couldn't share. Tap Copy and paste it into the chat.")
  expect(line.closest('.aviso-ambar--atencion')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
})

test('over plain http Copy runs execCommand synchronously within the click and reports the copy', async () => {
  setSecureContext(false)
  const execCommand = vi.fn(() => true)
  Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
  const onCopied = vi.fn()
  render(<SaleBillButton state={{ kind: 'ready', bill: BILL }} refreshing={false} onCopied={onCopied} />)

  fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

  expect(execCommand).toHaveBeenCalledWith('copy')
  await waitFor(() => expect(onCopied).toHaveBeenCalledTimes(1))
})

test('a failed copy shows its line with the attention icon and the text in a block named Sale bill', async () => {
  setSecureContext(false)
  Object.defineProperty(document, 'execCommand', { value: vi.fn(() => false), configurable: true })
  render(<SaleBillButton state={{ kind: 'ready', bill: BILL }} refreshing={false} onCopied={() => undefined} />)

  await userEvent.click(screen.getByRole('button', { name: 'Copy' }))

  const line = await screen.findByText("Couldn't copy. Select the text below and copy it by hand.")
  expect(line.closest('.aviso-ambar--atencion')).not.toBeNull()
  const block = screen.getByRole('region', { name: 'Sale bill' })
  expect(block.textContent).toBe(BILL_TEXT)
  expect(block.querySelector('pre')).not.toBeNull()
})

test('a double tap with the share held calls share once', async () => {
  const share = stubShare(() => new Promise<void>(() => undefined))
  render(<SaleBillButton state={{ kind: 'ready', bill: BILL }} refreshing={false} onCopied={() => undefined} />)
  const button = screen.getByRole('button', { name: 'Share' })

  await userEvent.click(button)
  await userEvent.click(button)

  expect(share).toHaveBeenCalledTimes(1)
})

test('after the page comes back visible a new tap shares again, and the first share failing late shows nothing', async () => {
  const rejections: ((reason: Error) => void)[] = []
  const share = stubShare(
    () =>
      new Promise<void>((_resolve, reject) => {
        rejections.push(reject)
      }),
  )
  render(<SaleBillButton state={{ kind: 'ready', bill: BILL }} refreshing={false} onCopied={() => undefined} />)
  const button = screen.getByRole('button', { name: 'Share' })

  await userEvent.click(button)
  document.dispatchEvent(new Event('visibilitychange'))
  await userEvent.click(button)
  expect(share).toHaveBeenCalledTimes(2)
  rejections[0]?.(new Error('late'))
  await Promise.resolve()
  await Promise.resolve()

  expect(screen.queryByText("Couldn't share. Tap Copy and paste it into the chat.")).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
})
