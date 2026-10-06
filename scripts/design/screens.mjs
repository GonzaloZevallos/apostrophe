import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PANTALLAS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'product', 'design-system', 'pantallas')

// The app picks its theme from `data-tema` alone, never from the system (plan,
// subtask `light-by-default`): a stray `color_scheme` entry would silently emulate
// a dark system again, and a `tema` other than `'oscuro'` names a value the app
// does not recognise.
//
// `screen` is the unique key of an entry: its PNG name, its `--only` key and its
// heading. `design` names the file `pantallas/<design>.dc.html` it is compared
// against (default: `screen`); `section` is the exact label text of one block inside
// a design file that draws several states, and that block must exist in the file.
/**
 * @param {ReadonlyArray<Readonly<Record<string, unknown>>>} screens
 * @returns {void}
 */
export function assertScreens(screens) {
  const seen = new Set()
  for (const s of screens) {
    if ('color_scheme' in s) throw new Error(`${s.screen}: color_scheme is retired, use tema: 'oscuro'`)
    if ('tema' in s && s.tema !== 'oscuro') throw new Error(`${s.screen}: unknown tema ${JSON.stringify(s.tema)}`)
    if (seen.has(s.screen)) throw new Error(`${s.screen}: screen is not unique across the file`)
    seen.add(s.screen)
    if ('design' in s || 'section' in s) assertDesign(s)
  }
}

/** @param {Readonly<Record<string, unknown>>} s */
function assertDesign(s) {
  const design = 'design' in s ? s.design : s.screen
  if (typeof design !== 'string') throw new Error(`${s.screen}: design must be a string`)
  const file = join(PANTALLAS, `${design}.dc.html`)
  if (!existsSync(file)) throw new Error(`${s.screen}: design ${design} has no pantallas/${design}.dc.html`)
  if (!('section' in s)) return
  if (typeof s.section !== 'string') throw new Error(`${s.screen}: section must be a string`)
  // A label is a line of text of its own: the text between a tag's end and the next tag.
  if (!readFileSync(file, 'utf-8').includes(`>${s.section}<`)) {
    throw new Error(`${s.screen}: section ${JSON.stringify(s.section)} is not in ${design}.dc.html`)
  }
}
