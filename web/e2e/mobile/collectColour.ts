/**
 * The colour probe: for every visible text of the loaded screen (a text node, a field's
 * value, a `::placeholder`, a `::before`/`::after` with string content) it reports the
 * text colour, the layers behind it from the root down (each `background-color` with the
 * product of the opacity of its element and its ancestors) and whether a
 * `background-image` sits in that chain. The arithmetic is `contrast.ts`'s, on the Node
 * side (`judgeContrast`); the page only reads. Exempt: a disabled control's own label
 * (its reason text is not), svg and options.
 */

import type { ColourFacts, ColourSample, Layer } from '../../src/mobile-standard/contrast.ts'
import { judgeContrast } from '../../src/mobile-standard/contrast.ts'
import type { Violation } from '../../src/mobile-standard/violation.ts'
import type { Collector } from './collect.js'

export function probeColour(): ColourFacts {
  const phone = window.__phone
  if (phone === undefined) throw new Error('the phone toolkit is not installed in this page')
  const TRANSPARENT = /^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$|^transparent$/

  const samples = new Map<string, ColourSample>()
  const add = (element: Element, color: string, extra: Layer | null, extraImage: boolean, suffix: string): void => {
    // Walk up: the opacity of an element fades its own background and everything inside it.
    const chain: Element[] = []
    for (let at: Element | null = element; at !== null; at = at.parentElement) chain.push(at)
    const cumulative: number[] = new Array<number>(chain.length).fill(1)
    let running = 1
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      const element = chain[i]
      running *= Number(element === undefined ? 1 : getComputedStyle(element).opacity)
      cumulative[i] = running
    }
    const layers: Layer[] = []
    let image = extraImage
    for (const [i, at] of [...chain.entries()].reverse()) {
      const style = getComputedStyle(at)
      if (style.backgroundImage !== 'none') image = true
      if (!TRANSPARENT.test(style.backgroundColor)) layers.push({ color: style.backgroundColor, opacity: cumulative[i] ?? 1 })
    }
    if (extra !== null) layers.push(extra)
    const sample: ColourSample = {
      raw: phone.raw(element, suffix),
      color,
      opacity: cumulative[0] ?? 1,
      layers,
      image,
    }
    samples.set(JSON.stringify(sample), sample)
  }

  const disabled = (element: Element): boolean => element.closest(':disabled, [aria-disabled="true"]') !== null
  const skipped = (element: Element): boolean =>
    element.closest('svg, option, script, style, noscript') !== null || !phone.visible(element)

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement
    if (parent === null || phone.squash(node.textContent) === '' || skipped(parent) || disabled(parent)) continue
    add(parent, getComputedStyle(parent).color, null, false, '')
  }

  for (const element of Array.from(document.querySelectorAll('input, textarea, select'))) {
    if (skipped(element) || disabled(element)) continue
    const type = element.getAttribute('type') ?? 'text'
    if (['checkbox', 'radio', 'hidden', 'range', 'file', 'submit', 'button'].includes(type)) continue
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) continue
    const placeholder = element instanceof HTMLSelectElement ? '' : element.placeholder
    if (element.value !== '') add(element, getComputedStyle(element).color, null, false, '')
    else if (placeholder !== '') {
      add(element, getComputedStyle(element, '::placeholder').color, null, false, '::placeholder')
    }
  }

  for (const element of Array.from(document.body.querySelectorAll('*'))) {
    if (skipped(element) || disabled(element)) continue
    for (const pseudo of ['::before', '::after']) {
      const style = getComputedStyle(element, pseudo)
      if (!/^"[^"]/.test(style.content)) continue
      const own: Layer | null = TRANSPARENT.test(style.backgroundColor)
        ? null
        : { color: style.backgroundColor, opacity: Number(style.opacity) }
      add(element, style.color, own, style.backgroundImage !== 'none', pseudo)
    }
  }

  const papel = getComputedStyle(document.documentElement).getPropertyValue('--papel').trim()
  if (papel === '') throw new Error('--papel is not defined: the base under every chain is unknown')
  return {
    papel,
    samples: Array.from(samples.values()),
  }
}

export const COLOUR_COLLECTOR: Collector = {
  name: 'colour',
  phase: 'loaded',
  run: async (page, cell): Promise<Violation[]> => judgeContrast(await page.evaluate(probeColour), cell),
}
