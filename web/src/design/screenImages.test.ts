// @vitest-environment node
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import {
  containerArgs,
  decodeRgba,
  EFFORT,
  encodeWebp,
  NOT_STARTED,
  planPublish,
  playwrightImage,
  renderSummary,
  samePixels,
  UNSTABLE_NOTE,
  type Changed,
  type IndexEntry,
  type Plan,
} from '../../../scripts/design/screenImages.mjs'

// Rows: `a`, `b`, `c` get an image; `dark` (tema), `big` (text_scale), `computer` (wide viewport) and
// `unbuilt` (no route) do not; `setup` is only in the capture selection (`c` needs it).
const registry = [
  { screen: 'setup', route: '/setup', viewport: [1000, 800] },
  { screen: 'a', route: '/a' },
  { screen: 'b', route: '/b' },
  { screen: 'c', route: '/c', needs: 'setup' },
  { screen: 'dark', route: '/a', tema: 'dark' },
  { screen: 'big', route: '/a', text_scale: 2 },
  { screen: 'computer', route: '/a', viewport: [1200, 800] },
  { screen: 'unbuilt', route: null },
]

const entry = (screen: string, extra: Record<string, unknown> = {}): IndexEntry => ({
  screen,
  built: `/out/${screen}.built.png`,
  notes: [],
  ...extra,
})
const fullIndex = ['setup', 'a', 'b', 'c', 'dark', 'big', 'computer', 'unbuilt'].map((s) => entry(s))
const allDifferent = new Map<string, Changed>(['setup', 'a', 'b', 'c'].map((s) => [s, 'different']))
const run = (over: Partial<Parameters<typeof planPublish>[0]> = {}) =>
  planPublish({
    registry,
    committed: ['a.webp', 'b.webp', 'c.webp'],
    index: fullIndex,
    changed: allDifferent,
    appStarted: true,
    ...over,
  })

function png(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]): Buffer {
  const image = new PNG({ width, height })
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) image.data.set(pixel(x, y), (y * width + x) * 4)
  }
  return PNG.sync.write(image)
}
const gradient = (x: number, y: number): [number, number, number, number] => [x * 7, y * 9, (x + y) * 3, 255]

describe('planPublish', () => {
  it('writes only the rows that get an image, never a capture-only row', () => {
    const plan = run({ committed: [] })
    expect(plan.write).toEqual([
      { file: 'a.webp', status: 'new' },
      { file: 'b.webp', status: 'new' },
      { file: 'c.webp', status: 'new' },
    ])
    expect(plan.write.map((w) => w.file)).not.toContain('setup.webp')
  })

  it('marks a row that already has an image as changed', () => {
    expect(run({ committed: ['a.webp'] }).write[0]).toEqual({ file: 'a.webp', status: 'changed' })
  })

  it('removes every committed name that is not an image of a current row', () => {
    const plan = run({
      committed: ['a.webp', '.gitkeep', 'a.png', '.b.webp.tmp', 'gone.webp', 'setup.webp', 'dark.webp'],
    })
    expect(plan.remove).toEqual(['.b.webp.tmp', '.gitkeep', 'a.png', 'dark.webp', 'gone.webp', 'setup.webp'])
  })

  it('keeps a row whose decoded pixels are equal', () => {
    const plan = run({ changed: new Map<string, Changed>([...allDifferent, ['a', 'same']]) })
    expect(plan.keep).toEqual(['a'])
    expect(plan.write.map((w) => w.file)).toEqual(['b.webp', 'c.webp'])
  })

  it.each([
    ['has no index entry', fullIndex.filter((e) => e.screen !== 'a'), 'not in the index'],
    ['has no built PNG', fullIndex.map((e) => (e.screen === 'a' ? entry('a', { built: null }) : e)), 'no built PNG'],
    [
      'has no built PNG and a reason',
      fullIndex.map((e) => (e.screen === 'a' ? entry('a', { built: null, reasons: { built: 'step missed' } }) : e)),
      'no built PNG: step missed',
    ],
    [
      'has a failure note',
      fullIndex.map((e) => (e.screen === 'a' ? entry('a', { notes: ['lo construido no se pudo capturar: x'] }) : e)),
      'lo construido no se pudo capturar: x',
    ],
    [
      'was unstable between two captures',
      fullIndex.map((e) => (e.screen === 'a' ? entry('a', { notes: [UNSTABLE_NOTE] }) : e)),
      UNSTABLE_NOTE,
    ],
  ])('fails a row that %s and keeps its image', (_name, index, reason) => {
    const plan = run({ index })
    expect(plan.failures).toEqual([{ row: 'a', reason }])
    expect(plan.write.map((w) => w.file)).toEqual(['b.webp', 'c.webp'])
    expect(plan.remove).toEqual([])
    expect(plan.keep).not.toContain('a')
  })

  it('does not fail a row for a note that is information', () => {
    const index = fullIndex.map((e) => (e.screen === 'a' ? entry('a', { notes: ['built: settled on attempt 2 of 3 after fonts'] }) : e))
    expect(run({ index }).failures).toEqual([])
  })

  it('fails a row whose built PNG cannot be read, or was not compared', () => {
    const changed = new Map<string, Changed>([
      ['a', 'unreadable-new'],
      ['b', 'different'],
    ])
    expect(run({ changed }).failures).toEqual([
      { row: 'a', reason: 'the built PNG could not be read' },
      { row: 'c', reason: 'not compared with the committed image' },
    ])
  })

  it('with no index fails every row and changes nothing', () => {
    const plan = run({ index: null, committed: ['a.webp', 'old.webp'] })
    expect(plan.failures.map((f) => f.row)).toEqual(['a', 'b', 'c'])
    expect(plan.failures.every((f) => f.reason === 'no index')).toBe(true)
    expect([plan.write, plan.remove, plan.keep]).toEqual([[], [], []])
  })

  it('with the app not started changes nothing, and says why', () => {
    const plan = run({ appStarted: false, reason: 'docker-unavailable', committed: ['a.webp', 'old.webp'] })
    expect(plan.appStarted).toBe(false)
    expect([plan.write, plan.remove, plan.keep]).toEqual([[], [], []])
    expect(plan.failures.map((f) => f.row)).toEqual(['a', 'b', 'c'])
    expect(plan.failures[0].reason).toBe(NOT_STARTED['docker-unavailable'])
  })

  it('refuses a not-started reason it does not know', () => {
    expect(() => run({ appStarted: false, reason: 'whatever' as never })).toThrow('unknown reason "whatever"')
  })
})

