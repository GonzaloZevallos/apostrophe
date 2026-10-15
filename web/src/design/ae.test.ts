import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PNG } from 'pngjs'
import { afterEach, describe, expect, it } from 'vitest'
import { ae, compareIndexes, decode } from '../../../scripts/design/ae.mjs'

type Image = { width: number; height: number; data: Uint8Array }

function image(width: number, height: number, fill = [10, 20, 30, 255]): Image {
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) data.set(fill, i * 4)
  return { width, height, data }
}

function png(img: Image): Buffer {
  const out = new PNG({ width: img.width, height: img.height })
  out.data = Buffer.from(img.data)
  return PNG.sync.write(out)
}

describe('ae', () => {
  it('is 0 for equal images', () => {
    expect(ae(image(3, 2), image(3, 2))).toEqual({ ok: true, differing: 0 })
  })

  it('counts one changed pixel as 1, however many bytes of it changed', () => {
    const changed = image(3, 2)
    changed.data.set([11, 21, 31, 255], 4 * 4)
    expect(ae(image(3, 2), changed)).toEqual({ ok: true, differing: 1 })
  })

  it('has no fuzz: a difference of one in a single byte counts', () => {
    const changed = image(3, 2)
    changed.data[0] = 11
    expect(ae(image(3, 2), changed)).toEqual({ ok: true, differing: 1 })
  })

  it('is a failure, not 0, for images of different dimensions', () => {
    expect(ae(image(3, 2), image(2, 3))).toEqual({ ok: false, reason: 'size' })
    expect(ae(image(3, 2), image(3, 3))).toEqual({ ok: false, reason: 'size' })
  })
})

describe('decode', () => {
  it('reads a PNG into its dimensions and RGBA bytes', () => {
    const result = decode(png(image(2, 2)))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect([result.image.width, result.image.height]).toEqual([2, 2])
    expect(ae(result.image, image(2, 2))).toEqual({ ok: true, differing: 0 })
  })

  it('calls a garbage buffer unreadable', () => {
    expect(decode(Buffer.from('not a png at all'))).toEqual({ ok: false, reason: 'unreadable' })
  })
})

describe('compareIndexes', () => {
  const entry = (screen: string, built: string | null, design: string | null) => ({
    screen,
    built,
    design,
  })
  // Paths name an image; `load` answers from this table, like decode would from a file.
  const images: Record<string, Image> = {
    'a/built': image(2, 2),
    'a/design': image(2, 2),
    'b/built': image(2, 2),
    'b/design': image(2, 2),
    'c/built': image(2, 2, [200, 0, 0, 255]),
    'big/built': image(3, 3),
  }
  const load = (path: string) => {
    const found = images[path]
    return found ? { ok: true as const, image: found } : { ok: false as const, reason: 'unreadable' as const }
  }

  it('is clean and prints AE 0 per screen and side when both sides are equal', () => {
    const same = [entry('Inicio', 'a/built', 'a/design')]
    const result = compareIndexes(same, same, null, load)
    expect(result.failed).toBe(false)
    expect(result.lines).toEqual(['Inicio built: AE 0', 'Inicio design: AE 0'])
  })

  it('fails a screen missing on one side, in either direction', () => {
    const one = [entry('Inicio', 'a/built', 'a/design')]
    const missingAfter = compareIndexes(one, [], null, load)
    expect(missingAfter.failed).toBe(true)
    expect(missingAfter.lines.join('\n')).toMatch(/Inicio: FAIL missing in after/)
    const missingBefore = compareIndexes([], one, null, load)
    expect(missingBefore.failed).toBe(true)
    expect(missingBefore.lines.join('\n')).toMatch(/Inicio: FAIL missing in before/)
  })

  it('fails a null on one side only, never as AE 0', () => {
    const before = [entry('Inicio', 'a/built', 'a/design')]
    const after = [entry('Inicio', null, 'a/design')]
    const result = compareIndexes(before, after, null, load)
    expect(result.failed).toBe(true)
    expect(result.lines).toContain('Inicio built: FAIL no capture in after')
    expect(result.lines).toContain('Inicio design: AE 0')
  })

  it('reports a null on both sides and does not fail on it', () => {
    const none = [entry('Pronto', null, 'a/design')]
    const result = compareIndexes(none, none, null, load)
    expect(result.failed).toBe(false)
    expect(result.lines).toContain('Pronto built: no capture on either side')
  })

  it('fails a size mismatch and an unreadable image, and prints the AE of a changed one', () => {
    const before = [entry('Inicio', 'a/built', 'a/design')]
    const size = compareIndexes(before, [entry('Inicio', 'big/built', 'a/design')], null, load)
    expect(size.failed).toBe(true)
    expect(size.lines).toContain('Inicio built: FAIL different dimensions')

    const gone = compareIndexes(before, [entry('Inicio', 'nope/built', 'a/design')], null, load)
    expect(gone.failed).toBe(true)
    expect(gone.lines).toContain('Inicio built: FAIL unreadable image')

    const changed = compareIndexes(before, [entry('Inicio', 'c/built', 'a/design')], null, load)
    expect(changed.failed).toBe(true)
    expect(changed.lines).toContain('Inicio built: AE 4')
  })

  it('compares only the screens in `only`, and fails a name that is in neither index', () => {
    const before = [entry('A', 'a/built', 'a/design'), entry('B', 'a/built', 'a/design')]
    const after = [entry('A', 'a/built', 'a/design'), entry('B', 'c/built', 'a/design')]
    const onlyA = compareIndexes(before, after, new Set(['A']), load)
    expect(onlyA.failed).toBe(false)
    expect(onlyA.lines.join('\n')).not.toMatch(/^B/m)

    const typo = compareIndexes(before, after, new Set(['A', 'Typo']), load)
    expect(typo.failed).toBe(true)
    expect(typo.lines.join('\n')).toMatch(/Typo: FAIL in neither index/)
  })
})

