/**
 * The phone check (GH-80): one test per size and theme, each walking every walkable
 * registry screen, loaded and then with the API held. Checkers only return `Violation`s;
 * the cell ends with one assertion that `diffOffenders` finds nothing new and nothing
 * fixed-but-listed, and with the storage check. Every non-GET/HEAD request is aborted or
 * stubbed (invariant 6); the clock is pinned on both sides (invariant 7).
 */

import { readFileSync } from 'node:fs'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { MOBILE_FACTS_FILE, MOBILE_STATE_FILE, mobileLanguage } from './env.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'
import { collect, GEOMETRY_COLLECTOR, type CellId } from './mobile/collect.js'
import { COLOUR_COLLECTOR } from './mobile/collectColour.js'
import { LOADING_COLLECTOR, SHIFT_COLLECTOR } from './mobile/collectLoading.js'
import { newCell, SIZES, THEMES, type Size, type Theme } from './mobile/cells.js'
import { guardWrites } from './mobile/network.js'
import { asScreen } from './mobile/states.js'
import { settle, type Facts } from './mobile/walk.js'
import { walkPending } from './mobile/walkPending.js'
import { walkScreen, walkState } from './mobile/walkScreen.js'
import { CUSTOMERS, HOME, INVITATION, LOGIN, pathTo, SALE, SALE_NEW, SALES } from '../src/routes.ts'
import { STATES } from '../src/mobile-standard/allStates.ts'
import { PENDING_TAPS } from '../src/mobile-standard/pending.ts'
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

      for (const tap of PENDING_TAPS) {
        await test.step(`${tap.screen} pending`, async () => {
          const page = tap.signedOut === true ? outPage : inPage
          actual.push(...(await walkPending(page, tap, cellOf(tap.screen), facts)))
        })
      }

      // The first signed-in cell lands on Inicio, never Entrar (the cookie is Max-Age only).
      await inPage.goto(HOME)
      await settle(inPage)
      expect(new URL(inPage.url()).pathname).toBe(HOME)
      // Home on the phone shows at most one visible brand element: the mark in its header,
      // never the rail's lockup (display: none on a phone), which the accessibility tree skips.
      const inMain = await inPage.getByRole('main').getByRole('img', { name: 'apostrophe' }).count()
      const inRail = await inPage.getByRole('navigation').getByRole('img', { name: 'apostrophe' }).count()
      expect(inMain + inRail).toBeLessThanOrEqual(1)

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

const SALE_ONE = pathTo(SALE, { id: 1 })
const PROBE_SIZE: Size = '375x812'
const PROBE_CELL: CellId = { screen: 'Probe', size: PROBE_SIZE, theme: 'claro' }
const PROBE = { screen: 'Probe', route: SALES, path: SALES, viewport: null, signedOut: false, theme: null }

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
    const screen = { ...PROBE, steps: [{ click: 'Week' }] }
    expect(unreachable(await walkScreen(page, screen, PROBE_CELL, false, readFacts()))).toEqual([])
    await context.close()
  })
})

