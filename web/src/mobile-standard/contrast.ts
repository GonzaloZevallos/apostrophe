/**
 * WCAG 2.x contrast arithmetic, pure: what the mobile check's in-page collector feeds
 * with the computed colours of an element and the layers behind it. No large-text
 * relaxation: `MIN_CONTRAST` is the one threshold.
 */

export const MIN_CONTRAST = 4.5

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Rgba extends Rgb {
  a: number
}

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function ratio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** `color` painted over `base`, its alpha scaled by the element's `opacity`. */
export function composite(color: Rgba, base: Rgb, opacity = 1): Rgb {
  const a = color.a * opacity
  return {
    r: color.r * a + base.r * (1 - a),
    g: color.g * a + base.g * (1 - a),
    b: color.b * a + base.b * (1 - a),
  }
}

/** A computed colour as the browser reports it (`rgb(…)`, `rgba(…)`) or a `#rrggbb` token. */
export function parseColor(text: string): Rgb | Rgba {
  const value = text.trim().toLowerCase()
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(value)
  if (hex !== null) {
    return { r: parseInt(hex[1] ?? '', 16), g: parseInt(hex[2] ?? '', 16), b: parseInt(hex[3] ?? '', 16) }
  }
  const fn = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(value)
  if (fn === null) throw new Error(`unreadable colour: ${text}`)
  const rgb = { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]) }
  const alpha = fn[4]
  if (alpha === undefined) return rgb
  return { ...rgb, a: alpha.endsWith('%') ? Number.parseFloat(alpha) / 100 : Number(alpha) }
}
