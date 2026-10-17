// Text at a larger size in a design capture (GH-224, ADR-0042 amendment). Design tooling only:
// nothing under `app/` or `web/src` reads, sets or branches on this scale.
//
// This is the SECOND copy of one model. The first is `web/e2e/helpers/textScale.ts` (GH-104),
// a gate helper that five specs use and that is not edited here. `web/src/design/textScale.test.ts`
// ties `TEXT_SCALE` and `TOLERANCE` between the two files; drift in the scaling rule beyond
// those two constants is a stated, accepted risk (read that file's header for the model).
//
// The model: Chromium has no switch that scales text without shrinking the CSS viewport, and
// the type scale is in px, so the page is scaled itself. `<html>` and every element under
// `<body>` is tagged `data-fit`, with its baseline `font-size` and px `line-height` kept in
// `data-fit-font` and `data-fit-line`, and one injected stylesheet sets each one's
// `font-size` to baseline × factor (`!important`). A computed px `line-height` is scaled by
// the same factor; `normal` is left alone. Pseudo-elements and px-sized SVG icons are not
// scaled, and media queries still read the CSS viewport width.
//
// The two functions `applyInPage` and `gatherInPage` run in the browser (`page.evaluate`
// serialises them), so each is self-contained. `unscaled` is pure and is the seam the tests
// exercise: jsdom computes no font from a stylesheet, so they feed it records, not a DOM.

/** The one text scale a capture asks for ("130 %"). `screens.mjs` validates against it. */
export const TEXT_SCALE = 1.3
/** Sub-pixel layout rounds; a size is off by pixels, not by a fraction of one. */
export const TOLERANCE = 0.5

/**
 * In the page: undo an earlier scale, tag `<html>` and every element under `<body>`, and
 * inject the stylesheet. Returns how many elements it tagged.
 */
export function applyInPage({ factor }) {
  document.querySelectorAll('style[data-fit-style]').forEach((style) => style.remove())
  document.querySelectorAll('[data-fit]').forEach((element) => {
    element.removeAttribute('data-fit')
    element.removeAttribute('data-fit-font')
    element.removeAttribute('data-fit-line')
  })
  const elements = [document.documentElement, ...document.body.querySelectorAll('*')]
  const rules = []
  elements.forEach((element, index) => {
    const style = getComputedStyle(element)
    const baseline = parseFloat(style.fontSize)
    const lineHeight = parseFloat(style.lineHeight)
    const tag = `fit-${index}`
    element.setAttribute('data-fit', tag)
    element.setAttribute('data-fit-font', String(baseline))
    if (!Number.isNaN(lineHeight)) element.setAttribute('data-fit-line', String(lineHeight))
    const line = Number.isNaN(lineHeight) ? '' : ` line-height: ${lineHeight * factor}px !important;`
    rules.push(`[data-fit="${tag}"] { font-size: ${baseline * factor}px !important;${line} }`)
  })
  const sheet = document.createElement('style')
  sheet.setAttribute('data-fit-style', '')
  sheet.textContent = rules.join('\n')
  document.head.appendChild(sheet)
  return elements.length
}

/**
 * In the page: one plain record per element of `<html>` and `<body>`'s subtree, read now.
 * `tagged` is false for an element mounted after `applyInPage` ran.
 */
export function gatherInPage() {
  const elements = [document.documentElement, ...document.body.querySelectorAll('*')]
  const px = (value) => {
    const number = parseFloat(value)
    return Number.isNaN(number) ? null : number
  }
  return elements.map((element) => {
    const style = getComputedStyle(element)
    const tagged = element.hasAttribute('data-fit')
    return {
      tagged,
      baselineFontPx: tagged ? px(element.getAttribute('data-fit-font')) ?? 0 : 0,
      fontPx: parseFloat(style.fontSize),
      baselineLineHeightPx: tagged ? px(element.getAttribute('data-fit-line') ?? '') : null,
      lineHeightPx: px(style.lineHeight),
    }
  })
}

/**
 * The records that do not read baseline × `factor`: an element that was never tagged, a font
 * size off by more than `tolerance`, or a px line-height off by more than `tolerance`. A
 * `normal` line-height (no px baseline) is left alone. No records at all is one miss, since
 * verifying zero elements proves nothing.
 */
export function unscaled(records, factor, tolerance) {
  if (records.length === 0) return [{ index: -1, kind: 'none' }]
  const misses = []
  records.forEach((record, index) => {
    if (!record.tagged) {
      misses.push({ index, kind: 'untagged' })
      return
    }
    if (Math.abs(record.fontPx - record.baselineFontPx * factor) > tolerance) {
      misses.push({ index, kind: 'font-size' })
      return
    }
    if (record.baselineLineHeightPx === null) return
    if (record.lineHeightPx === null || Math.abs(record.lineHeightPx - record.baselineLineHeightPx * factor) > tolerance) {
      misses.push({ index, kind: 'line-height' })
    }
  })
  return misses
}
