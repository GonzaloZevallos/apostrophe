/**
 * The layout-shift tolerances and the arithmetic over one source node of a
 * `layout-shift` entry. `CONTENT_SHIFT_PX` is the one content tolerance (a 44 px target
 * plus half the 8 px gap between neighbours); chrome, the bar, the header, "+ Nueva
 * venta" and a form's fixed footer, is allowed none. The spec and both documents refer
 * to it by this name.
 */

import { nameTargets, type CellId, type Finding, type RawTarget } from './targets.ts'
import type { Violation } from './violation.ts'

export const CONTENT_SHIFT_PX = 48
export const CHROME_SHIFT_PX = 0

/** The corner and size of a node, in CSS px, as a `layout-shift` source reports it. */
export interface BoxRect {
  top: number
  left: number
  width: number
  height: number
}

/** How far a node moved: the larger of the vertical and horizontal move of its corner. */
export function shiftOf(previous: BoxRect, current: BoxRect): number {
  return Math.max(Math.abs(current.top - previous.top), Math.abs(current.left - previous.left))
}

/** One `layout-shift` source as the page reports it. */
export interface ShiftSample {
  /** The same node across entries shares one id, so its moves are read together. */
  node: number
  /** The bar, the header, "+ Nueva venta" or a form's fixed footer: allowed `CHROME_SHIFT_PX`. */
  chrome: boolean
  previous: BoxRect
  current: BoxRect
  raw: RawTarget
}

const isEmpty = (box: BoxRect): boolean => box.width === 0 && box.height === 0

/**
 * The verdict on what moved when the data arrived: a chrome node moving more than
 * `CHROME_SHIFT_PX` is `chrome-shift`, any other more than `CONTENT_SHIFT_PX` is
 * `content-shift`. A node that was inserted or removed (an empty rect on either side) is
 * not a shift; a node that moved in several entries counts by its largest move.
 */
export function judgeShifts(samples: readonly ShiftSample[], cell: CellId): Violation[] {
  const largest = new Map<number, { sample: ShiftSample; px: number }>()
  for (const sample of samples) {
    if (isEmpty(sample.previous) || isEmpty(sample.current)) continue
    const px = shiftOf(sample.previous, sample.current)
    const seen = largest.get(sample.node)
    if (seen === undefined || px > seen.px) largest.set(sample.node, { sample, px })
  }
  const findings: Finding[] = []
  for (const { sample, px } of largest.values()) {
    if (sample.chrome && px > CHROME_SHIFT_PX) findings.push({ rule: 'chrome-shift', raw: sample.raw })
    else if (!sample.chrome && px > CONTENT_SHIFT_PX) findings.push({ rule: 'content-shift', raw: sample.raw })
  }
  return nameTargets(findings, cell)
}
