// The computer sidebar's before/after check (GH-495 part 7, Human Decision 1): `ae.mjs --box` over
// the computer Home in light and dark, master as "before" and the branch as "after". The sidebar is
// the one thing the change redraws, so every differing pixel must lie inside its column: a box that
// reaches x + width above 248 px (the drawing's `max-width` for the nav) is the content having moved,
// and it is a failure to escalate, never a tolerance. The drawing side must not differ at all.
//
//   node scripts/design/sidebarBox.mjs <before-dir> <after-dir>

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compareIndexes, decode } from './ae.mjs'

export const SIDEBAR_SCREENS = ['InicioHoyCompu', 'InicioHoyCompuOscuro']
export const SIDEBAR_RIGHT_EDGE = 248

// What is wrong with `ae.mjs --box`'s lines for the two sidebar screens; empty when the check passes.
export function sidebarProblems(lines) {
  const problems = []
  for (const screen of SIDEBAR_SCREENS) {
    const built = lines.find((line) => line.startsWith(`${screen} built: `))
    const design = lines.find((line) => line.startsWith(`${screen} design: `))
    if (!built) problems.push(`${screen} built: no line, so nothing was compared`)
    if (!design) problems.push(`${screen} design: no line, so nothing was compared`)
    if (design && design !== `${screen} design: AE 0`) problems.push(`${screen} design: the drawing differs between runs (${design})`)
    if (!built) continue
    if (built === `${screen} built: AE 0`) continue
    const match = /^\S+ built: AE (\d+) box x=(\d+) y=(\d+) w=(\d+) h=(\d+)$/.exec(built)
    if (!match) {
      problems.push(`${screen} built: ${built.slice(screen.length + 8)}`)
      continue
    }
    const right = Number(match[2]) + Number(match[4])
    if (right > SIDEBAR_RIGHT_EDGE) {
      problems.push(`${screen} built: the differing pixels reach x=${right}, past the sidebar column (${SIDEBAR_RIGHT_EDGE}); escalate, never tolerate`)
    }
  }
  return problems
}

function main() {
  const [beforeDir, afterDir] = process.argv.slice(2).map((dir) => resolve(dir))
  if (!beforeDir || !afterDir) {
    console.error('usage: sidebarBox.mjs <before-dir> <after-dir>')
    process.exit(2)
  }
  const indexes = [beforeDir, afterDir].map((dir) => JSON.parse(readFileSync(join(dir, 'index.json'), 'utf-8')))
  const load = (path) => {
    try {
      return decode(readFileSync(path))
    } catch {
      return { ok: false, reason: 'unreadable' }
    }
  }
  const { lines } = compareIndexes(indexes[0], indexes[1], new Set(SIDEBAR_SCREENS), load, true)
  for (const line of lines) console.log(line)
  const problems = sidebarProblems(lines)
  for (const problem of problems) console.error(`sidebar: ${problem}`)
  if (problems.length > 0) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
