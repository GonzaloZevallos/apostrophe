/**
 * The More screen is retired: nothing under `web/src`, `web/e2e` or `tests` names it, its route or its
 * tab any more. Each file type has its own set of patterns, so a phrase that is only English in a
 * `.json` file or a workflow input named "more" in a `.py` test is not mistaken for the screen.
 * What stays on purpose: `MasInfo` and "More info", a settled glossary term, which the patterns let through.
 *
 * The scan reports `file:line`. The matcher is tested on strings it must refuse and look-alikes it must
 * accept, beside the real tree. This file is the scan's only exemption: it has to write the patterns.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, test } from 'vitest'

type FileType = 'ts' | 'json' | 'py'

interface Rule {
  name: string
  types: readonly FileType[]
  pattern: RegExp
  /** Strings the rule must refuse. */
  refuses: readonly string[]
  /** Look-alikes the rule must let through. */
  accepts: readonly string[]
}

const WEB = join(import.meta.dirname, '..', '..')
const ROOTS = [join(WEB, 'src'), join(WEB, 'e2e'), join(WEB, '..', 'tests')]
const SELF = join(WEB, 'src', 'architecture', 'retiredMore.test.ts')
const EXTENSIONS: Record<string, FileType> = { '.ts': 'ts', '.tsx': 'ts', '.json': 'json', '.py': 'py' }
const SKIPPED_DIRS = new Set(['node_modules', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache'])

const RULES: readonly Rule[] = [
  {
    name: 'the MORE constant',
    types: ['ts'],
    pattern: /\bMORE\b/,
    refuses: ['export const MORE = screen({})', 'ROUTES.MORE.path'],
    accepts: ['const MOREOVER = 1', 'const MORE_INFO = 1'],
  },
  {
    name: "the 'more' key",
    types: ['ts'],
    pattern: /(['"`])more\1/,
    refuses: ["bar: 'more'", 'group: "more"'],
    accepts: ["'moreInfo'", "'Learn more'", "'more info'"],
  },
  {
    name: "the 'mas' icon or key",
    types: ['ts'],
    pattern: /(['"`])mas\1/,
    refuses: ["<Icono name='mas' />", "icon: 'mas'"],
    accepts: ["'personaMas'", "'mas__item'"],
  },
  {
    name: 'the common:more key',
    types: ['ts', 'json'],
    pattern: /common:more\b/,
    refuses: ["t('common:more')", '{ "key": "common:more" }'],
    accepts: ["t('common:moreInfo')", '{ "key": "common:moreInfo" }'],
  },
  {
    name: 'the /more or /mas path in code',
    types: ['ts'],
    pattern: /(?:(['"`])\/(?:more|mas)(?:\1|[/?]|$))|(?:\\\/(?:more|mas)(?![\w-]))/,
    refuses: ["goto('/more')", 'page.goto("/mas")', "path: '/more/x'", "url = '/mas?x=1'", 'toHaveURL(/\\/more$/)'],
    accepts: ["goto('/moreover')", "path: '/masters'", "goto('/ventas')", "'/more-info'"],
  },
  {
    name: 'the Mas screen',
    types: ['ts'],
    pattern: /\bMas\b/,
    refuses: ['import { Mas } from "./Mas"', 'renderMas(<Mas />)'],
    accepts: ['<MasInfo line={x} />', 'MasInfo.test.tsx', 'personaMas'],
  },
  {
    name: 'the Mas dark screen',
    types: ['ts', 'json'],
    pattern: /MasOscuro/,
    refuses: ['{ screen: "MasOscuro" }', "'MasOscuro'"],
    accepts: ['MasInfo', 'InicioOscuro'],
  },
  {
    name: 'the whole string More or Más',
    types: ['ts'],
    pattern: /(['"`])(?:More|Más)\1/,
    refuses: ["name: 'More'", 'text: "Más"', 'getByText(`More`)'],
    accepts: ["'More info'", "'Learn more'", "'Más información'", '"Moreover"'],
  },
  {
    name: 'a lookup by the name More',
    types: ['ts'],
    pattern: /name:\s*\/\^?(?:More|Más)\$?\//,
    refuses: ['getByRole("link", { name: /^More$/ })', 'getByRole("link", { name: /More/ })', 'name: /^Más$/'],
    accepts: ['{ name: /More info/ }', '{ name: /^Settings$/ }'],
  },
  {
    name: 'the "more" key in JSON',
    types: ['json'],
    pattern: /"more"/,
    refuses: ['  "more": "More",', '"group": "more"'],
    accepts: ['"moreInfo": "More info"', '"text": "Learn more"'],
  },
  {
    name: 'the /more or /mas path in JSON',
    types: ['json'],
    pattern: /"\/(?:more|mas)"/,
    refuses: ['{ "path": "/more" }', '{ "/mas": "/" }'],
    accepts: ['{ "path": "/masters" }', '{ "path": "/ventas" }'],
  },
  {
    name: 'the Mas.tsx file in JSON',
    types: ['json'],
    pattern: /Mas\.tsx/,
    refuses: ['"src/screens/Mas.tsx": 3'],
    accepts: ['"src/screens/MasInfo.tsx": 3', '"src/components/MasInfo.test.tsx": 1'],
  },
  {
    name: 'the /more or /mas path in Python',
    types: ['py'],
    pattern: /["']\/(?:more|mas)(?![\w-])/,
    refuses: ['client.get("/more")', "assert path == '/mas'", 'client.get("/more/x")'],
    accepts: ['inputs["more"] = {"type": "string"}', 'client.get("/moreover")', 'client.get("/ventas")'],
  },
]

interface Source {
  path: string
  content: string
}

/** `path:line` for each line of each file that a rule of its file type refuses. */
function findRetired(files: readonly Source[]): string[] {
  const found: string[] = []
  for (const { path, content } of files) {
    const type = EXTENSIONS[path.slice(path.lastIndexOf('.'))]
    if (type === undefined) continue
    const rules = RULES.filter((rule) => rule.types.includes(type))
    content.split('\n').forEach((line, index) => {
      if (rules.some((rule) => rule.pattern.test(line))) found.push(`${path}:${index + 1}`)
    })
  }
  return found
}

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) files.push(...walk(join(dir, entry.name)))
    } else if (EXTENSIONS[entry.name.slice(entry.name.lastIndexOf('.'))] !== undefined) {
      files.push(join(dir, entry.name))
    }
  }
  return files
}

describe('the retired More scan', () => {
  test('nothing under web/src, web/e2e or tests names the More screen, its route or its tab', () => {
    const files = ROOTS.flatMap(walk)
      .filter((file) => file !== SELF)
      .map((file) => ({ path: relative(join(WEB, '..'), file).split(sep).join('/'), content: readFileSync(file, 'utf8') }))

    expect(files.some(({ path }) => path === 'web/src/routes.ts')).toBe(true)
    expect(files.some(({ path }) => path.startsWith('web/e2e/'))).toBe(true)
    expect(files.some(({ path }) => path.startsWith('tests/'))).toBe(true)
    expect(findRetired(files)).toEqual([])
  })

  describe.each(RULES.map((rule) => [rule.name, rule] as const))('%s', (_name, rule) => {
    const type = rule.types[0] as FileType
    const path = `x.${type}`

    test.each(rule.refuses.map((line) => [line] as const))('refuses %s', (line) => {
      expect(findRetired([{ path, content: line }])).toEqual([`${path}:1`])
    })

    test.each(rule.accepts.map((line) => [line] as const))('lets %s through', (line) => {
      expect(findRetired([{ path, content: line }])).toEqual([])
    })
  })

  test('reports the file and the line of each refusal, and reads each file type by its own patterns', () => {
    expect(
      findRetired([
        { path: 'web/src/a.tsx', content: "const ok = 1\nconst bar = 'more'\nconst b = 'Learn more'" },
        { path: 'web/src/b.json', content: '{\n  "more": "More"\n}' },
        { path: 'tests/test_a.py', content: 'inputs["more"] = {}\nclient.get("/mas")' },
        { path: 'tests/test_b.py', content: "name = 'More'\nMORE = 1\nkey = 'more'" },
        { path: 'web/src/c.json', content: '{ "name": "Mas" }' },
      ]),
    ).toEqual(['web/src/a.tsx:2', 'web/src/b.json:2', 'tests/test_a.py:2'])
  })
})
