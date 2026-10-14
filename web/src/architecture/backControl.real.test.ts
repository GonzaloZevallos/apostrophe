/**
 * The back control over the real tree (GH-135, ADR-0041): every module under `src/` goes
 * through `checkBackControl` and none may write the back glyph itself or import
 * `components/BackButton` outside the shell and `screens/Analisis.tsx`. The checker's own
 * test (`backControl.test.ts`) feeds it what it must reject; this one proves the product
 * is clean, so a page that draws its own "‹" again fails here.
 */

import { expect, test } from 'vitest'
import { checkBackControl } from './backControl'

const modules = import.meta.glob(['/src/**/*.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

test('no module outside the shell writes a back glyph or imports BackButton', () => {
  const entries = Object.entries(modules)
  expect(entries.length).toBeGreaterThan(100)
  const findings = entries.flatMap(([path, source]) => checkBackControl(path, source))
  expect(findings).toEqual([])
})

test('the real tree is scanned with the checker rejecting a page that draws its own arrow', () => {
  const page = "export default function P() { return <a>‹ Variedades</a> }"
  expect(checkBackControl('/src/screens/Page.tsx', page)).toHaveLength(1)
})
