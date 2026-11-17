// @vitest-environment node
/** `findChromeLandmarks` on small sources: what it must reject and what it must accept. */

import { describe, expect, it } from 'vitest'
import { findChromeLandmarks } from './e2eChromeLandmarks'

const spec = (text: string, path = 'phone.spec.ts') => ({ path, text })

describe('findChromeLandmarks, on inputs it must reject', () => {
  it.each([
    ["page.locator('.bar-inferior')", 'bar-inferior'],
    ["page.locator('.bar-inferior__mas')", 'bar-inferior__mas'],
    ["page.locator('a.boton-nueva-venta')", 'boton-nueva-venta'],
    ["page.locator('.boton-nueva-venta--escritorio')", 'boton-nueva-venta--escritorio'],
  ])('rejects %s (%s) in a spec', (text) => {
    expect(findChromeLandmarks([spec(text)])).toEqual(['phone.spec.ts'])
  })

  it('rejects a landmark in a comment', () => {
    expect(findChromeLandmarks([spec("// the bar is `.bar-inferior`\nawait page.reload()")])).toEqual(['phone.spec.ts'])
  })

  it('rejects a landmark in a helper other than the chrome module, and names every offender in order', () => {
    expect(
      findChromeLandmarks([
        spec('ok', 'a.spec.ts'),
        spec('x.bar-inferior', 'helpers/other.ts'),
        spec('.boton-nueva-venta', 'mobile/collectChrome.ts'),
      ]),
    ).toEqual(['helpers/other.ts', 'mobile/collectChrome.ts'])
  })
})

describe('findChromeLandmarks, on inputs it must accept', () => {
  it('accepts the chrome helper module, which holds the literals', () => {
    expect(findChromeLandmarks([spec("export const BOTTOM_BAR = '.bar-inferior'", 'helpers/chrome.ts')])).toEqual([])
  })

  it('accepts a spec that goes through the helpers', () => {
    expect(findChromeLandmarks([spec("await expect(bottomBar(page)).toBeVisible()\nawait openNewSaleFromChrome(page)")])).toEqual([])
  })

  it('accepts the computer rail, which is not bottom chrome', () => {
    expect(findChromeLandmarks([spec("page.locator('.riel-lateral')")])).toEqual([])
  })

  it('accepts no sources', () => {
    expect(findChromeLandmarks([])).toEqual([])
  })
})
