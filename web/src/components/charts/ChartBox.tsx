/**
 * The fixed frame a chart sits in: the same box is the loading skeleton, the Suspense fallback and
 * the frame for the chart and its sentence, so nothing moves when the chart arrives. It holds no
 * string of its own. At computer width there is no chart, so there is no box.
 */

import type { ReactNode } from 'react'
import { useViewport } from '../../shell/useViewport'

interface ChartBoxProps {
  /** Loading: marks the box busy and shows no children. */
  readonly busy?: boolean
  readonly children?: ReactNode
}

export default function ChartBox({ busy = false, children }: ChartBoxProps) {
  if (useViewport() === 'computer') return null
  return (
    <div
      aria-busy={busy ? 'true' : undefined}
      style={{ blockSize: 'var(--alto-grafico-barra)', background: 'var(--fondo-grafico)' }}
    >
      {busy ? null : children}
    </div>
  )
}
