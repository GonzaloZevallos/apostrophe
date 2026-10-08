/**
 * The closing guards over the real tree (GH-97, ADR-0034): no `<svg>` outside `Icono`, no raw
 * action button, no `.boton*` class outside `Boton`/`BotonLink`, no icon name nobody uses.
 *
 * `OLD_SHAPES` is what the areas could not migrate before the closing subtask: each of these
 * still draws a button or a `.boton*` class itself, because its replacement needs a glyph
 * (`cerrar`, `lapiz`, `compartir`, `candado`, `salirSesion`, `archivar`, `restaurar`) that
 * `icon-glyphs` never shipped, or a text-link shape `Boton` does not have. It can only shrink:
 * a file that offends less than its entry, or not at all, fails until the entry is lowered or
 * removed, and a file not listed here may not offend at all. Empty is the target.
 */

import { expect, test } from 'vitest'
import { findBotonClasses, findRawButtons, findRawSvg, findUnusedIcons } from './closingGuards'

const modules = import.meta.glob(['/src/**/*.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>
const files = Object.entries(modules).map(([path, content]) => ({ path, content }))

const OLD_SHAPES: Record<string, { buttons: number; classes: number }> = {
  // The option tabs of Ventas/Clientes: `Pestanas.test.tsx` finds them by `boton--enlace`, and
  // Boton has no tab shape.
  '/src/components/Pestanas.tsx': { buttons: 0, classes: 2 },
  // Compartir and Copiar need the `compartir` and copy glyphs (never shipped by icon-glyphs).
  '/src/screens/Catalogo.tsx': { buttons: 2, classes: 3 },
  // Copiar and Compartir the invitation link: same missing glyphs.
  '/src/screens/settings/UsersGroup.tsx': { buttons: 2, classes: 2 },
  // Restaurar needs the `restaurar` glyph.
  '/src/screens/varieties/ArchivedVarieties.tsx': { buttons: 1, classes: 2 },
  // Its back handler calls `preventDefault` on the event; BotonLink's onClick has no event.
  '/src/screens/varieties/PriceHistory.tsx': { buttons: 0, classes: 1 },
  // Archivar needs the `archivar` glyph.
  '/src/screens/varieties/VarietyPage.tsx': { buttons: 1, classes: 2 },
  // Restaurar / Archivar answers inside the removal flow: `archivar` and `restaurar` glyphs.
  '/src/screens/varieties/VarietyRemoval.tsx': { buttons: 1, classes: 2 },
  // "Nueva venta" is selected by `.boton-nueva-venta` in Shell.test.tsx and placed by that class;
  // BotonLink takes no className.
  '/src/shell/Shell.tsx': { buttons: 0, classes: 4 },
}

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
