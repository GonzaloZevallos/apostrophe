/**
 * Text at a larger size in a real browser page (GH-104), shared by every e2e spec that measures
 * layout with scaled text.
 *
 * Chromium has no switch that scales text without also shrinking the CSS viewport, and the type
 * scale is set in px (`tokens.css`), so changing the root's font size would scale almost
 * nothing. So the page is scaled itself: every element under the root, and `<html>`, is tagged
 * `data-fit`, and one injected stylesheet sets each one's `font-size` to its computed baseline
 * times the factor (`!important`). A computed px `line-height` is scaled by the same factor
 * (`normal` is left alone). What follows:
 *  - `<html>` is scaled, so rem lengths follow (`flex: 1 1 10rem`);
 *  - em lengths follow each element's own new font size.
 *
 * Known gaps. This models larger text; it does not claim to equal any browser's own setting.
 *  - Pseudo-elements are not reached. `.capa::before`, `.cliente-sheet::before` and
 *    `.variedad-nueva::before` were read in `app.css`: each draws only a `content: ''` scrim,
 *    no text, so nothing is lost there.
 *  - px-sized SVG icons are not scaled.
 *  - Media queries are not moved: they still read the CSS viewport width.
 *
 * Two ways in.
 *  - `expectNoSidewaysOverflow` and `expectThumbSized` are the atomic API, for screens that
 *    re-render: each asserts a coarse pointer, refuses a root that still shows the loading
 *    marker, applies the scaling, checks that every element took it and measures, all in one
 *    `page.evaluate`, so nothing can re-render between the scaling and the measurement.
 *  - `applyTextScale` followed by `expectTextScaled` may be called separately ONLY for a
 *    surface that never re-renders between the two calls (`barFit`'s bar and rail). A React
 *    re-render in between would leave new, unscaled elements in a measurement that says scaled.
 *
 * A scale of 1 injects nothing: the measurement reads the page as it is.
 */

import { expect, type Page } from '@playwright/test'

/** The text scale the sales sweep asks for ("130 %"). */
export const TEXT_SCALE = 1.3
/** Sub-pixel layout rounds; a size is off by pixels, not by a fraction of one. */
export const TOLERANCE = 0.5
/** What a spec's `test.use` and every context it creates by hand pass: a phone with a touch screen. */
export const PHONE_CONTEXT = { isMobile: true, hasTouch: true }

const TOUCH_TARGET = 44
const MIN_INPUT_FONT = 16
/** Float noise only: 16 × 1.3 is not exactly what the browser resolves. */
const FLOAT_EPSILON = 0.01
/** What is on screen only while something is loading: the skeleton, the compact marker, the announcer. */
export const LOADING_MARKER = '.cargando, .cargando__anuncio'

export interface Scaled {
  tag: string
  baseline: number
  scaled: number
}

type Kind = 'apply' | 'overflow' | 'thumb' | 'pointer'

interface BrowserArgs {
  kind: Kind
  root: string
  factor: number
  tolerance: number
  target: number
  font: number
  epsilon: number
  loadingMarker: string
  coarseProbeCss: string
}

interface BrowserResult {
  coarse: boolean
  loading: string[]
  /** Elements that do not read baseline × factor, as `tag.class`. */
  uncovered: string[]
  scaled: Scaled[]
  overflow: { page: number; out: string[] }
  small: string[]
}

/**
 * Whether the page's primary pointer is coarse, read from a probe element a `(pointer: coarse)`
 * media rule widens. It asks the same media feature `matchMedia` would, through the stylesheet,
 * because `routes.test.ts` reserves a `matchMedia(` call to `useViewport.ts` and scans `e2e/` too.
 */
const COARSE_PROBE_CSS =
  '[data-pointer-probe] { position: absolute; visibility: hidden; width: 1px; } ' +
  '@media (pointer: coarse) { [data-pointer-probe] { width: 7px; } }'

