import { render as renderBare, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { flipViewport, stubViewport } from '../test-viewport'
import ConfirmDialog from './ConfirmDialog'
import ConfirmLayer from './ConfirmLayer'
import type { ReactElement, ReactNode } from 'react'
import { MoneyFormatProvider } from '../format/MoneyFormatProvider'

function Business({ children }: { children: ReactNode }) {
  return <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>{children}</MoneyFormatProvider>
}

/** Rendered for a "$"/0-decimals business, the one the strings below were written for. */
function render(ui: ReactElement) {
  return renderBare(ui, { wrapper: Business })
}

test('shows the title and detail, and confirms or cancels through its callbacks', async () => {
  const user = userEvent.setup()
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      title="¿Borrás el precio from 25/09?"
      detail="Back to $ 9.000 x g from 12/09"
      confirmText="Yes, delete it"
      cancelText="No, keep it"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )

  expect(screen.getByText('¿Borrás el precio from 25/09?')).toBeInTheDocument()
  expect(screen.getByText('Back to $ 9.000 x g from 12/09')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'No, keep it' }))
  expect(onCancel).toHaveBeenCalledOnce()
  expect(onConfirm).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Yes, delete it' }))
  expect(onConfirm).toHaveBeenCalledOnce()
})

function Opener({ answers }: { answers?: { onConfirm: () => void; onCancel: () => void } }) {
  return (
    <ConfirmDialog
      title="Delete the sale?"
      detail="It cannot be undone"
      confirmText="Yes, delete it"
      cancelText="No, keep it"
      onConfirm={answers?.onConfirm ?? (() => undefined)}
      onCancel={answers?.onCancel ?? (() => undefined)}
    />
  )
}

const locked = () => document.documentElement.classList.contains('html--confirmando')

describe('ConfirmDialog under ConfirmLayer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.className = ''
  })

  test('on the phone it is drawn in the layer, its texts in the text block, and unmounting releases all', () => {
    stubViewport('phone')
    const { unmount } = render(
      <ConfirmLayer>
        <main>
          <Opener />
        </main>
      </ConfirmLayer>,
    )
    const layer = document.querySelector('.confirm-layer')
    const dialog = screen.getByRole('alertdialog', { name: 'Delete the sale?' })
    expect(layer).toContainElement(dialog)
    const texts = dialog.querySelector('.confirmacion__texto')
    expect(texts).toContainElement(screen.getByText('Delete the sale?'))
    expect(texts).toContainElement(screen.getByText('It cannot be undone'))
    expect(texts).not.toContainElement(screen.getByRole('button', { name: 'No, keep it' }))
    expect(layer).toHaveAttribute('data-open')
    expect(layer).not.toHaveAttribute('inert')
    expect(screen.getByRole('main', { hidden: true }).parentElement).toHaveAttribute('inert')
    expect(locked()).toBe(true)

    unmount()
    expect(locked()).toBe(false)
  })

  test('the answers still answer from the layer', async () => {
    stubViewport('phone')
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmLayer>
        <Opener answers={{ onConfirm, onCancel }} />
      </ConfirmLayer>,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Yes, delete it' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })

  test('removing the dialog releases the lock while the layer stays', () => {
    stubViewport('phone')
    function Toggle({ shown }: { shown: boolean }) {
      return <ConfirmLayer>{shown ? <Opener /> : <p>Nothing asked</p>}</ConfirmLayer>
    }
    const { rerender } = render(<Toggle shown />)
    expect(locked()).toBe(true)
    rerender(<Toggle shown={false} />)
    expect(locked()).toBe(false)
    expect(document.querySelector('.confirm-layer')).not.toHaveAttribute('data-open')
    expect(screen.getByText('Nothing asked').parentElement).not.toHaveAttribute('inert')
  })

  test('on the computer it renders in place with no lock and no inert', () => {
    stubViewport('computer')
    render(
      <ConfirmLayer>
        <main>
          <Opener />
        </main>
      </ConfirmLayer>,
    )
    const dialog = screen.getByRole('alertdialog')
    expect(screen.getByRole('main')).toContainElement(dialog)
    expect(document.querySelector('.confirm-layer')).not.toContainElement(dialog)
    expect(locked()).toBe(false)
    expect(screen.getByRole('main').parentElement).not.toHaveAttribute('inert')
  })

  test('on the phone with no provider it renders in place with no lock', () => {
    stubViewport('phone')
    render(
      <main>
        <Opener />
      </main>,
    )
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('alertdialog'))
    expect(locked()).toBe(false)
  })

  test('crossing 900 px with it open keeps it open, registered on the phone and not on the computer', () => {
    stubViewport('phone')
    render(
      <ConfirmLayer>
        <main>
          <Opener />
        </main>
      </ConfirmLayer>,
    )
    expect(locked()).toBe(true)

    flipViewport('computer')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('alertdialog'))
    expect(locked()).toBe(false)
    expect(screen.getByRole('main').parentElement).not.toHaveAttribute('inert')

    flipViewport('phone')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(document.querySelector('.confirm-layer')).toContainElement(screen.getByRole('alertdialog'))
    expect(locked()).toBe(true)
  })

  test('App mounts the layer around the router', async () => {
    stubViewport('phone')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
    const { default: App } = await import('../App')
    render(<App />)
    expect(document.querySelector('.confirm-layer')).not.toBeNull()
  })
})
