/**
 * The two offender lists (GH-379 part 2, ADR-0049): `copyExportsText.json` names each copy file
 * that still holds words of its own, `copyImports.json` each screen, shell or component file that
 * imports such words. Both are recomputed from the tree and must equal the files, byte for byte;
 * an area part (#350-#353) shrinks them by deleting only its own entries. The checks run first on
 * inputs they must reject.
 */

import { describe, expect, test } from 'vitest'
import exportsRaw from './copyExportsText.json?raw'
import importsRaw from './copyImports.json?raw'
import { COPY_OWNER, NO_OWNER_REASON, ownerProblems } from './owners'
import {
  computeCopyExportsText,
  computeCopyImports,
  copyFindings,
  copyModules,
  listProblems,
  serializeList,
  type ExportsEntry,
  type ImportsEntry,
} from './scan'

describe('ownerProblems', () => {
  const files = ['a.ts', 'b.ts']

  test('passes a table that names every file once, with a reason for each none', () => {
    expect(ownerProblems({ 'a.ts': 350, 'b.ts': 'none' }, { 'b.ts': 'only keys' }, files)).toEqual([])
  })

  test('rejects a file with no owner, a file that is gone and a none with no reason', () => {
    const owner = { 'a.ts': 'none', 'gone.ts': 351 } as const
    expect(ownerProblems(owner, {}, files)).toEqual(['no owner: b.ts', 'gone: gone.ts', 'no reason for none: a.ts'])
  })

  test('rejects a reason that is blank, and a reason for a file that is not none', () => {
    expect(ownerProblems({ 'a.ts': 350, 'b.ts': 'none' }, { 'b.ts': ' ', 'a.ts': 'why' }, files)).toEqual([
      'no reason for none: b.ts',
      'reason for a file that has an owner: a.ts',
    ])
  })
})

describe('COPY_OWNER', () => {
  test('is total over the copy files and holds none that is gone', () => {
    expect(ownerProblems(COPY_OWNER, NO_OWNER_REASON, Object.keys(copyModules()))).toEqual([])
  })

  test('leaves out the files that hold no words of their own to own', () => {
    expect(Object.keys(COPY_OWNER)).not.toContain('limits.ts')
    expect(Object.keys(COPY_OWNER)).not.toContain('baselineArgs.ts')
    expect(Object.keys(COPY_OWNER).some((file) => file.endsWith('.test.ts'))).toBe(false)
  })
})

const exportsList = (...entries: ExportsEntry[]): ExportsEntry[] => entries
const importsList = (...entries: ImportsEntry[]): ImportsEntry[] => entries

describe('listProblems on copyExportsText entries', () => {
  const computed = exportsList({ file: 'a.ts', issue: 350 }, { file: 'b.ts', issue: 351 })

  test('passes a list equal to the computed one', () => {
    expect(listProblems(computed, computed)).toEqual([])
  })

  test('rejects an offender with no entry, naming the line to add', () => {
    expect(listProblems([{ file: 'a.ts', issue: 350 }], computed)).toEqual(['missing entry: {"file":"b.ts","issue":351}'])
  })

  test('rejects a stale entry, a deleted file included, naming the line to remove', () => {
    const recorded = exportsList(...computed, { file: 'gone.ts', issue: 352 })
    expect(listProblems(recorded, computed)).toEqual(['stale entry: {"file":"gone.ts","issue":352}'])
  })

  test('rejects an issue that differs from the owner table', () => {
    const recorded = exportsList({ file: 'a.ts', issue: 353 }, { file: 'b.ts', issue: 351 })
    expect(listProblems(recorded, computed)).toEqual(['wrong issue: a.ts has 353 but COPY_OWNER says 350'])
  })

  test('rejects a null issue anywhere but common.ts', () => {
    const recorded = exportsList({ file: 'a.ts', issue: null, reason: 'why' }, { file: 'b.ts', issue: 351 })
    expect(listProblems(recorded, computed)).toEqual([
      'null issue: {"file":"a.ts","issue":null,"reason":"why"}',
      'wrong issue: a.ts has null but COPY_OWNER says 350',
    ])
  })

  test('lets common.ts hold a null issue with its reason', () => {
    const common = exportsList({ file: 'common.ts', issue: null, reason: 'kept equal to its keys' })
    expect(listProblems(common, common)).toEqual([])
  })
})