/** One pass in the page: guards, scaling, coverage, measurement. Everything it needs is inside it. */
async function inBrowser(page: Page, args: BrowserArgs): Promise<BrowserResult> {
  return page.evaluate((a): BrowserResult => {
    const coarsePointer = (): boolean => {
      const probeStyle = document.createElement('style')
      probeStyle.textContent = a.coarseProbeCss
      const probe = document.createElement('div')
      probe.setAttribute('data-pointer-probe', '')
      document.head.appendChild(probeStyle)
      document.body.appendChild(probe)
      const coarse = parseFloat(getComputedStyle(probe).width) > 1
      probe.remove()
      probeStyle.remove()
      return coarse
    }
    const result: BrowserResult = {
      coarse: coarsePointer(),
      loading: [],
      uncovered: [],
      scaled: [],
      overflow: { page: 0, out: [] },
      small: [],
    }
    const name = (node: Element): string => `${node.tagName.toLowerCase()}.${node.getAttribute('class') ?? ''}`
    const root = document.querySelector(a.root)
    if (root === null) throw new Error(`no ${a.root}`)

    if (a.kind === 'pointer') return result
    if (a.kind !== 'apply') {
      if (!result.coarse) return result
      result.loading = [...root.querySelectorAll(a.loadingMarker)].map(name)
      if (result.loading.length > 0) return result
    }

    // A scale from an earlier call is undone first, so the baseline is the real one.
    document.querySelectorAll('style[data-fit-style]').forEach((style) => style.remove())
    document.querySelectorAll('[data-fit]').forEach((element) => element.removeAttribute('data-fit'))

    if (a.factor !== 1) {
      const elements = [document.documentElement, ...root.querySelectorAll('*')]
      const rules: string[] = []
      const tagged: Element[] = []
      elements.forEach((element, index) => {
        const style = getComputedStyle(element)
        const baseline = parseFloat(style.fontSize)
        const scaled = baseline * a.factor
        const tag = `fit-${index}`
        element.setAttribute('data-fit', tag)
        const lineHeight = parseFloat(style.lineHeight)
        const line = Number.isNaN(lineHeight) ? '' : ` line-height: ${lineHeight * a.factor}px !important;`
        rules.push(`[data-fit="${tag}"] { font-size: ${scaled}px !important;${line} }`)
        result.scaled.push({ tag, baseline, scaled })
        tagged.push(element)
      })
      const sheet = document.createElement('style')
      sheet.setAttribute('data-fit-style', '')
      sheet.textContent = rules.join('\n')
      document.head.appendChild(sheet)

      if (a.kind !== 'apply') {
        result.scaled.forEach((entry, index) => {
          const element = tagged[index]
          if (element === undefined) return
          const actual = parseFloat(getComputedStyle(element).fontSize)
          if (Math.abs(actual - entry.scaled) > a.tolerance) result.uncovered.push(name(element))
        })
      }
    }

    if (a.kind === 'overflow') {
      const width = document.documentElement.clientWidth
      result.overflow = {
        page: document.documentElement.scrollWidth - width,
        out: [...document.querySelectorAll('main *')]
          .filter((node) => node.closest('.cargando__anuncio') === null)
          .filter((node) => node.getBoundingClientRect().right > width + 0.5)
          .map((node) => `${node.tagName}.${node.className}`),
      }
    }

    if (a.kind === 'thumb') {
      const floor = a.font * a.factor
      // Float noise only matters once the floor is a product; the unscaled floor is exactly 16.
      const slack = a.factor === 1 ? 0 : a.epsilon
      const controls = document.querySelectorAll(
        'button, a[href], [role="radio"], [role="switch"], input:not([type="checkbox"]):not([type="radio"]), select, textarea',
      )
      for (const node of controls) {
        const rect = node.getBoundingClientRect()
        if (rect.width <= 1 || rect.height <= 1) continue
        const label = `${node.tagName} ${node.getAttribute('aria-label') ?? node.textContent?.slice(0, 24) ?? ''}`
        if (rect.height < a.target - 0.5) result.small.push(`${label}: ${Math.round(rect.height)} px tall`)
        if (/^(INPUT|SELECT|TEXTAREA)$/.test(node.tagName) && parseFloat(getComputedStyle(node).fontSize) < floor - slack) {
          result.small.push(`${label}: font under ${floor}`)
        }
      }
    }
    return result
  }, args)
}

