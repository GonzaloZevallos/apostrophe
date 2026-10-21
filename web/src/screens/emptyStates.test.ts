import { describe, expect, test } from 'vitest'
import { EMPTY_STATE_WORDINGS, EMPTY_STATES } from '../copy/emptyStates'

const sources = import.meta.glob(['/src/screens/**/*.tsx', '/src/screens/**/*.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

/** The files that hold one of the wordings as text, other than the module that owns them. */
export function literalCopies(
  wordings: readonly string[],
  files: Record<string, string>,
): { path: string; wording: string }[] {
  return Object.entries(files).flatMap(([path, content]) => {
    if (path.endsWith('/emptyStates.ts') || /\.test\.tsx?$/.test(path)) return []
    const code = stripComments(content)
    return wordings.filter((wording) => code.includes(wording)).map((wording) => ({ path, wording }))
  })
}

describe('the empty-state wordings', () => {
  test('are all listed, non-empty and distinct', () => {
    expect(EMPTY_STATE_WORDINGS).toEqual(expect.arrayContaining(Object.values(EMPTY_STATES)))
    expect(new Set(EMPTY_STATE_WORDINGS).size).toBe(EMPTY_STATE_WORDINGS.length)
    for (const wording of EMPTY_STATE_WORDINGS) expect(wording).not.toBe('')
  })

  test('no screen holds one as a literal', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20)
    expect(literalCopies(EMPTY_STATE_WORDINGS, sources)).toEqual([])
  })

  test('the guard rejects a screen that copies a wording, in code but not in a comment', () => {
    const files = {
      '/src/screens/A.tsx': 'const x = "Nobody owes you"',
      '/src/screens/B.tsx': '/* "Nobody owes you" */\n// Sin entradas de stock\nconst y = 1',
      '/src/screens/emptyStates.ts': EMPTY_STATES.homeNobodyOwes,
    }
    expect(literalCopies(EMPTY_STATE_WORDINGS, files)).toEqual([
      { path: '/src/screens/A.tsx', wording: EMPTY_STATES.homeNobodyOwes },
    ])
  })

  test('a wording added to the list is enforced', () => {
    const files = { '/src/screens/A.tsx': '<span>Nada por acá</span>' }
    expect(literalCopies(EMPTY_STATE_WORDINGS, files)).toEqual([])
    expect(literalCopies([...EMPTY_STATE_WORDINGS, 'Nada por acá'], files)).toEqual([
      { path: '/src/screens/A.tsx', wording: 'Nada por acá' },
    ])
  })
})