describe('listProblems on copyImports entries', () => {
  const computed = importsList(
    { file: 'src/screens/A.tsx', imports: ['sales.ts', 'stock.ts'], issue: 351 },
    { file: 'src/screens/A.tsx', imports: ['auth.ts'], issue: 350 },
  )

  test('passes a list equal to the computed one', () => {
    expect(listProblems(computed, computed)).toEqual([])
  })

  test('rejects an import the entry does not name: the pair is missing and the old one stale', () => {
    const recorded = importsList(computed[0] as ImportsEntry, { file: 'src/screens/A.tsx', imports: ['auth.ts', 'onboarding.ts'], issue: 350 })
    expect(listProblems(recorded, computed)).toEqual([
      'stale entry: {"file":"src/screens/A.tsx","imports":["auth.ts","onboarding.ts"],"issue":350}',
      'missing entry: {"file":"src/screens/A.tsx","imports":["auth.ts"],"issue":350}',
    ])
  })

  test('rejects an issue that differs from the owner of the imported files', () => {
    const recorded = importsList({ file: 'src/screens/A.tsx', imports: ['sales.ts', 'stock.ts'], issue: 352 }, computed[1] as ImportsEntry)
    expect(listProblems(recorded, computed)).toEqual(['wrong issue: src/screens/A.tsx [sales.ts,stock.ts] has 352 but COPY_OWNER says 351'])
  })

  test('rejects a null issue on an import entry, common.ts or not', () => {
    const recorded = importsList(computed[0] as ImportsEntry, { file: 'src/screens/A.tsx', imports: ['auth.ts'], issue: null })
    expect(listProblems(recorded, computed)).toEqual([
      'null issue: {"file":"src/screens/A.tsx","imports":["auth.ts"],"issue":null}',
      'wrong issue: src/screens/A.tsx [auth.ts] has null but COPY_OWNER says 350',
    ])
  })
})

describe('serializeList', () => {
  test('writes one entry per line, two-space indent and a trailing newline', () => {
    expect(serializeList([{ file: 'a.ts', issue: 350 }, { file: 'b.ts', issue: 351 }])).toBe('[\n  {"file":"a.ts","issue":350},\n  {"file":"b.ts","issue":351}\n]\n')
  })

  test('writes an empty list as []', () => {
    expect(serializeList([])).toBe('[]\n')
  })
})

describe('the real tree', () => {
  test('wordsOf finds no unresolved key, no unusable key and no unreadable export in any copy file', () => {
    expect(copyFindings()).toEqual([])
  })

  test('copyExportsText.json is the list of copy files that hold words, as the tree computes it', () => {
    const recorded = JSON.parse(exportsRaw) as ExportsEntry[]
    const computed = computeCopyExportsText()
    expect(listProblems(recorded, computed)).toEqual([])
    expect(exportsRaw, `copyExportsText.json must read exactly:\n${serializeList(computed)}`).toBe(serializeList(computed))
  })

  test('copyImports.json is the list of files that import those words, as the tree computes it', async () => {
    const recorded = JSON.parse(importsRaw) as ImportsEntry[]
    const computed = await computeCopyImports()
    expect(listProblems(recorded, computed)).toEqual([])
    expect(importsRaw, `copyImports.json must read exactly:\n${serializeList(computed)}`).toBe(serializeList(computed))
  })

  test('no entry is for common.ts or emptyStates.ts imports, and common.ts is the only null issue', () => {
    const imports = JSON.parse(importsRaw) as ImportsEntry[]
    expect(imports.flatMap((entry) => entry.imports).filter((file) => file === 'common.ts' || file === 'emptyStates.ts')).toEqual([])
    const nulls = (JSON.parse(exportsRaw) as ExportsEntry[]).filter((entry) => entry.issue === null).map((entry) => entry.file)
    expect(nulls.every((file) => file === 'common.ts')).toBe(true)
    expect(imports.every((entry) => entry.issue !== null)).toBe(true)
  })
})
