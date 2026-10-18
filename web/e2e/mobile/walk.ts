/** Visits a registry screen and runs its steps; what cannot be reached is recorded, never thrown. */

import type { Locator, Page } from '@playwright/test'
import { resolvePlaceholders, type RegistryScreen } from '../../src/mobile-standard/registry.ts'
import type { WalkStep } from '../../src/mobile-standard/states.ts'

export const STEP_TIMEOUT_MS = 3_000

/** What the walk visits: a registry screen, or a state with steps of its own. */
export interface WalkScreen extends Omit<RegistryScreen, 'steps'> {
  steps: readonly WalkStep[]
}

export type Facts = Readonly<Record<string, string | number>>

/** A click names what the seller reads: its text, or, for an icon-only button, its accessible name. Waits for either. */
function clickTarget(page: Page, name: string): Locator {
  return page
    .getByText(name, { exact: true })
    .or(page.getByRole('button', { name, exact: true }))
    .first()
}

/** A fill types into an input or textarea, and picks the option with that label in a select. */
async function fill(page: Page, label: string, value: string, timeout: number): Promise<void> {
  const field = page.getByLabel(label).first()
  const isSelect = await field.evaluate((element) => element.tagName === 'SELECT', undefined, { timeout })
  if (isSelect) await field.selectOption({ label: value }, { timeout })
  else await field.fill(value, { timeout })
}

async function run(page: Page, step: WalkStep, facts: Facts): Promise<void> {
  const options = { timeout: STEP_TIMEOUT_MS }
  if ('activate' in step) {
    const control = page
      .getByText(step.activate, { exact: true })
      .or(page.getByLabel(step.activate, { exact: true }))
      .first()
    await control.dispatchEvent('click', undefined, options)
  } else if ('click' in step) await clickTarget(page, step.click).click(options)
  else if ('press' in step) await page.getByRole('button', { name: step.press, exact: true }).click(options)
  else if ('select' in step) {
    await page.getByLabel(step.select.label).first().selectOption({ index: step.select.index }, options)
  } else if ('fill' in step) {
    await fill(page, step.fill.label, resolvePlaceholders(step.fill.value, facts), STEP_TIMEOUT_MS)
  } else if ('wait' in step) await page.getByText(step.wait, { exact: true }).first().waitFor(options)
  else await page.context().setOffline(true)
}

/** Waits until the page has painted twice: React's mount effects have run, no timer involved. */
export async function painted(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  )
}

export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page.evaluate(() => document.fonts.ready)
}

export async function open(page: Page, screen: WalkScreen, facts: Facts): Promise<void> {
  if (screen.route === null) throw new Error(`${screen.screen} has no route`)
  // A screen opens from a blank entry, never over the last walk's: going to the same URL again
  // keeps its history state, and then a form's own "Volver" would leave the app instead of
  // asking (`location.key` is no longer 'default').
  await page.goto('about:blank')
  await page.goto(resolvePlaceholders(screen.route, facts))
}

/** Runs the registry's steps; answers whether every one was reachable. */
export async function runSteps(page: Page, screen: WalkScreen, facts: Facts): Promise<boolean> {
  try {
    for (const step of screen.steps) {
      await run(page, step, facts)
      await settle(page)
    }
    return true
  } catch {
    return false
  } finally {
    await page.context().setOffline(false)
  }
}
