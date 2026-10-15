/**
 * Reading a control while a finger is down on it (GH-77, GH-102, GH-149): the one seam
 * `pressed.spec.ts` and `sales.spec.ts` press through. The pointer is always released
 * outside the control, so a press never turns into a click (it would flip a switch).
 */

import type { Page } from '@playwright/test'

export interface Look {
  transform: string
  boxShadow: string
  /** The element's own fill, or the first non-transparent ancestor's when its own is transparent. */
  fill: string
}

export interface Probe {
  look: Look
  x: number
  y: number
  covered: boolean
}

/**
 * One round trip: the first match of `selector`, optionally scrolled to the centre of the
 * view, with its transform, ring and effective resting fill, where a press on it would land,
 * and whether something else covers that point.
 */
export async function probe(page: Page, selector: string, scroll: boolean): Promise<Probe> {
  return page.locator(selector).first().evaluate((element, scrollFirst) => {
    if (scrollFirst) element.scrollIntoView({ block: 'center', inline: 'center' })
    const { transform, boxShadow } = getComputedStyle(element)
    let fill = 'rgba(0, 0, 0, 0)'
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      const own = getComputedStyle(node).backgroundColor
      if (own !== 'rgba(0, 0, 0, 0)' && own !== 'transparent') {
        fill = own
        break
      }
    }
    const box = element.getBoundingClientRect()
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    return { look: { transform, boxShadow, fill }, x, y, covered: !element.contains(document.elementFromPoint(x, y)) }
  }, scroll)
}

/**
 * The look of `selector` at rest and with the pointer down on it (moved away before the
 * release, so no click fires). A press on something that covers it is an error.
 */
export async function whilePressed(page: Page, selector: string): Promise<{ resting: Look; pressed: Look }> {
  const resting = await probe(page, selector, true)
  if (resting.covered) throw new Error(`${selector} is covered at its centre, so a press would land on something else`)
  await page.mouse.move(resting.x, resting.y)
  await page.mouse.down()
  const pressed = await probe(page, selector, false)
  await page.mouse.move(0, 0)
  await page.mouse.up()
  return { resting: resting.look, pressed: pressed.look }
}

