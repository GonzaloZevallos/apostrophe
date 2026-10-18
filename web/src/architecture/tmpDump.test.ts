import { test } from 'vitest'
import { findVisibleLiterals } from './appText'
import { readFileSync, writeFileSync } from 'node:fs'
test('dump', () => {
  const files: string[] = JSON.parse(readFileSync('src/architecture/textLeft/home-analysis-expenses-onboarding.json', 'utf8'))
  let out = ''
  for (const f of files) {
    const path = 'src/' + f.replace(/^src\//, '')
    const src = readFileSync(path, 'utf8')
    const lits = findVisibleLiterals(path, src)
    out += `\n## ${f}\n` + lits.map((l) => JSON.stringify(l)).join('\n')
  }
  writeFileSync('/tmp/dump.txt', out)
})