test.describe('the states the walk adds', () => {
  test('a state whose named element never shows is unreachable, not a pass', async ({ browser }) => {
    const context = await newCell(browser, PROBE_SIZE, 'claro', MOBILE_STATE_FILE)
    const page = await context.newPage()
    const screen = asScreen({ screen: 'Probe', route: SALES, steps: [], visible: 'texto que no existe' })
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
      route: SALE_NEW,
      steps: [{ fill: { label: 'Line 1 variety', value: 'Sir Jack' } }, { press: 'Close' }],
      visible: 'Discard the sale?',
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
  async function violationsOn(browser: Browser, html: string): Promise<Violation[]> {
    const context = await newCell(browser, PROBE_SIZE, 'claro', SIGNED_OUT)
    const page = await context.newPage()
    await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1">${html}`)
    const found = await collect(page, 'loaded', PROBE_CELL, [GEOMETRY_COLLECTOR])
    await context.close()
    return found
  }
  async function rulesOn(browser: Browser, html: string): Promise<string[]> {
    return [...new Set((await violationsOn(browser, html)).map((v) => v.rule))].sort()
  }
  const targetsOf = (found: Violation[], rule: string): string[] =>
    found.filter((v) => v.rule === rule).map((v) => v.target)

  test('a page that breaks each geometry, type and input rule is reported for each', async ({ browser }) => {
    expect(await rulesOn(browser, BROKEN)).toEqual(
      [
        'autocomplete', 'chrome-at-load', 'chrome-mid-scroll', 'figure-split', 'h-scroll', 'input-font',
        'input-type', 'inputmode', 'name-overflow', 'overscroll', 'tabular-figures', 'text-size', 'touch-action',
        'touch-target', 'user-select',
      ].sort(),
    )
  })

  test('a figure is reported unless its element draws tabular digits; sentences and dates are not figures', async ({ browser }) => {
    const found = await violationsOn(
      browser,
      `<p>$ 11.000</p>
       <p style="font-variant-numeric:tabular-nums">$ 22.000</p>
       <p>12 days</p>
       <p>Sold $ 33.000 today</p>
       <p>30/10</p>
       <p>and 3 g without cost</p>`,
    )
    expect(targetsOf(found, 'tabular-figures')).toEqual(['p:$ #.#', 'p:# days'])
  })

  test('identical offenders with no identity are one Violation each, by position', async ({ browser }) => {
    const found = await violationsOn(
      browser,
      '<button style="width:20px;height:20px">x</button><button style="width:20px;height:20px">x</button><button style="width:20px;height:20px">x</button>',
    )
    expect(targetsOf(found, 'touch-target')).toEqual(['button:x[1]', 'button:x[2]', 'button:x[3]'])
  })

  test('identical offenders under different identified ancestors take the ancestor as identity', async ({ browser }) => {
    const found = await violationsOn(
      browser,
      `<div data-testid="uno"><button style="width:20px;height:20px">x</button></div>
       <div data-testid="dos"><button style="width:20px;height:20px">x</button></div>`,
    )
    expect(targetsOf(found, 'touch-target')).toEqual(['button:x@uno', 'button:x@dos'])
  })

  test('a lone offender keeps its plain name, and two under one identity are told apart by position', async ({ browser }) => {
    const found = await violationsOn(
      browser,
      `<button style="width:20px;height:20px">solo</button>
       <div data-testid="fila"><button style="width:20px;height:20px">x</button><button style="width:20px;height:20px">x</button></div>`,
    )
    expect(targetsOf(found, 'touch-target')).toEqual(['button:solo', 'button:x@fila[1]', 'button:x@fila[2]'])
  })

  test('a select whose options look like money is not a typed field', async ({ browser }) => {
    const found = await violationsOn(
      browser,
      `<label style="display:block">Categoría
         <select autocomplete="off" style="font-size:16px;width:200px;height:48px"><option>Precio en $ del envío</option><option>Gramos</option></select>
       </label>
       <label style="display:block">Monto <input autocomplete="off" style="font-size:16px;width:200px;height:48px"></label>`,
    )
    expect(targetsOf(found, 'inputmode')).toEqual(['textbox:Monto'])
    expect(targetsOf(found, 'input-type')).toEqual([])
  })

  test('a current-password field is expected to say current-password, and a new one new-password', async ({ browser }) => {
    const field = (label: string, autocomplete: string | null): string =>
      `<label style="display:block">${label}
         <input type="password" ${autocomplete === null ? '' : `autocomplete="${autocomplete}"`} style="font-size:16px;width:200px;height:48px">
       </label>`
    const wrongOnes = await violationsOn(
      browser,
      field('Current password', 'new-password') + field('New password', 'current-password') + field('Current password', null),
    )
    expect(targetsOf(wrongOnes, 'autocomplete')).toEqual([
      'textbox:Current password[1]',
      'textbox:New password',
      'textbox:Current password[2]',
    ])
    const rightOnes = await violationsOn(
      browser,
      field('Current password', 'current-password') + field('New password', 'new-password'),
    )
    expect(targetsOf(rightOnes, 'autocomplete')).toEqual([])
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
    await page.goto(LOGIN)
    expect(await post(page, CUSTOMERS)).toBe('aborted')
    expect(await page.evaluate(async (target) => (await fetch(target, { method: 'DELETE' })).status, SALE_ONE)).toBe(404)
    expect(await page.evaluate(async () => (await fetch('/health')).status)).toBe(200)
    expect(reached.filter((entry) => !entry.includes(SALE_ONE))).toEqual([])
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
    await page.goto(SALES)
    expect(await page.evaluate(async () => (await fetch('/sales', { headers: { Accept: 'application/json' } })).status)).toBe(200)
    await context.close()
  })
})

test('opening a live invitation under the write guard shows its form, not "Sin conexión"', async ({ browser }) => {
  const context = await newCell(browser, PROBE_SIZE, 'claro', SIGNED_OUT)
  await guardWrites(context)
  const page = await context.newPage()
  await page.goto(INVITATION.replace(':token', String(readFacts()['join_token'])))
  await settle(page)
  await expect(page.getByText('Te quedaste sin internet')).toHaveCount(0)
  await expect(page.getByLabel('Email address')).toBeVisible()
  await context.close()
})

// The colour, loading and shift checkers must reject what breaks the standard, not only accept what keeps it.
test.describe('the colour, loading and shift checkers', () => {
  const COLLECTOR = { loaded: COLOUR_COLLECTOR, loading: LOADING_COLLECTOR, released: SHIFT_COLLECTOR }
  async function onPage(
    browser: Browser,
    html: string,
    phase: 'loaded' | 'loading' | 'released',
    lang: string = mobileLanguage(),
  ): Promise<Violation[]> {
    const context = await newCell(browser, PROBE_SIZE, 'claro', SIGNED_OUT)
    const page = await context.newPage()
    await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1">${html}`)
    await page.evaluate((lang) => document.documentElement.setAttribute('lang', lang), lang)
    const found = await collect(page, phase, PROBE_CELL, [COLLECTOR[phase]])
    await context.close()
    return found
  }
  const rulesOf = (found: Violation[]): string[] => [...new Set(found.map((v) => v.rule))].sort()

  test('a faint text, a faint placeholder and a text over a picture are each reported, a legible one is not', async ({ browser }) => {
    const found = await onPage(
      browser,
      `<style>:root{--papel:#fcfbf8}input::placeholder{color:#ccc}</style><p style="color:#bbb;font-size:16px">Gris claro</p>
       <input aria-label="Buscar" placeholder="Buscá" style="font-size:16px;width:200px;height:48px;color:#000">
       <div style="background-image:linear-gradient(#000,#fff)"><p style="font-size:16px">Sobre un degradado</p></div>
       <p style="color:#1a1815;font-size:16px">Legible</p>`,
      'loaded',
    )
    expect(rulesOf(found)).toEqual(['contrast', 'contrast-unprovable'])
    expect(found.filter((v) => v.rule === 'contrast').map((v) => v.target)).toEqual(['p:Gris claro', 'textbox:Buscar::placeholder'])
    expect(found.filter((v) => v.rule === 'contrast-unprovable').map((v) => v.target)).toEqual(['p:Sobre un degradado'])
  })

  test('a faint text under an inert layer is not reported, the same faint text outside it is', async ({ browser }) => {
    const found = await onPage(
      browser,
      `<style>:root{--papel:#fcfbf8}</style><div inert><p style="color:#bbb;font-size:16px">Gris tapado</p></div>
       <p style="color:#bbb;font-size:16px">Gris a la vista</p>`,
      'loaded',
    )
    expect(found.filter((v) => v.rule === 'contrast').map((v) => v.target)).toEqual(['p:Gris a la vista'])
  })

  test('a disabled control keeps its label out of the ratio, its reason does not', async ({ browser }) => {
    const found = await onPage(
      browser,
      `<style>:root{--papel:#fcfbf8}</style><button disabled style="color:#bbb;font-size:16px">Guardar</button><span style="color:#bbb;font-size:16px">Falta el monto</span>`,
      'loaded',
    )
    expect(found.map((v) => v.target)).toEqual(['span:Falta el monto'])
  })

  test('a loading screen with no content area, no aria-busy, an empty-state wording and a figure is reported for each', async ({ browser }) => {
    const found = await onPage(browser, '<p>Nobody owes you.</p>', 'loading')
    expect(rulesOf(found)).toEqual(['aria-busy', 'blank-while-loading', 'false-empty'])
    const busy = await onPage(
      browser,
      '<main aria-busy="true"><span style="display:block;width:100px;height:20px;background:#ccc"></span><p>$ 0</p></main>',
      'loading',
    )
    expect(rulesOf(busy)).toEqual(['data-while-loading'])
    const clean = await onPage(
      browser,
      '<main><div aria-busy="true" role="progressbar" style="width:100px;height:20px;background:#ccc"></div></main>',
      'loading',
    )
    expect(clean).toEqual([])
  })

  test('a loading page whose lang is not the run’s fails with the language reason, not as a violation', async ({ browser }) => {
    const wrong = mobileLanguage() === 'en' ? 'en-XA' : 'en'
    await expect(onPage(browser, '<main aria-busy="true"><p>Cargando</p></main>', 'loading', wrong)).rejects.toThrow(
      `page lang ${wrong}, run locale ${mobileLanguage()}`,
    )
  })

  test('chrome that moves is reported at any distance, content only beyond the tolerance', async ({ browser }) => {
    const context = await newCell(browser, PROBE_SIZE, 'claro', SIGNED_OUT)
    const page = await context.newPage()
    await page.setContent(
      `<div id="above" style="height:10px"></div>
       <nav class="bar-inferior" style="height:48px">Inicio</nav>
       <div style="height:48px">Cerca</div><div style="height:48px">Lejos</div>`,
    )
    await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
    await page.evaluate(() => {
      const above = document.getElementById('above')
      if (above !== null) above.style.height = '50px'
    })
    const found = await collect(page, 'released', PROBE_CELL, [SHIFT_COLLECTOR])
    expect(found.filter((v) => v.rule === 'chrome-shift').map((v) => v.target)).toEqual(['navigation:Inicio'])
    expect(found.filter((v) => v.rule === 'content-shift')).toEqual([])
    await page.evaluate(() => {
      const above = document.getElementById('above')
      if (above !== null) above.style.height = '170px'
    })
    expect(rulesOf(await collect(page, 'released', PROBE_CELL, [SHIFT_COLLECTOR]))).toEqual(['chrome-shift', 'content-shift'])
    await context.close()
  })
})
