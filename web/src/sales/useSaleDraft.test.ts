import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import { lineEditOf } from './saleDraft'
import { useSaleDraft } from './useSaleDraft'

const FORMAT = { symbol: '$', decimals: 0 }

test('rerendering with another today keeps openedOn and date, and the dispatchers drive the reducer', () => {
  const { result, rerender } = renderHook((props: { today: string }) => useSaleDraft(props), {
    initialProps: { today: '2026-11-19' },
  })
  act(() => {
    result.current.addProduct(3)
    result.current.setDate('2026-11-01')
  })
  rerender({ today: '2026-11-20' })
  expect(result.current.state.openedOn).toBe('2026-11-19')
  expect(result.current.state.date).toBe('2026-11-01')
  expect(result.current.state.lines).toEqual([{ productId: 3, quantityHundredths: 100, gift: false, specialPrice: null }])
})

test('setDate reads the Business today at call time: tomorrow is refused, then accepted once today moves, and openedOn stays', () => {
  const { result, rerender } = renderHook((props: { today: string }) => useSaleDraft(props), {
    initialProps: { today: '2026-11-19' },
  })
  act(() => result.current.setDate('2026-11-20'))
  expect(result.current.state.date).toBe('2026-11-19')
  rerender({ today: '2026-11-20' })
  act(() => result.current.setDate('2026-11-20'))
  expect(result.current.state.date).toBe('2026-11-20')
  expect(result.current.state.openedOn).toBe('2026-11-19')
})

test('setDate refuses an impossible or malformed date and keeps the last valid one', () => {
  const { result } = renderHook(() => useSaleDraft({ today: '2026-11-19' }))
  act(() => result.current.setDate('2026-02-30'))
  act(() => result.current.setDate(''))
  expect(result.current.state.date).toBe('2026-11-19')
})

test('editLine takes the edit lineEditOf returned and removeLine takes the line out', () => {
  const { result } = renderHook(() => useSaleDraft({ today: '2026-11-19' }))
  act(() => {
    result.current.addProduct(3)
    result.current.addProduct(4)
  })
  const gift = lineEditOf({ quantityText: '2', gift: true, specialText: '' }, FORMAT)
  const special = lineEditOf({ quantityText: '1,5', gift: false, specialText: '500' }, FORMAT)
  if (!gift.ok || !special.ok) throw new Error('expected both edits')
  act(() => {
    result.current.editLine(3, gift.edit)
    result.current.editLine(4, special.edit)
  })
  expect(result.current.state.lines).toEqual([
    { productId: 3, quantityHundredths: 200, gift: true, specialPrice: null },
    { productId: 4, quantityHundredths: 150, gift: false, specialPrice: 500 },
  ])
  act(() => result.current.removeLine(3))
  expect(result.current.state.lines.map((line) => line.productId)).toEqual([4])
  act(() => result.current.removeLine(9))
  expect(result.current.state.lines.map((line) => line.productId)).toEqual([4])
})

test('today is exposed, and follows the argument on re-render', () => {
  const { result, rerender } = renderHook((props: { today: string }) => useSaleDraft(props), {
    initialProps: { today: '2026-11-19' },
  })
  expect(result.current.today).toBe('2026-11-19')
  rerender({ today: '2026-11-20' })
  expect(result.current.today).toBe('2026-11-20')
})
