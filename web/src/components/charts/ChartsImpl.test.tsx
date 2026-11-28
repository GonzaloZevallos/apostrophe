import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { segmentGeometry, StackedBar } from './ChartsImpl'

const stub = vi.hoisted(() => ({ incompleteProps: false }))

// Recharts always hands the shape full geometry, so to reach the shape with incomplete props the
// test swaps `Bar` for a stand-in that calls the shape with them; otherwise it is the real `Bar`.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  const RealBar = actual.Bar
  function Bar(props: { shape: (props: unknown) => ReactNode }) {
    if (stub.incompleteProps) return <svg>{props.shape({ x: '1' })}</svg>
    return <RealBar {...props} />
  }
  return { ...actual, Bar }
})

const SEGMENTS = [
  { name: 'Seeds', amount: 600, share: 10 },
  { name: 'Soil', amount: 300, share: 80 },
  { name: 'Water', amount: 100, share: 10 },
]

function drawn(onSegmentWidth?: (index: number, width: number) => void) {
  return render(<StackedBar segments={SEGMENTS} width={400} height={56} onSegmentWidth={onSegmentWidth} />)
}

test('draws one shape per segment, filled and stroked with tokens', () => {
  const { container } = drawn()
  const shapes = [...container.querySelectorAll('path')].filter((path) => path.hasAttribute('fill'))
  expect(shapes.map((shape) => shape.getAttribute('fill'))).toEqual([
    'var(--grafico1)',
    'var(--grafico2)',
    'var(--grafico3)',
  ])
  for (const shape of shapes) {
    expect(shape).toHaveAttribute('stroke', 'var(--fondo-grafico)')
    expect(Number(shape.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(1)
  }
})

test('draws no text, tooltip, legend, label, tab stop or application role', () => {
  const { container } = drawn()
  expect(container.querySelector('text')).toBeNull()
  expect(container.querySelector('.recharts-tooltip-wrapper')).toBeNull()
  expect(container.querySelector('.recharts-legend-wrapper')).toBeNull()
  expect(container.querySelector('.recharts-label')).toBeNull()
  const svg = container.querySelector('svg')
  expect(svg).not.toHaveAttribute('tabindex')
  expect(svg).not.toHaveAttribute('role', 'application')
})

test('reports each segment width once, from the amount and not from the share', () => {
  const onSegmentWidth = vi.fn()
  drawn(onSegmentWidth)
  expect(onSegmentWidth.mock.calls.map(([index]) => index).sort()).toEqual([0, 1, 2])
  const widths = new Map<number, number>(onSegmentWidth.mock.calls.map(([index, width]) => [index, width]))
  expect(widths.get(0)).toBeGreaterThan(widths.get(1) ?? Infinity)
  expect(widths.get(1)).toBeGreaterThan(widths.get(2) ?? Infinity)
})

test('segmentGeometry reads full props and refuses incomplete or non-numeric ones', () => {
  expect(segmentGeometry({ x: 1, y: 2, width: 3, height: 4, index: 0 })).toEqual({
    x: 1,
    y: 2,
    width: 3,
    height: 4,
    index: 0,
  })
  expect(segmentGeometry({ x: 1, y: 2, width: NaN, height: 4, index: 0 })).toBeNull()
  expect(segmentGeometry({ x: 1, y: 2, height: 4, index: 0 })).toBeNull()
  expect(segmentGeometry({ x: '1', y: 2, width: 3, height: 4, index: 0 })).toBeNull()
  expect(segmentGeometry(null)).toBeNull()
})

test('a shape given incomplete props draws no path and reports nothing', () => {
  stub.incompleteProps = true
  try {
    const onSegmentWidth = vi.fn()
    const { container } = drawn(onSegmentWidth)
    expect(container.querySelectorAll('path')).toHaveLength(0)
    expect(onSegmentWidth).not.toHaveBeenCalled()
  } finally {
    stub.incompleteProps = false
  }
})