describe('renderSummary', () => {
  const plan: Plan = {
    write: [
      { file: 'a.webp', status: 'new' },
      { file: 'b.webp', status: 'changed' },
    ],
    remove: ['old.webp'],
    keep: [],
    failures: [{ row: 'c', reason: 'no built PNG' }],
    appStarted: true,
  }
  const sizes = { 'a.webp': 100, 'b.webp': 250 }

  it('lists new, changed, removed and failed rows, each failed row with its reason', () => {
    const text = renderSummary({ plan, sizes, baseSha: null, mode: 'local' })
    expect(text).toContain('## New\n\n- a\n')
    expect(text).toContain('## Changed\n\n- b\n')
    expect(text).toContain('## Removed\n\n- old.webp\n')
    expect(text).toContain('## Failed\n\n- c: no built PNG\n')
  })

  it('says none for an empty list', () => {
    const empty: Plan = { write: [], remove: [], keep: [], failures: [], appStarted: true }
    expect(renderSummary({ plan: empty, sizes: {}, baseSha: null, mode: 'local' })).toContain('## Failed\n\n- none\n')
  })

  it('reports the total size and the size of each image', () => {
    const text = renderSummary({ plan, sizes, baseSha: null, mode: 'local' })
    expect(text).toContain('Total of docs/assets/screens/: 350 B in 2 images')
    expect(text).toContain('- a.webp: 100 B\n- b.webp: 250 B')
  })

  it('reports a total of zero for a missing folder', () => {
    expect(renderSummary({ plan, sizes: {}, baseSha: null, mode: 'local' })).toContain('0 B in 0 images')
  })

  it('in pr mode gives the base sha and the merge note, and in local mode neither', () => {
    const pr = renderSummary({ plan, sizes, baseSha: 'abc1234', mode: 'pr' })
    expect(pr).toContain('Base: abc1234')
    expect(pr).toContain('A listed change may come from a merge whose images are not committed yet.')
    const local = renderSummary({ plan, sizes, baseSha: 'abc1234', mode: 'local' })
    expect(local).not.toContain('abc1234')
    expect(local).not.toContain('merge')
  })

  it.each(Object.entries(NOT_STARTED))('for %s prints its fixed sentence', (reason, sentence) => {
    const notStarted = run({ appStarted: false, reason: reason as keyof typeof NOT_STARTED })
    const text = renderSummary({ plan: notStarted, sizes: {}, baseSha: null, mode: 'local' })
    expect(text).toContain(`${sentence}\n`)
    expect(text).toContain('- a: ')
  })

  it('pins the three sentences', () => {
    expect(NOT_STARTED).toEqual({
      'docker-unavailable': 'Docker is not available.',
      'image-unavailable': 'The Playwright image could not be pulled.',
      'app-not-started': 'The sample app did not start.',
    })
  })
})

