// @vitest-environment node
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decodeRgba,
  encodeWebp,
  NOT_STARTED,
  planPublish,
  UNSTABLE_NOTE,
  type IndexEntry,
  type NotStartedReason,
} from '../../../scripts/design/screenImages.mjs'
import {
  applyPlan,
  classify,
  exitCode,
  main,
  readCommitted,
  realFs,
  writeNotStarted,
} from '../../../scripts/design/screenImagesRun.mjs'

const registry = [
  { screen: 'a', route: '/a' },
  { screen: 'b', route: '/b' },
  { screen: 'dark', route: '/a', tema: 'dark' },
]

function png(color: [number, number, number, number], width = 6, height = 5): Buffer {
  const image = new PNG({ width, height })
  for (let i = 0; i < width * height; i++) image.data.set(color, i * 4)
  return PNG.sync.write(image)
}
const RED = png([255, 0, 0, 255])
const BLUE = png([0, 0, 255, 255])

let root: string
let built: string
let target: string
let out: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'screen-images-'))
  built = join(root, 'built')
  target = join(root, 'screens')
  out = join(root, 'out')
  mkdirSync(built)
  mkdirSync(out)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const entry = (screen: string, extra: Record<string, unknown> = {}): IndexEntry => ({
  screen,
  built: join(built, `${screen}.built.png`),
  notes: [],
  ...extra,
})
const put = (dir: string, name: string, data: Buffer | string) => writeFileSync(join(dir, name), data)
const names = (dir: string) => readdirSync(dir).sort()

async function planFor(index: IndexEntry[] | null, builtDir = built) {
  const changed = index === null ? new Map() : await classify({ index, builtDir, committedDir: target })
  return planPublish({ registry, committed: await readCommitted(target), index, changed, appStarted: true })
}

describe('readCommitted', () => {
  it('is empty when the folder is missing', async () => {
    expect(await readCommitted(join(root, 'nope'))).toEqual([])
  })

  it('lists every file name, dotfiles included', async () => {
    mkdirSync(target)
    put(target, '.gitkeep', '')
    put(target, 'a.webp', 'x')
    expect(await readCommitted(target)).toEqual(expect.arrayContaining(['.gitkeep', 'a.webp']))
  })
})

describe('classify', () => {
  it('says same for equal pixels and different for others, whatever the bytes', async () => {
    mkdirSync(target)
    put(built, 'a.built.png', RED)
    put(built, 'b.built.png', RED)
    put(target, 'a.webp', await encodeWebp(RED))
    put(target, 'b.webp', await encodeWebp(BLUE))
    const verdicts = await classify({ index: [entry('a'), entry('b')], builtDir: built, committedDir: target })
    expect([...verdicts]).toEqual([
      ['a', 'same'],
      ['b', 'different'],
    ])
  })

  it('says different for a committed image that is missing or corrupt, and unreadable-new for a bad built PNG', async () => {
    mkdirSync(target)
    put(built, 'a.built.png', RED)
    put(built, 'b.built.png', 'not a png')
    put(target, 'b.webp', 'not a webp')
    const verdicts = await classify({ index: [entry('a'), entry('b')], builtDir: built, committedDir: target })
    expect(verdicts.get('a')).toBe('different')
    expect(verdicts.get('b')).toBe('unreadable-new')
  })

  it('has no verdict for a row with no built PNG, and unreadable-new for one listed whose file is gone', async () => {
    const verdicts = await classify({ index: [entry('a', { built: null }), entry('b')], builtDir: built, committedDir: target })
    expect(verdicts.has('a')).toBe(false)
    expect(verdicts.get('b')).toBe('unreadable-new')
  })
})

