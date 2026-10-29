// Parses every ```mermaid block of the given Markdown files with Mermaid's own parser,
// inside a jsdom window, so the generated diagrams are checked locally instead of by a
// renderer in somebody's browser.
//
//   node web/scripts/docs/mermaidParse.ts <files…>
//
// Prints `<file>: block <n>: <message>` per problem, then always `checked <n> blocks in
// <m> files`; exits 1 on any problem or when no file is given.
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

export interface BlockProblem {
  /** 1-based position of the block in the file. */
  block: number
  message: string
}

type MermaidApi = (typeof import('mermaid'))['default']

/** Reuses an existing `window`/`document`; otherwise installs one jsdom window, filling only what is missing. */
export function ensureWindow(): void {
  const scope = globalThis as Record<string, unknown>
  if (scope['window'] !== undefined && scope['document'] !== undefined) return
  const { window } = new JSDOM('<!doctype html><html><body></body></html>')
  if (scope['window'] === undefined) scope['window'] = window
  if (scope['document'] === undefined) scope['document'] = window.document
}

let mermaidPromise: Promise<MermaidApi> | undefined

/** Mermaid reads `window` while it loads, so it is imported only after the window exists. */
export function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= (async () => {
    ensureWindow()
    return (await import('mermaid')).default
  })()
  return mermaidPromise
}

const OPENING_FENCE = /^```mermaid\s*$/
const CLOSING_FENCE = /^```\s*$/

export function extractBlocks(text: string): string[] {
  const blocks: string[] = []
  let current: string[] | undefined
  for (const line of text.split(/\r?\n/)) {
    if (current === undefined) {
      if (OPENING_FENCE.test(line)) current = []
    } else if (CLOSING_FENCE.test(line)) {
      blocks.push(current.join('\n'))
      current = undefined
    } else {
      current.push(line)
    }
  }
  return blocks
}

function oneLine(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.split('\n').find((line) => line.trim() !== '')?.trim() ?? 'parse error'
}

export async function parseMarkdown(text: string): Promise<BlockProblem[]> {
  const blocks = extractBlocks(text)
  if (blocks.length === 0) return []
  const mermaid = await loadMermaid()
  const problems: BlockProblem[] = []
  for (const [index, block] of blocks.entries()) {
    try {
      await mermaid.parse(block)
    } catch (error) {
      problems.push({ block: index + 1, message: oneLine(error) })
    }
  }
  return problems
}

export async function runCli(
  files: string[],
  read: (path: string) => Promise<string>,
  write: (line: string) => void,
): Promise<number> {
  if (files.length === 0) {
    write('usage: node web/scripts/docs/mermaidParse.ts <files…>')
    return 1
  }
  let checked = 0
  let failed = false
  for (const file of files) {
    const text = await read(file)
    checked += extractBlocks(text).length
    for (const problem of await parseMarkdown(text)) {
      failed = true
      write(`${file}: block ${problem.block}: ${problem.message}`)
    }
  }
  write(`checked ${checked} blocks in ${files.length} files`)
  return failed ? 1 : 0
}

if (import.meta.main) {
  process.exitCode = await runCli(
    process.argv.slice(2),
    (path) => readFile(path, 'utf8'),
    (line) => console.log(line),
  )
}
