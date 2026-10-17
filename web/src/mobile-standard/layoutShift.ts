/**
 * The layout-shift tolerances and the arithmetic over one source node of a
 * `layout-shift` entry. `CONTENT_SHIFT_PX` is the one content tolerance (a 44 px target
 * plus half the 8 px gap between neighbours); chrome, the bar, the header, "+ Nueva
 * venta" and a form's fixed footer, is allowed none. The spec and both documents refer
 * to it by this name.
 */

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
