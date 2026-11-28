/**
 * The only module that imports Recharts; `load.ts` is the only one that imports this module, so
 * the library stays in its own chunk. A stacked bar drawn with shapes only: every word and figure
 * around it is HTML, never an SVG `<text>`, a Tooltip, a Legend or a Label.
 */

import { useEffect } from 'react'
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

export interface Segment {
  readonly name: string
  readonly amount: number
  readonly share: number
}

export interface SegmentGeometry {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly index: number
}

interface StackedBarProps {
  readonly segments: readonly Segment[]
  /** Reports the width Recharts drew for a segment, from its amount: never from `share`. */
  readonly onSegmentWidth?: (index: number, width: number) => void
  readonly width?: number
  readonly height?: number
}

const FILL_COUNT = 5
const SEGMENT_STROKE_WIDTH = 1

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** The geometry Recharts hands a custom shape, or `null` when any of it is missing or not a number. */
export function segmentGeometry(props: unknown): SegmentGeometry | null {
  if (typeof props !== 'object' || props === null) return null
  const x: unknown = Reflect.get(props, 'x')
  const y: unknown = Reflect.get(props, 'y')
  const width: unknown = Reflect.get(props, 'width')
  const height: unknown = Reflect.get(props, 'height')
  const index: unknown = Reflect.get(props, 'index')
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) return null
  if (typeof index !== 'number' || !Number.isInteger(index)) return null
  return { x, y, width, height, index }
}

function Piece({
  index,
  geometry,
  onSegmentWidth,
}: {
  readonly index: number
  readonly geometry: SegmentGeometry
  readonly onSegmentWidth: ((index: number, width: number) => void) | undefined
}) {
  const { x, y, width, height } = geometry
  useEffect(() => {
    onSegmentWidth?.(index, width)
  }, [index, width, onSegmentWidth])
  return (
    <path
      d={`M${x},${y}h${width}v${height}h${-width}z`}
      fill={`var(--grafico${(index % FILL_COUNT) + 1})`}
      stroke="var(--fondo-grafico)"
      strokeWidth={SEGMENT_STROKE_WIDTH}
    />
  )
}

export function StackedBar({ segments, onSegmentWidth, width, height }: StackedBarProps) {
  const row = Object.fromEntries(segments.map((segment, index) => [`s${index}`, segment.amount]))
  const chart = (
    <BarChart
      layout="vertical"
      data={[row]}
      width={width}
      height={height}
      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      accessibilityLayer={false}
    >
      <XAxis type="number" hide />
      <YAxis type="category" hide />
      {segments.map((_, index) => (
        <Bar
          key={index}
          dataKey={`s${index}`}
          stackId="total"
          isAnimationActive={false}
          shape={(props: unknown) => {
            const geometry = segmentGeometry(props)
            return geometry === null ? (
              <g />
            ) : (
              <Piece index={index} geometry={geometry} onSegmentWidth={onSegmentWidth} />
            )
          }}
        />
      ))}
    </BarChart>
  )
  if (width !== undefined && height !== undefined) return chart
  return (
    <ResponsiveContainer width="100%" height="100%">
      {chart}
    </ResponsiveContainer>
  )
}
