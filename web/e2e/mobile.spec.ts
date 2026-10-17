/**
 * The phone check (GH-80): one test per size and theme, each walking every walkable
 * registry screen, loaded and then with the API held. Checkers only return `Violation`s;
 * the cell ends with one assertion that `diffOffenders` finds nothing new and nothing
 * fixed-but-listed, and with the storage check. Every non-GET/HEAD request is aborted or
 * stubbed (invariant 6); the clock is pinned on both sides (invariant 7).
 */

import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { MOBILE_FACTS_FILE, MOBILE_STATE_FILE } from './env.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'
import type { CellId } from './mobile/collect.js'
import { newCell, SIZES, THEMES, type Size, type Theme } from './mobile/cells.js'
import { guardWrites } from './mobile/network.js'
import { settle, type Facts } from './mobile/walk.js'
import { asScreen, STATE_SCREENS } from './mobile/states.js'
import { walkScreen } from './mobile/walkScreen.js'
import { OFFENDERS, diffOffenders } from '../src/mobile-standard/offenders/index.ts'
import { parseFacts, WALKABLE } from '../src/mobile-standard/registry.ts'
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

      for (const screen of [...WALKABLE, ...STATE_SCREENS]) {
        await test.step(screen.screen, async () => {
          const page = screen.signedOut ? outPage : inPage
          const cell = cellOf(screen.screen)
          actual.push(...(await walkScreen(page, screen, cell, false, facts)))
          actual.push(...(await walkScreen(page, screen, cell, true, facts)))
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
    expect(await walkScreen(page, screen, PROBE_CELL, false, readFacts())).toEqual([])
    await context.close()
  })
})

test.describe('the walked states', () => {
  test('a state whose visible element is absent is unreachable', async ({ browser }) => {
    const context = await newCell(browser, PROBE_SIZE, 'claro', MOBILE_STATE_FILE)
    const page = await context.newPage()
    const absent = { screen: 'Probe', route: '/ventas', steps: [], visible: 'texto que no existe' }
    expect(await walkScreen(page, asScreen(absent), PROBE_CELL, false, readFacts())).toEqual([
      { ...PROBE_CELL, rule: 'unreachable', target: '' },
    ])
    await context.close()
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
