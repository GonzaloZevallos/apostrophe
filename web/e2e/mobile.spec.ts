/**
 * The phone check (GH-80): one test per size and theme, each walking every walkable
 * registry screen, loaded and then with the API held. Checkers only return `Violation`s;
 * the cell ends with one assertion that `diffOffenders` finds nothing new and nothing
 * fixed-but-listed, and with the storage check. Every non-GET/HEAD request is aborted or
 * stubbed (invariant 6); the clock is pinned on both sides (invariant 7).
 */

import { readFileSync } from 'node:fs'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { MOBILE_FACTS_FILE, MOBILE_STATE_FILE } from './env.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'
import { collect, type CellId } from './mobile/collect.js'
import { newCell, SIZES, THEMES, type Size, type Theme } from './mobile/cells.js'
import { guardWrites } from './mobile/network.js'
import { asScreen } from './mobile/states.js'
import { settle, type Facts } from './mobile/walk.js'
import { walkScreen, walkState } from './mobile/walkScreen.js'
import { STATES } from '../src/mobile-standard/allStates.ts'
import { OFFENDERS, diffOffenders } from '../src/mobile-standard/offenders/index.ts'
import { parseFacts, WALKABLE } from '../src/mobile-standard/registry.ts'
import { GETTING_IN_STATES } from '../src/mobile-standard/statesGettingIn.ts'
import type { Violation } from '../src/mobile-standard/violation.ts'

const SIGNED_OUT = { cookies: [], origins: [] } as { cookies: []; origins: [] }

function readFacts(): Facts {
  return parseFacts(JSON.parse(readFileSync(MOBILE_FACTS_FILE, 'utf-8')))
}

for (const size of SIZES) {
  for (const theme of THEMES) {
    test(`phone standard at ${size}, ${theme}`, async ({ browser }) => {
      const facts = readFacts()
      const cellOf = (screen: string): CellId => ({ screen, size: size as Size, theme: theme as Theme })
      const signedIn = await newCell(browser, size, theme, MOBILE_STATE_FILE)
      const signedOut = await newCell(browser, size, theme, SIGNED_OUT)
      await guardWrites(signedIn)
      await guardWrites(signedOut)
      const inPage = await signedIn.newPage()
      const outPage = await signedOut.newPage()
      const actual: Violation[] = []

      for (const screen of WALKABLE) {
        await test.step(screen.screen, async () => {
          const page = screen.signedOut ? outPage : inPage
          const cell = cellOf(screen.screen)
          actual.push(...(await walkScreen(page, screen, cell, false, facts)))
          actual.push(...(await walkScreen(page, screen, cell, true, facts)))
        })
      }

      // A state's starting route is a registry route already walked held; only its steps are new.
      for (const state of STATES) {
        await test.step(state.screen, async () => {
          const page = state.signedOut === true ? outPage : inPage
          actual.push(...(await walkState(page, state, cellOf(state.screen), facts)))
        })
      }

      // The first signed-in cell lands on Inicio, never Entrar (the cookie is Max-Age only).
      await inPage.goto('/')
      await settle(inPage)
      expect(new URL(inPage.url()).pathname).toBe('/')

      const own = OFFENDERS.filter((o) => o.size === size && o.theme === theme)
      expect(diffOffenders(own, actual)).toEqual({ unlisted: [], fixedButListed: [] })
      await expectOnlyTheThemeStored(inPage)
      await expectOnlyTheThemeStored(outPage)
      await signedIn.close()
      await signedOut.close()
    })
  }
}

// The harness's own rejections: the walk must record what it cannot reach, and the write
// guard must keep every write from the backend. They run in the same project as the cells.
/** What the harness could not reach: the checkers' own findings are not what these probes are about. */
function unreachable(found: Violation[]): Violation[] {
  return found.filter((v) => v.rule === 'unreachable')
}

const PROBE_SIZE: Size = '375x812'
const PROBE_CELL: CellId = { screen: 'Probe', size: PROBE_SIZE, theme: 'claro' }
const PROBE = { screen: 'Probe', route: '/ventas', path: '/sales', viewport: null, signedOut: false, theme: null }

