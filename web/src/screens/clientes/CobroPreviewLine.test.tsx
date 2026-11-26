import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { PaymentPreview } from '../../api/payments'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { moneyFormatter } from '../../format/money'
import CobroPreviewLine from './CobroPreviewLine'
import type { PreviewFailure, PreviewKey } from './cobroLabels'

const KEY: PreviewKey = { amount: 5, date: '2026-11-25' }
const owes: PaymentPreview = { applied_to: [], after: { balance: 123456, owing_since: '2026-10-01', standing: 'owes' } }
const settled: PaymentPreview = { applied_to: [], after: { balance: 0, owing_since: null, standing: 'settled' } }

interface Props {
  current?: PreviewKey
  key?: PreviewKey
  preview?: PaymentPreview | undefined
  failure?: PreviewFailure | null
  fetching?: boolean
}

function renderLine(props: Props = {}, decimals = 0) {
  const { current = KEY, key = KEY, preview, failure = null, fetching = false } = props
  const view = render(
    <MoneyFormatProvider format={{ symbol: '$', decimals }}>
      <CobroPreviewLine current={current} query={{ key, preview, failure, fetching }} />
    </MoneyFormatProvider>,
  )
  const wrapper = view.container.querySelectorAll('p.cobro__vista-previa')
  expect(wrapper).toHaveLength(1)
  expect(view.container.children).toHaveLength(1)
  return { view, line: wrapper[0] as HTMLElement }
}

describe('CobroPreviewLine', () => {
  test.each([0, 2])('shows the figure only for the current key, once, in the figure box (%i decimals)', (decimals) => {
    const { line } = renderLine({ preview: owes }, decimals)
    const figure = moneyFormatter({ symbol: '$', decimals }).money(123456)
    expect(line.textContent).toBe(`After this payment they still owe ${figure}. The oldest debt is paid first.`)
    const boxes = line.querySelectorAll('strong.cifra-n')
    expect(boxes).toHaveLength(1)
    expect(boxes[0]?.textContent).toBe(figure)
    expect((line.textContent ?? '').split(figure)).toHaveLength(2)
    expect(line).not.toHaveAttribute('aria-busy')
    expect(line.querySelector('[aria-label]')).toBeNull()
  })

  test('shows loading with aria-busy while the debounce is pending (the asked amount is null)', () => {
    const { line } = renderLine({ key: { amount: null, date: KEY.date }, preview: owes, fetching: false })
    expect(line).toHaveTextContent('Working out what they will still owe…')
    expect(line).toHaveAttribute('aria-busy', 'true')
    expect(line.textContent).not.toMatch(/\d|\$/)
  })

  test('shows loading, no digit, when the answer was asked for another amount or date', () => {
    for (const key of [{ amount: 4, date: KEY.date }, { amount: 5, date: '2026-11-24' }]) {
      const { line, view } = renderLine({ key, preview: owes, fetching: false })
      expect(line).toHaveAttribute('aria-busy', 'true')
      expect(line.textContent).not.toMatch(/\d|\$/)
      expect(line.querySelector('strong')).toBeNull()
      view.unmount()
    }
  })

  test('shows loading with aria-busy when the answer has not come yet, whether or not it is fetching', () => {
    for (const fetching of [true, false]) {
      const { line, view } = renderLine({ fetching })
      expect(line).toHaveTextContent('Working out what they will still owe…')
      expect(line).toHaveAttribute('aria-busy', 'true')
      view.unmount()
    }
  })

  test('a fetching refresh does not hide a current figure', () => {
    const { line } = renderLine({ preview: owes, fetching: true })
    expect(line.querySelector('strong.cifra-n')).not.toBeNull()
    expect(line).not.toHaveAttribute('aria-busy')
  })

  test('shows the failure sentence with the Attention icon and no figure', () => {
    const { line } = renderLine({ failure: 'other', preview: owes })
    expect(line).toHaveTextContent("Couldn't work out what they will still owe.")
    expect(line.textContent).not.toMatch(/\d|\$/)
    expect(line.querySelector('svg, use, .aviso-ambar__icono')).not.toBeNull()
    expect(line.querySelector('[aria-label]')).toBeNull()
    expect(line).not.toHaveAttribute('aria-busy')
  })

  test('offline shows the no-figure wording without aria-busy', () => {
    const { line } = renderLine({ failure: 'offline', preview: owes })
    expect(line).toHaveTextContent('Working out what they will still owe…')
    expect(line).not.toHaveAttribute('aria-busy')
    expect(line.textContent).not.toMatch(/\d|\$/)
  })

  test('above_balance leaves the wrapper empty', () => {
    const { line } = renderLine({ failure: 'above_balance' })
    expect(line).toBeEmptyDOMElement()
  })

  test('an out-of-date key carrying above_balance shows loading with aria-busy, not an empty line', () => {
    const { line } = renderLine({ key: { amount: 4, date: KEY.date }, failure: 'above_balance' })
    expect(line).toHaveTextContent('Working out what they will still owe…')
    expect(line).toHaveAttribute('aria-busy', 'true')
  })

  test('a null current amount leaves the wrapper empty', () => {
    const nothing = { amount: null, date: KEY.date }
    const { line } = renderLine({ current: nothing, key: nothing, preview: owes })
    expect(line).toBeEmptyDOMElement()
  })

  test('shows its own wording when nothing is owed', () => {
    const { line } = renderLine({ preview: settled })
    expect(line).toHaveTextContent('They will owe nothing after this payment.')
    expect(line.querySelector('strong')).toBeNull()
    expect(line).not.toHaveAttribute('aria-busy')
  })
})
