// Before/after measure (ADR-0042): the exact count of differing pixels between the raw
// captures `comparisons.mjs` wrote, never between the composed sheets.
//
//   node scripts/design/ae.mjs <before-dir> <after-dir> [--only A,B]
//
// Each directory holds an `index.json`; for every screen in either one, the `built` and the
// `design` captures are compared separately and one line per screen and side is printed: the
// AE, or why there is none. Images of different dimensions, a screen missing on one side, a
// capture on one side only and an unreadable PNG are failures, never AE 0; a capture missing
// on both sides is reported and is not one. Any failure or any AE above 0 exits 1. No pixel
// data is printed.

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const { PNG } = createRequire(join(REPO, 'web', 'package.json'))('pngjs')

const SIDES = ['built', 'design']

// Pixels whose four RGBA bytes are not all equal: exact, no fuzz. Different dimensions are
// not comparable, so they are not a count.
export function ae(a, b) {
  if (a.width !== b.width || a.height !== b.height) return { ok: false, reason: 'size' }
  let differing = 0
  for (let at = 0; at < a.data.length; at += 4) {
    if (
      a.data[at] !== b.data[at] ||
      a.data[at + 1] !== b.data[at + 1] ||
      a.data[at + 2] !== b.data[at + 2] ||
      a.data[at + 3] !== b.data[at + 3]
    ) {
      differing += 1
    }
  }
  return { ok: true, differing }
}

export function decode(buffer) {
  try {
    const { width, height, data } = PNG.sync.read(Buffer.from(buffer))
    return { ok: true, image: { width, height, data } }
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
}

const loadFile = (path) => {
  try {
    return decode(readFileSync(path))
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
}

// One side of one screen: a line and whether it is a failure.
function compareSide(screen, side, beforePath, afterPath, load) {
  const label = `${screen} ${side}`
  if (beforePath === null && afterPath === null) {
    return { line: `${label}: no capture on either side`, failed: false }
  }
  if (beforePath === null || afterPath === null) {
    return { line: `${label}: FAIL no capture in ${beforePath === null ? 'before' : 'after'}`, failed: true }
  }
  const before = load(beforePath)
  const after = load(afterPath)
  if (!before.ok || !after.ok) return { line: `${label}: FAIL unreadable image`, failed: true }
  const result = ae(before.image, after.image)
  if (!result.ok) return { line: `${label}: FAIL different dimensions`, failed: true }
  return { line: `${label}: AE ${result.differing}`, failed: result.differing > 0 }
}

// The pairing of two parsed `index.json` files. `load(path)` decodes one capture.
export function compareIndexes(before, after, only, load) {
  const byScreen = (index) => new Map(index.map((entry) => [entry.screen, entry]))
  const beforeBy = byScreen(before)
  const afterBy = byScreen(after)
  const names = [...new Set([...beforeBy.keys(), ...afterBy.keys()])]
  const lines = []
  let failed = false
  const wanted = only ? [...only].filter((name) => !beforeBy.has(name) && !afterBy.has(name)) : []
  for (const name of wanted) {
    lines.push(`${name}: FAIL in neither index`)
    failed = true
  }
  for (const screen of names) {
    if (only && !only.has(screen)) continue
    const was = beforeBy.get(screen)
    const now = afterBy.get(screen)
    if (!was || !now) {
      lines.push(`${screen}: FAIL missing in ${was ? 'after' : 'before'}`)
      failed = true
      continue
    }
    for (const side of SIDES) {
      const result = compareSide(screen, side, was[side] ?? null, now[side] ?? null, load)
      lines.push(result.line)
      if (result.failed) failed = true
    }
  }
  return { lines, failed }
}

function main() {
  const { values, positionals } = parseArgs({ options: { only: { type: 'string' } }, allowPositionals: true })
  if (positionals.length !== 2) {
    console.error('usage: ae.mjs <before-dir> <after-dir> [--only A,B]')
    process.exit(2)
  }
  const [beforeDir, afterDir] = positionals.map((dir) => resolve(dir))
  let indexes
  try {
    indexes = [beforeDir, afterDir].map((dir) => JSON.parse(readFileSync(join(dir, 'index.json'), 'utf-8')))
  } catch (error) {
    console.error(`ae: cannot read an index.json: ${error.code ?? 'invalid'}`)
    process.exit(1)
  }
  const only = values.only ? new Set(values.only.split(',')) : null
  const { lines, failed } = compareIndexes(indexes[0], indexes[1], only, loadFile)
  for (const line of lines) console.log(line)
  if (failed) {
    console.error('ae: the before/after differ, or could not be compared')
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