test.describe('the walk rejects what it cannot reach', () => {
  test('a step waiting for text that does not exist is unreachable, not thrown', async ({ browser }) => {
    const context = await newCell(browser, PROBE_SIZE, 'claro', MOBILE_STATE_FILE)
    const page = await context.newPage()
    const screen = { ...PROBE, steps: [{ wait: 'texto que no existe' }] }
    expect(await walkScreen(page, screen, PROBE_CELL, false, readFacts())).toEqual([
      { ...PROBE_CELL, rule: 'unreachable', target: '' },
    ])
    await context.close()
  })

  test('a signed-in screen opened without a session is unreachable', async ({ browser }) => {
    const context = await newCell(browser, PROBE_SIZE, 'claro', SIGNED_OUT)
    const page = await context.newPage()
    const screen = { ...PROBE, steps: [] }
    expect(await walkScreen(page, screen, PROBE_CELL, false, readFacts())).toEqual([
      { ...PROBE_CELL, rule: 'unreachable', target: '' },
    ])
    await context.close()
  })

  test('a reachable screen is not reported', async ({ browser }) => {
    const context = await newCell(browser, PROBE_SIZE, 'claro', MOBILE_STATE_FILE)
    const page = await context.newPage()
    const screen = { ...PROBE, steps: [{ click: 'Semana' }] }
    expect(unreachable(await walkScreen(page, screen, PROBE_CELL, false, readFacts()))).toEqual([])
    await context.close()
  })
})

test.describe('the states the walk adds', () => {
  test('a state whose named element never shows is unreachable, not a pass', async ({ browser }) => {
    const context = await newCell(browser, PROBE_SIZE, 'claro', MOBILE_STATE_FILE)
    const page = await context.newPage()
    const screen = asScreen({ screen: 'Probe', route: '/ventas', steps: [], visible: 'texto que no existe' })
    expect(await walkScreen(page, screen, PROBE_CELL, false, readFacts())).toEqual([
      { ...PROBE_CELL, rule: 'unreachable', target: '' },
    ])
    await context.close()
  })

  test('a fill picks a select option by its label, and a click reaches an icon-only button by name', async ({
    browser,
  }) => {
    const context = await newCell(browser, PROBE_SIZE, 'claro', MOBILE_STATE_FILE)
    const page = await context.newPage()
    const screen = asScreen({
      screen: 'Probe',
      route: '/ventas/nueva',
      steps: [{ fill: { label: 'Variedad línea 1', value: 'Sir Jack' } }, { click: 'Volver' }],
      visible: '¿Descartás la venta?',
    })
    expect(unreachable(await walkScreen(page, screen, PROBE_CELL, false, readFacts()))).toEqual([])
    await context.close()
  })
})

// The geometry checkers must reject what breaks the standard, not only accept what keeps it.
const NONE = 'user-select:none;touch-action:manipulation'
const BROKEN = `
  <div style="width:2000px;height:20px"></div>
  <nav class="bar-inferior" style="position:absolute;top:5000px"><a href="#" style="display:block;height:48px">Inicio</a></nav>
  <button style="width:20px;height:20px">x</button>
  <input aria-label="Gramos" style="font-size:10px;width:200px;height:48px">
  <input aria-label="Email" style="width:200px;height:48px">
  <p style="font-size:9px">tiny</p>
  <span style="display:inline-block;width:30px;word-break:break-all">$ 999.999.999</span>
  <div style="width:80px">LarguísimoLarguísimoLarguísimoLarguísimo</div>`
const CLEAN = `
  <html style="overscroll-behavior:none"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="overscroll-behavior:none;margin:0">
  <nav class="bar-inferior" style="position:fixed;bottom:0;left:0;width:100%;${NONE}"><a href="#" style="display:block;height:48px;font-size:16px;${NONE}">Inicio</a></nav>
  <p style="font-size:16px">Hola</p></body></html>`

test.describe('the geometry checkers', () => {
  async function rulesOn(browser: Browser, html: string): Promise<string[]> {
    const context = await newCell(browser, PROBE_SIZE, 'claro', SIGNED_OUT)
    const page = await context.newPage()
    await page.setContent(html)
    const found = await collect(page, 'loaded', PROBE_CELL)
    await context.close()
    return [...new Set(found.map((v) => v.rule))].sort()
  }

  test('a page that breaks each geometry, type and input rule is reported for each', async ({ browser }) => {
    expect(await rulesOn(browser, BROKEN)).toEqual(
      [
        'autocomplete', 'chrome-at-load', 'chrome-mid-scroll', 'figure-split', 'h-scroll', 'input-font',
        'input-type', 'inputmode', 'name-overflow', 'overscroll', 'text-size', 'touch-action', 'touch-target',
        'user-select',
      ].sort(),
    )
  })

  test('a page that keeps them is not reported', async ({ browser }) => {
    expect(await rulesOn(browser, CLEAN)).toEqual([])
  })
})

