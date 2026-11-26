/**
 * `LineDetailSheet` at its component seam: Testing Library, rendered alone with props (no draft, no
 * router, no fetch: the component takes its line, title, Money format and callbacks). It checks the
 * phone attributes of each input, the refusals under the fields, the Gift / Special price exclusion,
 * that Done and Remove line each fire once, that Close only closes, and what makes the Sheet touched.
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import type { MoneyFormat } from '../../format/money'
import { moneyInputMode } from '../../format/parse'
import { draftLineOf, type DraftLine } from '../../sales/saleDraft'
import LineDetailSheet from './LineDetailSheet'

afterEach(cleanup)

const FORMAT: MoneyFormat = { symbol: '$', decimals: 0 }
const REFUSAL_QUANTITY = 'Enter a quantity above 0, with up to two decimals.'
const REFUSAL_SPECIAL = /^The special price must be more than/

function renderDetail(
  options: { line?: DraftLine; title?: string; computer?: boolean; format?: MoneyFormat } = {},
) {
  const { line = draftLineOf(7, 200), title = 'Rosa', computer = false, format = FORMAT } = options
  const onDone = vi.fn()
  const onRemove = vi.fn()
  const onClose = vi.fn()
  render(
    <MoneyFormatProvider format={format}>
      <LineDetailSheet
        line={line}
        title={title}
        format={format}
        onDone={onDone}
        onRemove={onRemove}
        onClose={onClose}
        computer={computer}
        computerClass="pantalla cobro-modal"
        computerDialog={computer}
      />
    </MoneyFormatProvider>,
  )
  return { onDone, onRemove, onClose }
}

const quantity = () => screen.getByRole('textbox', { name: 'Quantity' })
const special = () => screen.getByRole('textbox', { name: 'Special price' })
const gift = () => screen.getByRole('switch', { name: 'Gift' })
const done = () => screen.getByRole('button', { name: 'Done' })

async function typeQuantity(text: string) {
  await userEvent.clear(quantity())
  if (text !== '') await userEvent.type(quantity(), text)
}

describe('the frame', () => {
  test('the title is the one given, and the dialog is named by it', () => {
    renderDetail({ title: 'Rosa' })
    expect(screen.getByRole('dialog', { name: 'Rosa' })).toBeInTheDocument()
  })

  test('the shared "no longer available" text works as the title', () => {
    renderDetail({ title: 'no longer available' })
    expect(screen.getByRole('dialog', { name: 'no longer available' })).toBeInTheDocument()
  })

  test('the quantity starts as the line shows it, and Remove line is in the body', () => {
    renderDetail({ line: draftLineOf(7, 250) })
    expect(quantity()).toHaveValue('2,5')
    expect(screen.getByRole('button', { name: 'Remove line' })).toBeInTheDocument()
  })
})

describe('the phone attributes', () => {
  test('the quantity field is a decimal keyboard with autocomplete off', () => {
    renderDetail()
    expect(quantity()).toHaveAttribute('inputmode', 'decimal')
    expect(quantity()).toHaveAttribute('autocomplete', 'off')
  })

  test.each([{ symbol: '$', decimals: 0 }, { symbol: '$', decimals: 2 }])(
    'the Special price field takes its keyboard from the Money format ($decimals decimals) with autocomplete off',
    (format) => {
      renderDetail({ format })
      expect(special()).toHaveAttribute('inputmode', moneyInputMode(format))
      expect(special()).toHaveAttribute('autocomplete', 'off')
    },
  )
})

describe('Gift and Special price exclude each other', () => {
  test('a typed Special price disables Gift, and clearing it enables it again', async () => {
    renderDetail()
    await userEvent.type(special(), '500')
    expect(gift()).toBeDisabled()
    await userEvent.clear(special())
    expect(gift()).toBeEnabled()
  })

  test('Gift on empties and disables the Special price; typing one after Gift is off leaves Gift off', async () => {
    renderDetail({ line: { ...draftLineOf(7, 200), specialPrice: 500 } })
    expect(special()).toHaveValue('500')
    await userEvent.clear(special())
    await userEvent.click(gift())
    expect(gift()).toBeChecked()
    expect(special()).toHaveValue('')
    expect(special()).toBeDisabled()
    await userEvent.click(gift())
    await userEvent.type(special(), '700')
    expect(gift()).not.toBeChecked()
    expect(special()).toHaveValue('700')
  })
})

describe('the refusals', () => {
  test('a Special price of 0 is refused with its text and Done is unavailable', async () => {
    renderDetail()
    await userEvent.type(special(), '0')
    expect(screen.getByRole('alert')).toHaveTextContent(REFUSAL_SPECIAL)
    expect(done()).toBeDisabled()
  })

  test.each([
    ['empty', ''],
    ['zero', '0'],
    ['three decimals', '1,234'],
    ['14 digits', '12345678901234'],
  ])('a quantity that is %s is refused and Done is unavailable', async (_name, text) => {
    renderDetail()
    await typeQuantity(text)
    expect(screen.getByRole('alert')).toHaveTextContent(REFUSAL_QUANTITY)
    expect(done()).toBeDisabled()
  })

  test('a valid buffer shows no refusal and Done is available; fixing the field removes the refusal', async () => {
    renderDetail()
    expect(screen.queryByRole('alert')).toBeNull()
    await typeQuantity('0')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await typeQuantity('3')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(done()).toBeEnabled()
  })
})

describe('Done', () => {
  test('tapped twice it hands the parsed edit once', async () => {
    const { onDone, onRemove, onClose } = renderDetail()
    await typeQuantity('3,5')
    await userEvent.dblClick(done())
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ quantityHundredths: 350, gift: false, specialPrice: null }))
    expect(onRemove).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  test('with a Special price it hands that price', async () => {
    const { onDone } = renderDetail()
    await userEvent.type(special(), '1250')
    await userEvent.click(done())
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ gift: false, specialPrice: 1250 }))
  })

  test('with no change it hands nothing, once', async () => {
    const { onDone } = renderDetail({ line: draftLineOf(7, 200) })
    await typeQuantity('2,00')
    await userEvent.dblClick(done())
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledWith(null)
  })
})

describe('Close and Remove line', () => {
  test('Close calls only onClose and discards what was typed', async () => {
    const { onDone, onRemove, onClose } = renderDetail()
    await typeQuantity('9')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
    expect(onRemove).not.toHaveBeenCalled()
  })

  test('Remove line tapped twice calls onRemove once and nothing else', async () => {
    const { onDone, onRemove, onClose } = renderDetail()
    await userEvent.dblClick(screen.getByRole('button', { name: 'Remove line' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  test('after Remove line, Done does nothing', async () => {
    const { onDone, onRemove } = renderDetail()
    await userEvent.click(screen.getByRole('button', { name: 'Remove line' }))
    await userEvent.click(done())
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
  })
})

describe('touched, seen on the computer backdrop', () => {
  const backdrop = (): HTMLElement => {
    const main = document.querySelector('main')
    if (main === null) throw new Error('no main')
    return main
  }

  test('a backdrop click closes the untouched Sheet', async () => {
    const { onClose } = renderDetail({ computer: true })
    await userEvent.click(backdrop())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('once the buffer differs from the line the backdrop no longer closes it', async () => {
    const { onClose } = renderDetail({ computer: true })
    await typeQuantity('5')
    await userEvent.click(backdrop())
    expect(onClose).not.toHaveBeenCalled()
  })

  test('writing the line back to what it was makes it untouched again', async () => {
    const { onClose } = renderDetail({ computer: true })
    await typeQuantity('5')
    await typeQuantity('2')
    await userEvent.click(backdrop())
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