function argsFor(kind: Kind, root: string, factor: number): BrowserArgs {
  return {
    kind,
    root,
    factor,
    tolerance: TOLERANCE,
    target: TOUCH_TARGET,
    font: MIN_INPUT_FONT,
    epsilon: FLOAT_EPSILON,
    loadingMarker: LOADING_MARKER,
    coarseProbeCss: COARSE_PROBE_CSS,
  }
}

/**
 * Scales every element under `root`, and `<html>`, by `factor` and returns what it did. Direct
 * use is only for a surface that never re-renders before `expectTextScaled` and the measurement.
 */
export async function applyTextScale(page: Page, root: string, factor: number): Promise<Scaled[]> {
  return (await inBrowser(page, argsFor('apply', root, factor))).scaled
}

/** The scaling took: the list is not empty and every element reads baseline × factor. */
export async function expectTextScaled(page: Page, scaled: Scaled[], factor: number): Promise<void> {
  expect(scaled.length).toBeGreaterThan(0)
  const actual = await page.evaluate(
    (tags) =>
      tags.map((tag) => {
        const element = document.querySelector(`[data-fit="${tag}"]`)
        if (element === null) return null
        return { name: `${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''}`, size: parseFloat(getComputedStyle(element).fontSize) }
      }),
    scaled.map((entry) => entry.tag),
  )
  const off = scaled.flatMap((entry, index) => {
    const read = actual[index]
    if (read === null || read === undefined) return [`${entry.tag}: gone`]
    return Math.abs(read.size - entry.baseline * factor) > TOLERANCE
      ? [`${read.name}: ${read.size} px, expected ${entry.baseline * factor}`]
      : []
  })
  expect(off, 'font-size of the scaled elements').toEqual([])
}

/** The guards every atomic measurement shares, read from one pass. */
function expectSound(result: BrowserResult, where: string, factor: number): void {
  expect(result.coarse, `${where}: the page must have a coarse pointer (a phone context)`).toBe(true)
  expect(result.loading, `${where}: still loading`).toEqual([])
  expect(result.uncovered, `${where}: elements not at baseline × ${factor}`).toEqual([])
}

/** The page asks for a coarse pointer, for a surface measured through `applyTextScale`. */
export async function expectCoarsePointer(page: Page, where: string): Promise<void> {
  const { coarse } = await inBrowser(page, argsFor('pointer', 'body', 1))
  expect(coarse, `${where}: the page must have a coarse pointer (a phone context)`).toBe(true)
}

/** No element of `main` reaches past the viewport's right edge, with the text at `scale`. */
export async function expectNoSidewaysOverflow(page: Page, where: string, scale: number): Promise<void> {
  const result = await inBrowser(page, argsFor('overflow', 'body', scale))
  expectSound(result, where, scale)
  expect(result.overflow, `${where}: overflow`).toEqual({ page: 0, out: [] })
}

/**
 * Every visible control (button, link, radio, field) at least 44 px tall (never scaled), and
 * every field's text at least 16 px × `scale`. Hidden announcers and a native control a styled
 * switch stands in for are left out: they are not what a thumb lands on.
 */
export async function expectThumbSized(page: Page, where: string, scale: number): Promise<void> {
  const result = await inBrowser(page, argsFor('thumb', 'body', scale))
  expectSound(result, where, scale)
  expect(result.small, `${where}: small controls`).toEqual([])
}
