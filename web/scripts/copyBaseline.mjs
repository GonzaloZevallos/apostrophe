// Generates `src/architecture/fixtures/copyBaseline.es.json`: every text of the keyed
// package `src/copy/` as the Spanish app says it today, one entry per key path
// (`section.ENTRY`, `section.OBJECT.key`). The Spanish rule over `copy/` (ADR-0049) fails
// a section value that equals one of these. A function entry is stored as its output
// rendered with `SAMPLES`, with the arguments listed in `FUNCTION_SAMPLES` below; an entry
// with several argument lists adds `#<index>` to its key. A function with no row there
// stops the script, so a new one cannot slip out of the baseline.
//
// The file is never hand-edited: run `node scripts/copyBaseline.mjs` from `web/`. It is
// the Spanish as it stood when the texts moved into `copy/`; it is not regenerated when
// the English lands, or it would stop saying what the Spanish was.
//
// Also prints the texts two section files both write (a text two sections say belongs in
// `common`, imported by the others) and exits 1 when there are any.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = fileURLToPath(new URL('../src/architecture/fixtures/copyBaseline.es.json', import.meta.url))

const SECTIONS = [
  'analysis', 'auth', 'catalog', 'common', 'customers', 'expenses', 'format', 'home',
  'onboarding', 'refusals', 'sales', 'settings', 'shell', 'states', 'stock', 'varieties',
]

const server = await createServer({
  root,
  configFile: false,
  appType: 'custom',
  server: { middlewareMode: true },
  logLevel: 'error',
})

try {
  const { SAMPLES } = await server.ssrLoadModule('/src/copy/limits.ts')

  /** The arguments each function entry is rendered with, by key path. */
  const FUNCTION_SAMPLES = {
    'auth.expiryLine': [
      [true, SAMPLES.date],
      [false, SAMPLES.date],
    ],
    'sales.noPriceMessage': [[SAMPLES.name]],
    'settings.inviteExpiry': [[SAMPLES.date]],
    'stock.onHandHelp': [[SAMPLES.grams]],
    'stock.perGramPreview': [[SAMPLES.amount]],
  }

  const baseline = {}
  const used = new Set()

  function visit(path, value) {
    if (typeof value === 'string') {
      baseline[path] = value
    } else if (typeof value === 'function') {
      const lists = FUNCTION_SAMPLES[path]
      if (lists === undefined) throw new Error(`${path} is a function with no sample arguments`)
      used.add(path)
      lists.forEach((args, index) => {
        baseline[lists.length === 1 ? path : `${path}#${index}`] = value(...args)
      })
    } else if (Array.isArray(value)) {
      // LIMITED_COPY and LONG_REFUSALS list texts defined under another key.
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, inner] of Object.entries(value)) visit(`${path}.${key}`, inner)
    }
  }

  for (const section of SECTIONS) {
    const mod = await server.ssrLoadModule(`/src/copy/${section}.ts`)
    for (const [name, value] of Object.entries(mod).sort(([a], [b]) => a.localeCompare(b))) {
      if (name === 'LIMITED_COPY' || name === 'LONG_REFUSALS') continue
      visit(`${section}.${name}`, value)
    }
  }
  for (const path of Object.keys(FUNCTION_SAMPLES)) {
    if (!used.has(path)) throw new Error(`${path} has sample arguments but is no function entry`)
  }

  writeFileSync(out, `${JSON.stringify(baseline, null, 2)}\n`)
  console.log(`${Object.keys(baseline).length} entries -> ${out}`)

  // A text written in two section files (not one defined once and imported) belongs in
  // `common`. Read from the source, so an import of a `common` entry is not a copy.
  const writtenIn = new Map()
  for (const section of SECTIONS) {
    const file = fileURLToPath(new URL(`../src/copy/${section}.ts`, import.meta.url))
    const tree = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const visitNode = (node) => {
      if (node.parent === undefined) return ts.forEachChild(node, visitNode)
      const isText = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
      const parent = node.parent
      const isKind = ts.isPropertyAssignment(parent) && parent.name.getText() === 'kind'
      const isImport = ts.isImportDeclaration(parent) || ts.isLiteralTypeNode(parent)
      if (isText && !isKind && !isImport && /\p{L}/u.test(node.text)) {
        const sections = writtenIn.get(node.text) ?? new Set()
        sections.add(section)
        writtenIn.set(node.text, sections)
      }
      ts.forEachChild(node, visitNode)
    }
    visitNode(tree)
  }
  const shared = [...writtenIn].filter(([, sections]) => sections.size > 1)
  for (const [text, sections] of shared) {
    console.error(`written in ${[...sections].join(', ')}: ${text}`)
  }
  if (shared.length > 0) process.exitCode = 1
} finally {
  await server.close()
}
