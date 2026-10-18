/**
 * WCAG 2.x contrast on computed colours, for specs that read them from the page
 * (`web/e2e/pressed.spec.ts`): the TypeScript twin of `tests/test_design_contrast.py`
 * (`relative_luminance`, `contrast_ratio`), which is the reference formula. One copy per
 * language, never a third. Pure: no browser, no DOM.
 */

export interface Colour {
  r: number
  g: number
  b: number
  /** 0 (transparent) to 1 (opaque). */
  a: number
}

/** A computed `rgb(...)` or `rgba(...)` string, in the comma or the space syntax. */
export function parseColour(computed: string): Colour {
  const found = /^rgba?\(([^)]+)\)$/.exec(computed.trim())
  if (found?.[1] === undefined) throw new Error(`not a computed colour: ${computed}`)
  const parts = found[1].split(/[\s,/]+/).filter((part) => part !== '')
  const [r, g, b, a] = parts.map((part) => (part.endsWith('%') ? Number(part.slice(0, -1)) / 100 : Number(part)))
  if (r === undefined || g === undefined || b === undefined || [r, g, b].some(Number.isNaN)) {
    throw new Error(`not a computed colour: ${computed}`)
  }
  return { r, g, b, a: a ?? 1 }
}

/**
 * `colour` shown at `opacity` (times its own alpha) over `backdrop`. The backdrop must be
 * opaque: a translucent one has no colour of its own to composite against.
 */
export function composite(colour: Colour, opacity: number, backdrop: Colour): Colour {
  if (backdrop.a !== 1) throw new Error('the backdrop must be opaque')
  const weight = colour.a * opacity
  return {
    r: colour.r * weight + backdrop.r * (1 - weight),
    g: colour.g * weight + backdrop.g * (1 - weight),
    b: colour.b * weight + backdrop.b * (1 - weight),
    a: 1,
  }
}

function channel(value: number): number {
  const unit = value / 255
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(colour: Colour): number {
  return 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b)
}

export function contrastRatio(first: Colour, second: Colour): number {
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a)
  if (light === undefined || dark === undefined) throw new Error('two colours are needed')
  return (light + 0.05) / (dark + 0.05)
}