describe('ae.mjs as a command', () => {
  const SCRIPT = resolve(__dirname, '../../../scripts/design/ae.mjs')
  const roots: string[] = []
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  })

  // A directory the way comparisons.mjs leaves it: PNGs and an index.json of absolute paths.
  function output(builtImage: Image | null): string {
    const dir = mkdtempSync(join(tmpdir(), 'ae-'))
    roots.push(dir)
    mkdirSync(dir, { recursive: true })
    const built = builtImage ? join(dir, 'Inicio.built.png') : null
    if (built && builtImage) writeFileSync(built, png(builtImage))
    const design = join(dir, 'Inicio.design.png')
    writeFileSync(design, png(image(2, 2)))
    writeFileSync(join(dir, 'index.json'), JSON.stringify([{ screen: 'Inicio', built, design }]))
    return dir
  }

  const run = (before: string, after: string, ...extra: string[]) =>
    spawnSync('node', [SCRIPT, before, after, ...extra], { encoding: 'utf-8' })

  it('gives AE 0 and exit 0 for a directory against itself', () => {
    const dir = output(image(2, 2))
    const result = run(dir, dir)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Inicio built: AE 0')
    expect(result.stdout).toContain('Inicio design: AE 0')
  })

  it('exits 1 on a changed pixel and prints the count, no pixel data', () => {
    const changed = image(2, 2)
    changed.data.set([99, 98, 97, 255], 0)
    const result = run(output(image(2, 2)), output(changed))
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('Inicio built: AE 1')
    expect(result.stdout).not.toMatch(/99|98|97/)
  })

  it('exits 1 on a size mismatch and on a one-sided null', () => {
    expect(run(output(image(2, 2)), output(image(3, 3))).status).toBe(1)
    expect(run(output(image(2, 2)), output(null)).status).toBe(1)
  })

  it('exits 1 on a screen missing from --only that is in neither index', () => {
    const dir = output(image(2, 2))
    expect(run(dir, dir, '--only', 'Inicio').status).toBe(0)
    expect(run(dir, dir, '--only', 'Nope').status).toBe(1)
  })

  it('exits 2 with usage when it is not given two directories', () => {
    expect(spawnSync('node', [SCRIPT], { encoding: 'utf-8' }).status).toBe(2)
  })
})
