import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useSaleDraft } from './useSaleDraft'

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
  expect(result.current.state.lines).toEqual([{ productId: 3, quantityHundredths: 100 }])
})
