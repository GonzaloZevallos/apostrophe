// The phone check's known offenders, counted (GH-80): one line per rule and per issue, from
// the lists in `web/src/mobile-standard/offenders/`. A count is one cell: a screen, a size, a
// theme, a rule and a target. The lists can only shrink, so this is the number an area PR
// attaches to say how many of its own are left. It reads the lists and nothing else: it runs
// no browser and calls no network. Node strips the TypeScript types itself.
import { OFFENDERS } from '../../web/src/mobile-standard/offenders/index.ts'

function count(key) {
  const counts = new Map()
  for (const offender of OFFENDERS) counts.set(key(offender), (counts.get(key(offender)) ?? 0) + 1)
  return [...counts].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en', { numeric: true }))
}

console.log(`mobile check, known offenders: ${OFFENDERS.length} cells`)
console.log('per issue:')
for (const [issue, n] of count((o) => `#${o.issue}`)) console.log(`  ${issue}: ${n}`)
console.log('per rule:')
for (const [rule, n] of count((o) => o.rule)) console.log(`  ${rule}: ${n}`)