describe('publishing against a folder', () => {
  it('writes a missing folder with the new images and nothing else', async () => {
    put(built, 'a.built.png', RED)
    put(built, 'b.built.png', BLUE)
    const plan = await planFor([entry('a'), entry('b')])
    for (const { file } of plan.write) put(out, file, await encodeWebp(file === 'a.webp' ? RED : BLUE))
    await applyPlan({ plan, outDir: out, targetDir: target })
    expect(names(target)).toEqual(['a.webp', 'b.webp'])
    expect(await decodeRgba(readFileSync(join(target, 'a.webp')))).toEqual(await decodeRgba(RED))
  })

  it('does not create the folder when nothing is written', async () => {
    await applyPlan({ plan: await planFor(null), outDir: out, targetDir: target })
    expect(() => readdirSync(target)).toThrow()
  })

  it('removes .gitkeep, a stray <row>.png and a leftover .tmp, and keeps an unchanged image', async () => {
    mkdirSync(target)
    const same = await encodeWebp(RED)
    put(target, 'a.webp', same)
    put(target, '.gitkeep', '')
    put(target, 'a.png', RED)
    put(target, '.b.webp.tmp', 'half')
    put(built, 'a.built.png', RED)
    put(built, 'b.built.png', BLUE)
    const plan = await planFor([entry('a'), entry('b')])
    expect(plan.remove).toEqual(['.b.webp.tmp', '.gitkeep', 'a.png'])
    put(out, 'b.webp', await encodeWebp(BLUE))
    await applyPlan({ plan, outDir: out, targetDir: target })
    expect(names(target)).toEqual(['a.webp', 'b.webp'])
    expect(readFileSync(join(target, 'a.webp')).equals(same)).toBe(true)
  })

  it('rewrites a corrupt committed webp', async () => {
    mkdirSync(target)
    put(target, 'a.webp', 'corrupt')
    put(built, 'a.built.png', RED)
    const plan = await planFor([entry('a'), entry('b', { built: null })])
    expect(plan.write).toEqual([{ file: 'a.webp', status: 'changed' }])
    put(out, 'a.webp', await encodeWebp(RED))
    await applyPlan({ plan, outDir: out, targetDir: target })
    expect(await decodeRgba(readFileSync(join(target, 'a.webp')))).toEqual(await decodeRgba(RED))
  })

  it('fails a row with an unreadable built PNG and keeps the old bytes', async () => {
    mkdirSync(target)
    const old = await encodeWebp(BLUE)
    put(target, 'a.webp', old)
    put(built, 'a.built.png', 'broken')
    put(built, 'b.built.png', RED)
    const plan = await planFor([entry('a'), entry('b')])
    expect(plan.failures).toEqual([{ row: 'a', reason: 'the built PNG could not be read' }])
    put(out, 'b.webp', await encodeWebp(RED))
    await applyPlan({ plan, outDir: out, targetDir: target })
    expect(readFileSync(join(target, 'a.webp')).equals(old)).toBe(true)
  })

  it('leaves the bytes of a failed row alone', async () => {
    mkdirSync(target)
    const old = await encodeWebp(BLUE)
    put(target, 'a.webp', old)
    put(built, 'a.built.png', RED)
    const plan = await planFor([entry('a', { notes: [UNSTABLE_NOTE] }), entry('b', { built: null })])
    expect(plan.failures.map((f) => f.row)).toEqual(['a', 'b'])
    await applyPlan({ plan, outDir: out, targetDir: target })
    expect(names(target)).toEqual(['a.webp'])
    expect(readFileSync(join(target, 'a.webp')).equals(old)).toBe(true)
  })

  it('an interrupted apply leaves the old files intact and no partial image; the next plan removes the .tmp', async () => {
    mkdirSync(target)
    const oldA = await encodeWebp(BLUE)
    const oldB = await encodeWebp(BLUE)
    put(target, 'a.webp', oldA)
    put(target, 'b.webp', oldB)
    put(built, 'a.built.png', RED)
    put(built, 'b.built.png', RED)
    const plan = await planFor([entry('a'), entry('b')])
    expect(plan.write.map((w) => w.file)).toEqual(['a.webp', 'b.webp'])
    put(out, 'a.webp', await encodeWebp(RED))
    put(out, 'b.webp', await encodeWebp(RED))
    let renames = 0
    const rename = vi.fn(async (from: string, to: string) => {
      renames += 1
      if (renames === 2) throw new Error('disk gone')
      await realFs.rename(from, to)
    })
    await expect(applyPlan({ plan, outDir: out, targetDir: target, fs: { ...realFs, rename } })).rejects.toThrow('disk gone')
    expect(readFileSync(join(target, 'b.webp')).equals(oldB)).toBe(true)
    expect(names(target)).toEqual(['.b.webp.tmp', 'a.webp', 'b.webp'])
    expect(readFileSync(join(target, 'a.webp')).equals(oldA)).toBe(false)
    expect(await decodeRgba(readFileSync(join(target, 'a.webp')))).toEqual(await decodeRgba(RED))
    const next = await planFor([entry('a'), entry('b')])
    expect(next.remove).toEqual(['.b.webp.tmp'])
  })
})

describe('writeNotStarted', () => {
  it.each(Object.keys(NOT_STARTED) as NotStartedReason[])('for %s writes the plan and the summary and touches no image', async (reason) => {
    mkdirSync(target)
    put(target, 'a.webp', 'keep me')
    const plan = await writeNotStarted({ outDir: out, reason, registry })
    expect(plan.appStarted).toBe(false)
    const written = JSON.parse(readFileSync(join(out, 'plan.json'), 'utf-8'))
    expect(written.appStarted).toBe(false)
    expect(written.reason).toBe(reason)
    expect(written.failures.map((f: { row: string }) => f.row)).toEqual(['a', 'b'])
    expect([written.write, written.remove]).toEqual([[], []])
    expect(readFileSync(join(out, 'summary.md'), 'utf-8')).toContain(NOT_STARTED[reason])
    expect(readFileSync(join(target, 'a.webp'), 'utf-8')).toBe('keep me')
    expect(names(target)).toEqual(['a.webp'])
  })

  it('works over the real registry when none is given', async () => {
    const plan = await writeNotStarted({ outDir: out, reason: 'docker-unavailable' })
    expect(plan.failures.length).toBeGreaterThan(50)
  })
})