describe('encoding', () => {
  it('encodes the same PNG twice to identical bytes', async () => {
    const source = png(40, 30, gradient)
    expect((await encodeWebp(source)).equals(await encodeWebp(source))).toBe(true)
  })

  it('writes a lossless webp with the fixed effort and no metadata', async () => {
    const webp = await encodeWebp(png(8, 8, gradient))
    expect(webp.subarray(0, 4).toString()).toBe('RIFF')
    expect(webp.subarray(8, 12).toString()).toBe('WEBP')
    expect(webp.subarray(12, 16).toString()).toBe('VP8L')
    expect(webp.includes('EXIF')).toBe(false)
    expect(webp.includes('ICCP')).toBe(false)
    expect(EFFORT).toBe(6)
  })

  it('round-trips to the PNG’s RGBA, translucent pixels included', async () => {
    const source = png(16, 12, (x, y) => (x === 3 && y === 4 ? [10, 20, 30, 128] : gradient(x, y)))
    const fromPng = await decodeRgba(source)
    const fromWebp = await decodeRgba(await encodeWebp(source))
    expect(fromWebp.width).toBe(16)
    expect(fromWebp.height).toBe(12)
    expect(fromWebp.data.length).toBe(16 * 12 * 4)
    expect(samePixels(fromPng, fromWebp)).toBe(true)
  })
})

describe('samePixels', () => {
  it('rejects a difference in size', async () => {
    const wide = await decodeRgba(png(10, 4, () => [1, 2, 3, 255]))
    const tall = await decodeRgba(png(4, 10, () => [1, 2, 3, 255]))
    expect(wide.data.length).toBe(tall.data.length)
    expect(samePixels(wide, tall)).toBe(false)
  })

  it('rejects a one-pixel difference', async () => {
    const one = await decodeRgba(png(10, 10, gradient))
    const other = await decodeRgba(png(10, 10, (x, y) => (x === 9 && y === 9 ? [0, 0, 0, 255] : gradient(x, y))))
    expect(samePixels(one, other)).toBe(false)
    expect(samePixels(one, await decodeRgba(png(10, 10, gradient)))).toBe(true)
  })
})

describe('playwrightImage', () => {
  it('derives the tag from the lockfile’s playwright version', () => {
    const lock = { packages: { 'node_modules/playwright': { version: '1.63.0' }, 'node_modules/playwright-core': { version: '9.9.9' } } }
    expect(playwrightImage(lock)).toBe('mcr.microsoft.com/playwright:v1.63.0-noble')
    expect(playwrightImage(JSON.stringify(lock))).toBe('mcr.microsoft.com/playwright:v1.63.0-noble')
  })

  it('throws when the lockfile has no playwright entry', () => {
    expect(() => playwrightImage({ packages: { 'node_modules/playwright-core': { version: '1.0.0' } } })).toThrow(
      'web/package-lock.json has no node_modules/playwright version',
    )
    expect(() => playwrightImage({})).toThrow('no node_modules/playwright version')
  })
})

describe('containerArgs', () => {
  const args = containerArgs({
    image: 'mcr.microsoft.com/playwright:v1.63.0-noble',
    repoDir: '/home/me/repo',
    uid: 1000,
    gid: 1001,
    factsPath: '/tmp/facts/sample.json',
    outDir: '/tmp/out',
    only: ['a', 'b', 'c'],
  })
  const mounts = args.flatMap((arg, i) => (args[i - 1] === '-v' ? [arg] : []))

  it('is exactly this argv', () => {
    expect(args).toEqual([
      '--rm',
      '--init',
      '--ipc=host',
      '--network',
      'host',
      '--user',
      '1000:1001',
      '-e',
      'HOME=/tmp',
      '-v',
      '/home/me/repo:/work/repo:ro',
      '-v',
      '/home/me/repo/web/node_modules:/work/node_modules:ro',
      '-v',
      '/tmp/facts/sample.json:/work/facts.json:ro',
      '-v',
      '/tmp/out:/out',
      '-w',
      '/work/repo',
      'mcr.microsoft.com/playwright:v1.63.0-noble',
      'node',
      'scripts/design/comparisons.mjs',
      '--built-only',
      '--facts',
      '/work/facts.json',
      '--out',
      '/out',
      '--only',
      'a,b,c',
    ])
  })

  it('mounts the checkout read-only and only the output folder read-write', () => {
    expect(mounts).toHaveLength(4)
    expect(mounts.filter((m) => !m.endsWith(':ro'))).toEqual(['/tmp/out:/out'])
    expect(mounts).toContain('/home/me/repo:/work/repo:ro')
  })

  it('has no mount target inside the checkout', () => {
    const targets = mounts.map((m) => m.split(':')[1])
    expect(targets).toEqual(['/work/repo', '/work/node_modules', '/work/facts.json', '/out'])
    for (const target of targets.slice(1)) expect(target.startsWith('/work/repo/')).toBe(false)
  })
})
