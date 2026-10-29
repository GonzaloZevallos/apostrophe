import { parseMarkdown, runCli } from './mermaidParse.ts'

const fence = (body: string): string => '```mermaid\n' + body + '\n```\n'

const VALID = 'classDiagram\n  class A {\n    +int x\n  }'
const INVALID = 'classDiagram\n  class A {{{ ['

describe('parseMarkdown', () => {
  it('accepts a valid diagram', async () => {
    expect(await parseMarkdown(fence(VALID))).toEqual([])
  })

  it('reports an invalid diagram with its 1-based block number and a one-line message', async () => {
    const problems = await parseMarkdown(fence(INVALID))
    expect(problems).toHaveLength(1)
    expect(problems[0]?.block).toBe(1)
    expect(problems[0]?.message).not.toBe('')
    expect(problems[0]?.message).not.toContain('\n')
  })

  it('accepts ~T~ generics and entity-coded |, < and >', async () => {
    const diagram = [
      'classDiagram',
      '  class Repo {',
      '    +dict~str, list~int~~ index',
      '    +Optional~int~ value',
      '    +pick(x: int #124; None) int',
      '    +cmp(a: Callable~#60;...#62;, T~) T',
      '  }',
    ].join('\n')
    expect(await parseMarkdown(fence(diagram))).toEqual([])
  })

  it('names the bad block among two', async () => {
    const problems = await parseMarkdown(fence(VALID) + '\ntext\n\n' + fence(INVALID))
    expect(problems.map((p) => p.block)).toEqual([2])
  })

  it('ignores fences that are not mermaid', async () => {
    expect(await parseMarkdown('```python\nnot { mermaid\n```\n')).toEqual([])
  })
})

describe('runCli', () => {
  const run = async (files: string[], contents: Record<string, string>) => {
    const lines: string[] = []
    const code = await runCli(
      files,
      async (p) => contents[p] ?? '',
      (line) => lines.push(line),
    )
    return { code, lines }
  }

  it('returns 1 when given no files', async () => {
    const { code } = await run([], {})
    expect(code).toBe(1)
  })

  it('prints the final count line for a two-block file', async () => {
    const { code, lines } = await run(['a.md'], { 'a.md': fence(VALID) + fence(VALID) })
    expect(code).toBe(0)
    expect(lines.at(-1)).toBe('checked 2 blocks in 1 files')
  })

  it('prints file: block n: message for each problem, then the count line, and returns 1', async () => {
    const { code, lines } = await run(['a.md'], { 'a.md': fence(VALID) + fence(INVALID) })
    expect(code).toBe(1)
    expect(lines[0]).toMatch(/^a\.md: block 2: .+/)
    expect(lines.at(-1)).toBe('checked 2 blocks in 1 files')
  })
})
