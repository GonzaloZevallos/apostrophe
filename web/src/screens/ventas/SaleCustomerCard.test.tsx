/**
 * `SaleCustomerCard` at its props seam, under the Business's Money format: the chip's words for each
 * Payment state, the no-customer avatar, name and Assign button, and the plain-text name.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { formatWeekdayDay } from '../../format/dates'
import SaleCustomerCard, { type SaleCustomerCardProps } from './SaleCustomerCard'

const FORMAT = { symbol: '$', decimals: 0 }
const DATE = '2026-09-14'

function renderCard(props: Partial<SaleCustomerCardProps> = {}) {
  return render(
    <MoneyFormatProvider format={FORMAT}>
      <SaleCustomerCard
        customerName="Ana Pérez"
        date={DATE}
        language="en"
        paymentState="paid"
        stillOwed={0}
        methodName={null}
        assignDisabled={false}
        {...props}
      />
    </MoneyFormatProvider>,
  )
}

function avatarOf(container: HTMLElement): HTMLElement {
  return container.querySelector('.avatar') as HTMLElement
}

describe('the payment chip', () => {
  test('paid with a method reads "Paid · <method>"', () => {
    renderCard({ methodName: 'Cash' })
    expect(screen.getByText('Paid · Cash')).toBeInTheDocument()
  })

  test('part_paid reads as on the Sales card', () => {
    renderCard({ paymentState: 'part_paid', stillOwed: 4000 })
    expect(screen.getByText(/Part-paid/).textContent).toBe('Part-paid · $ 4.000 owed')
  })

  test('unpaid reads "Unpaid"', () => {
    renderCard({ paymentState: 'unpaid', stillOwed: 11000 })
    expect(screen.getByText('Unpaid')).toBeInTheDocument()
  })

  test('a null state reads "Payment can\'t be shown"', () => {
    renderCard({ paymentState: null, stillOwed: null })
    expect(screen.getByText("Payment can't be shown")).toBeInTheDocument()
  })
})

describe('with no customer', () => {
  test('reads "No customer", draws the icon in a hidden avatar and offers Assign customer', () => {
    const onAssign = () => undefined
    const { container } = renderCard({ customerName: null, onAssign })
    expect(screen.getByText('No customer')).toBeInTheDocument()
    const avatar = avatarOf(container)
    expect(avatar).toHaveAttribute('aria-hidden', 'true')
    expect(avatar.querySelector('svg')).not.toBeNull()
    expect(avatar.textContent).toBe('')
    expect(screen.getByRole('button', { name: 'Assign customer' })).toBeEnabled()
  })

  test('Assign customer is disabled when assignDisabled is true', () => {
    renderCard({ customerName: null, onAssign: () => undefined, assignDisabled: true })
    expect(screen.getByRole('button', { name: 'Assign customer' })).toBeDisabled()
  })

  test('without onAssign there is no button', () => {
    renderCard({ customerName: null })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('with a customer', () => {
  test('the avatar holds the initials and no icon, and there is no Assign button', () => {
    const { container } = renderCard({ onAssign: () => undefined })
    const avatar = avatarOf(container)
    expect(avatar).toHaveAttribute('aria-hidden', 'true')
    expect(avatar.textContent).toBe('AP')
    expect(avatar.querySelector('svg')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Assign customer' })).not.toBeInTheDocument()
  })

  test('the name is plain text, not a link', () => {
    renderCard()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  test('the date line is exactly the weekday and day', () => {
    renderCard()
    expect(screen.getByText(formatWeekdayDay(DATE, 'en'))).toBeInTheDocument()
  })
})