describe('exitCode', () => {
  it('is 1 when the app did not start or a row failed, else 0', () => {
    expect(exitCode({ plan: { appStarted: false, failures: [] } })).toBe(1)
    expect(exitCode({ plan: { appStarted: true, failures: [{ row: 'a', reason: 'x' }] } })).toBe(1)
    expect(exitCode({ plan: { appStarted: true, failures: [] } })).toBe(0)
  })
})

describe('the command line', () => {
  const quiet = () => vi.spyOn(console, 'log').mockImplementation(() => undefined)

  function capture(dir: string, colors: Record<string, Buffer>) {
    mkdirSync(dir, { recursive: true })
    const index = Object.keys(colors).map((screen) => ({ screen, built: join(dir, `${screen}.built.png`), notes: [] }))
    for (const [screen, data] of Object.entries(colors)) put(dir, `${screen}.built.png`, data)
    put(dir, 'index.json', JSON.stringify(index))
  }

  it('compare turns a row that differs between two captures into an unstable failure', async () => {
    const log = quiet()
    capture(join(root, 'one'), { a: RED, b: RED })
    capture(join(root, 'two'), { a: RED, b: BLUE })
    const merged = join(root, 'merged.json')
    expect(await main(['compare', '--a', join(root, 'one'), '--b', join(root, 'two'), '--out', merged])).toBe(0)
    const index = JSON.parse(readFileSync(merged, 'utf-8'))
    expect(index[0].notes).toEqual([])
    expect(index[1].notes).toEqual([UNSTABLE_NOTE])
    expect(log).toHaveBeenCalledWith('rows differing between two captures: 1 of 2')
    expect(log).toHaveBeenCalledWith('  b')
    const plan = await planFor(index, join(root, 'one'))
    expect(plan.failures).toEqual([{ row: 'b', reason: UNSTABLE_NOTE }])
  })

  it('compare counts a row missing from the second capture as differing', async () => {
    quiet()
    capture(join(root, 'one'), { a: RED, b: RED })
    capture(join(root, 'two'), { a: RED })
    const merged = join(root, 'merged.json')
    await main(['compare', '--a', join(root, 'one'), '--b', join(root, 'two'), '--out', merged])
    expect(JSON.parse(readFileSync(merged, 'utf-8'))[1].notes).toEqual([UNSTABLE_NOTE])
  })

  it('plan, apply and exit-code publish a capture end to end', async () => {
    capture(built, { a: RED, b: BLUE })
    const registryFile = join(root, 'screens.json')
    put(root, 'screens.json', JSON.stringify({ screens: registry }))
    const args = ['--index', join(built, 'index.json'), '--built-dir', built, '--committed', target, '--out', out, '--registry', registryFile]
    expect(await main(['plan', ...args])).toBe(0)
    expect(names(out)).toEqual(['a.webp', 'b.webp', 'plan.json', 'summary.md'])
    expect(readFileSync(join(out, 'summary.md'), 'utf-8')).toContain('## New\n\n- a\n- b\n')
    expect(await main(['exit-code', '--out', out])).toBe(0)
    expect(await main(['apply', '--out', out, '--target', target])).toBe(0)
    expect(names(target)).toEqual(['a.webp', 'b.webp'])
  })

  it('plan with no index fails every row, changes nothing and exits 1 on exit-code', async () => {
    mkdirSync(target)
    put(target, 'a.webp', 'old')
    put(root, 'screens.json', JSON.stringify({ screens: registry }))
    const args = ['--index', join(root, 'missing.json'), '--built-dir', built, '--committed', target, '--out', out, '--registry', join(root, 'screens.json')]
    expect(await main(['plan', ...args])).toBe(0)
    expect(await main(['exit-code', '--out', out])).toBe(1)
    expect(await main(['apply', '--out', out, '--target', target])).toBe(0)
    expect(readFileSync(join(target, 'a.webp'), 'utf-8')).toBe('old')
  })

  it('refuses a reason it does not know and a missing --out', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await main(['not-started', '--reason', 'weather', '--out', out])).toBe(2)
    expect(error).toHaveBeenCalledWith(
      'screenImagesRun: not-started needs --reason docker-unavailable|image-unavailable|app-not-started',
    )
    expect(await main(['plan'])).toBe(2)
    expect(error).toHaveBeenCalledWith('screenImagesRun: --out is required')
  })
})
