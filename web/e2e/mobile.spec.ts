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
import { collect, pageViolation, type CellId } from './mobile/collect.js'
import { newCell, SIZES, THEMES, type Size, type Theme } from './mobile/cells.js'
import { guardWrites, holdApi } from './mobile/network.js'
import { open, painted, runSteps, settle, type Facts } from './mobile/walk.js'
import { OFFENDERS, diffOffenders } from '../src/mobile-standard/offenders/index.ts'
import { WALKABLE } from '../src/mobile-standard/registry.ts'
import type { Violation } from '../src/mobile-standard/violation.ts'

const SIGNED_OUT = { cookies: [], origins: [] } as { cookies: []; origins: [] }

function readFacts(): Facts {
  const raw: unknown = JSON.parse(readFileSync(MOBILE_FACTS_FILE, 'utf-8'))
  const facts = raw as { email: string; ids: Record<string, string | number> }
  return { ...facts.ids, email: facts.email }
}

async function walkScreen(page: Page, cell: CellId, held: boolean, facts: Facts, screenFacts: Facts) {
  const found: Violation[] = []
  const screen = WALKABLE.find((s) => s.screen === cell.screen)
  if (screen === undefined) throw new Error(`${cell.screen} is not walkable`)
  const hold = held ? await holdApi(page.context()) : null
  try {
    await open(page, screen, screenFacts)
    if (hold !== null) {
      await painted(page)
      found.push(...(await collect(page, 'loading', cell)))
      await hold.release()
    }
    await settle(page)
    if (!screen.signedOut && new URL(page.url()).pathname.startsWith('/entrar')) {
      found.push(pageViolation(cell, 'unreachable'))
      return found
    }
    if (hold === null) {
      if (!(await runSteps(page, screen, facts))) return [pageViolation(cell, 'unreachable')]
      found.push(...(await collect(page, 'loaded', cell)))
    }
  } finally {
    if (hold !== null) await hold.release()
  }
  return found
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
          actual.push(...(await walkScreen(page, cell, false, facts, facts)))
          actual.push(...(await walkScreen(page, cell, true, facts, facts)))
        })
      }

      // The first signed-in cell lands on Inicio, never Entrar (the cookie is Max-Age only).
      await inPage.goto('/')
      await settle(inPage)
      expect(new URL(inPage.url()).pathname).toBe('/')

      const own = OFFENDERS.filter((o) => o.size === size && o.theme === theme)
      expect(diffOffenders(own, actual)).toEqual({ unlisted: [], fixedButListed: [] })
      await expectOnlyTheThemeStored(inPage)
      await signedIn.close()
      await signedOut.close()
    })
  }
}