test.describe('the write guard keeps every write from the backend', () => {
  async function post(page: Page, path: string): Promise<string> {
    return page.evaluate(async (target) => {
      try {
        const response = await fetch(target, { method: 'POST', body: '{}' })
        return `${response.status}`
      } catch {
        return 'aborted'
      }
    }, path)
  }

  test('a POST from the page is aborted, a stubbed one gets its stub, a GET passes', async ({ browser }) => {
    const context = await newCell(browser, PROBE_SIZE, 'claro', MOBILE_STATE_FILE)
    await guardWrites(context, [{ method: 'DELETE', path: /^\/sales\/1$/, status: 404 }])
    const reached: string[] = []
    context.on('requestfinished', (request) => {
      if (request.method() !== 'GET') reached.push(`${request.method()} ${request.url()}`)
    })
    const page = await context.newPage()
    await page.goto('/entrar')
    expect(await post(page, '/customers')).toBe('aborted')
    expect(await page.evaluate(async () => (await fetch('/sales/1', { method: 'DELETE' })).status)).toBe(404)
    expect(await page.evaluate(async () => (await fetch('/health')).status)).toBe(200)
    expect(reached.filter((entry) => !entry.includes('/sales/1'))).toEqual([])
    await context.close()
  })
})

test.describe('the getting-in states the walk visits', () => {
  for (const state of GETTING_IN_STATES) {
    test(`${state.screen} is reachable`, async ({ browser }) => {
      const context = await newCell(browser, PROBE_SIZE, 'claro', state.signedOut === true ? SIGNED_OUT : MOBILE_STATE_FILE)
      await guardWrites(context)
      const page = await context.newPage()
      const cell = { ...PROBE_CELL, screen: state.screen }
      expect(unreachable(await walkState(page, state, cell, readFacts()))).toEqual([])
      await context.close()
    })
  }

  test('a write the state does not stub is aborted, so its answer never shows', async ({ browser }) => {
    const brake = GETTING_IN_STATES.find((s) => s.screen === 'EntrarFreno')
    if (brake === undefined) throw new Error('EntrarFreno is not a state')
    const context = await newCell(browser, PROBE_SIZE, 'claro', SIGNED_OUT)
    await guardWrites(context)
    const page = await context.newPage()
    const unstubbed = { ...brake, writes: [] }
    const cell = { ...PROBE_CELL, screen: 'EntrarFreno' }
    expect(await walkState(page, unstubbed, cell, readFacts())).toEqual([{ ...cell, rule: 'unreachable', target: '' }])
    await context.close()
  })

  test('a stubbed GET lasts for its state only', async ({ browser }) => {
    const retry = GETTING_IN_STATES.find((s) => s.screen === 'EstadosReintento')
    if (retry === undefined) throw new Error('EstadosReintento is not a state')
    const context = await newCell(browser, PROBE_SIZE, 'claro', MOBILE_STATE_FILE)
    await guardWrites(context)
    const page = await context.newPage()
    await walkState(page, retry, { ...PROBE_CELL, screen: 'EstadosReintento' }, readFacts())
    await page.goto('/ventas')
    expect(await page.evaluate(async () => (await fetch('/sales', { headers: { Accept: 'application/json' } })).status)).toBe(200)
    await context.close()
  })
})

test('opening a live invitation under the write guard shows its form, not "Sin conexión"', async ({ browser }) => {
  const context = await newCell(browser, PROBE_SIZE, 'claro', SIGNED_OUT)
  await guardWrites(context)
  const page = await context.newPage()
  await page.goto(`/invitation/${readFacts()['join_token']}`)
  await settle(page)
  await expect(page.getByText('Te quedaste sin internet')).toHaveCount(0)
  await expect(page.getByLabel('Email')).toBeVisible()
  await context.close()
})
