/**
 * The closing guards over the real tree (GH-97, ADR-0037): no `<svg>` outside `Icono`, no raw
 * action button, no `.boton*` class outside `Boton`/`BotonLink`, no icon name nobody uses.
 *
 * `OLD_SHAPES` lists the only files that still draw a raw action button or a `.boton*` class
 * themselves: the Onboarding and the Precios group, which reached master while GH-97 was open
 * and are brought under the rule by their own issue. The list only shrinks: no other file may
 * be added to it.
 *
 * `ACTION_LINKS_LEFT` lists the only link that still draws an action itself, by identity (its
 * file and its `to=`), so a second one in the same file is a new entry and fails.
 */

import { expect, test } from 'vitest'
import {
  findActionLinks,
  findBotonClasses,
  findLinkAliases,
  findRawButtons,
  findRawSvg,
  findUnusedIcons,
  linkTags,
} from './closingGuards'

const modules = import.meta.glob(['/src/**/*.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>
const files = Object.entries(modules).map(([path, content]) => ({ path, content }))

const OLD_SHAPES: Record<string, { buttons: number; classes: number }> = {
  '/src/screens/onboarding/BotStep.tsx': { buttons: 1, classes: 1 },
  '/src/screens/onboarding/CatalogMessageStep.tsx': { buttons: 1, classes: 2 },
  '/src/screens/onboarding/CategoriesStep.tsx': { buttons: 1, classes: 1 },
  '/src/screens/onboarding/Listo.tsx': { buttons: 3, classes: 3 },
  '/src/screens/onboarding/OnboardingNotice.tsx': { buttons: 1, classes: 0 },
  '/src/screens/onboarding/OnboardingStep.tsx': { buttons: 4, classes: 3 },
  '/src/screens/onboarding/PartnerStep.tsx': { buttons: 1, classes: 1 },
  '/src/screens/onboarding/StockStep.tsx': { buttons: 3, classes: 4 },
  '/src/screens/settings/PricingGroup.tsx': { buttons: 1, classes: 1 },
}

/**
 * The links that hold an icon and a word outside `BotonLink`. It only shrinks: no entry may be
 * added. "Cargar gasto" is a 40 px icon-only round control on the phone, a shape the closed
 * icon-only map does not have and `BotonLink` cannot draw; the design and product issue about
 * that shape is what empties this list.
 */
const ACTION_LINKS_LEFT = ['/src/screens/Gastos.tsx to={EXPENSE_NEW}']

function perFile(lines: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const line of lines) {
    const path = line.split(':')[0] ?? ''
    counts[path] = (counts[path] ?? 0) + 1
  }
  return counts
}

test('the tree is the one the guards expect', () => {
  expect(files.some(({ path }) => path === '/src/components/Icono.tsx')).toBe(true)
  expect(files.some(({ path }) => path === '/src/components/botonVisual.tsx')).toBe(true)
  expect(files.length).toBeGreaterThan(50)
})

test('no <svg> outside Icono.tsx', () => {
  expect(findRawSvg(files)).toEqual([])
})

test('every name in ICON_NAMES is used by a screen', () => {
  expect(findUnusedIcons(files)).toEqual([])
})

test('a raw <button> and a boton* class outside Boton and BotonLink only shrink from OLD_SHAPES', () => {
  const buttons = perFile(findRawButtons(files))
  const classes = perFile(findBotonClasses(files))
  const found: Record<string, { buttons: number; classes: number }> = {}
  for (const path of new Set([...Object.keys(buttons), ...Object.keys(classes)])) {
    found[path] = { buttons: buttons[path] ?? 0, classes: classes[path] ?? 0 }
  }
  expect(found).toEqual(OLD_SHAPES)
})

test('an action drawn as a link outside BotonLink only shrinks from ACTION_LINKS_LEFT', () => {
  const found = findActionLinks(files)
    .map((line) => line.replace(/:\d+: an action drawn as a link \(to=(.*)\), use BotonLink$/, ' to=$1'))
    .sort()
  expect(found).toEqual(ACTION_LINKS_LEFT)
})

test('the link scanner still finds the links it guards', () => {
  const tags = linkTags(files)
  const has = (path: string, to?: string) =>
    tags.some((tag) => tag.path === path && (to === undefined || tag.to === to))
  expect(has('/src/shell/Shell.tsx', '{item.to}')).toBe(true)
  expect(has('/src/screens/Mas.tsx')).toBe(true)
  expect(has('/src/screens/Gastos.tsx', '{EXPENSE_NEW}')).toBe(true)
})

test('no import renames Link or InAppLink', () => {
  expect(findLinkAliases(files)).toEqual([])
})
