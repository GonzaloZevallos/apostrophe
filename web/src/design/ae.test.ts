import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PNG } from 'pngjs'
import { afterEach, describe, expect, it } from 'vitest'
import { ae, box, compareIndexes, decode, type IndexEntry } from '../../../scripts/design/ae.mjs'

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

describe('box', () => {
  it('is the bounding box of the differing pixels, by the same exact comparison as ae', () => {
    const changed = image(5, 4)
    changed.data.set([11, 20, 30, 255], (1 * 5 + 2) * 4) // (2,1)
    changed.data.set([10, 20, 30, 254], (3 * 5 + 4) * 4) // (4,3): alpha only
    expect(box(image(5, 4), changed)).toEqual({ x: 2, y: 1, width: 3, height: 3 })
  })

  it('is a 1x1 box for a single pixel', () => {
    const changed = image(3, 3)
    changed.data.set([0, 0, 0, 255], (2 * 3 + 0) * 4)
    expect(box(image(3, 3), changed)).toEqual({ x: 0, y: 2, width: 1, height: 1 })
  })

  it('is null for identical images', () => {
    expect(box(image(3, 2), image(3, 2))).toBeNull()
  })

  it('names both dimensions, and no box, on a size mismatch', () => {
    expect(box(image(3, 2), image(2, 3))).toEqual({
      ok: false,
      reason: 'size',
      a: { width: 3, height: 2 },
      b: { width: 2, height: 3 },
    })
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
  const entry = (
    screen: string,
    built: string | null,
    design: string | null,
    reasons?: { design?: string; built?: string },
  ): IndexEntry => ({
    screen,
    built,
    design,
    ...(reasons ? { capture: 'not-captured' as const, reasons } : {}),
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
    expect(result.lines).toContain('Inicio built: FAIL not compared — no reason recorded')
    expect(result.lines).toContain('Inicio design: AE 0')
  })

  it('reports a null on both sides of an old index and does not fail on it', () => {
    const none = [entry('Pronto', null, 'a/design')]
    const result = compareIndexes(none, none, null, load)
    expect(result.failed).toBe(false)
    expect(result.lines).toContain('Pronto built: not compared — no reason recorded')
  })

  describe('a side that was not captured', () => {
    const gone = 'shot: no built screen yet (built)'
    const unsettled = 'shot: did not settle (built)'

    it('fails a side that had an image before and has none after, with the reason of after', () => {
      const before = [entry('Inicio', 'a/built', 'a/design')]
      const after = [entry('Inicio', null, 'a/design', { built: unsettled })]
      const result = compareIndexes(before, after, null, load)
      expect(result.failed).toBe(true)
      expect(result.lines).toContain('Inicio built: FAIL not compared — shot: did not settle (built)')
    })

    it('fails that side whatever the after index says: capture captured, or reasons that do not fit', () => {
      const before = [entry('Inicio', 'a/built', 'a/design')]
      const lying = [{ screen: 'Inicio', built: null, design: 'a/design', capture: 'captured' as const }]
      expect(compareIndexes(before, lying, null, load).failed).toBe(true)
      const wrongSide = [entry('Inicio', null, 'a/design', { built: 'shot: did not settle (design)' })]
      const result = compareIndexes(before, wrongSide, null, load)
      expect(result.failed).toBe(true)
      expect(result.lines).toContain('Inicio built: FAIL not compared — no reason recorded')
    })

    it('does not fail a side with no image before and one after, and takes the reason of before', () => {
      const before = [entry('Inicio', null, 'a/design', { built: gone })]
      const after = [entry('Inicio', 'a/built', 'a/design')]
      const result = compareIndexes(before, after, null, load)
      expect(result.failed).toBe(false)
      expect(result.lines).toContain('Inicio built: not compared — shot: no built screen yet (built)')
      expect(result.lines).toContain('Inicio design: AE 0')
    })

    it('does not fail a side with none on either side, and prefers the reason of after', () => {
      const before = [entry('Inicio', null, 'a/design', { built: gone })]
      const after = [entry('Inicio', null, 'a/design', { built: unsettled })]
      const result = compareIndexes(before, after, null, load)
      expect(result.failed).toBe(false)
      expect(result.lines).toContain('Inicio built: not compared — shot: did not settle (built)')
      expect(compareIndexes(before, [entry('Inicio', null, 'a/design')], null, load).lines).toContain(
        'Inicio built: not compared — shot: no built screen yet (built)',
      )
    })

    it('prints no reason recorded for a reason with page text, a number or another side', () => {
      const poisons = [
        'shot: Cobrar 4500 (built)',
        'shot: did not settle (design)',
        'timeout en {"click":"Cobrar"}',
        'shot: could not take the shot (built) extra',
        '',
      ]
      for (const reason of poisons) {
        const none = [entry('Inicio', null, 'a/design', { built: reason })]
        const result = compareIndexes(none, none, null, load)
        expect(result.lines).toContain('Inicio built: not compared — no reason recorded')
        expect(result.lines.join('\n')).not.toContain(reason === '' ? 'shot:' : reason)
      }
    })

    it('never prints AE 0 on a not-compared line', () => {
      const cases: Array<[IndexEntry[], IndexEntry[]]> = [
        [[entry('A', 'a/built', 'a/design')], [entry('A', null, 'a/design', { built: unsettled })]],
        [[entry('A', null, 'a/design', { built: gone })], [entry('A', 'a/built', 'a/design')]],
        [[entry('A', null, null, { built: gone, design: unsettled })], [entry('A', null, null)]],
      ]
      for (const [before, after] of cases) {
        const lines = compareIndexes(before, after, null, load).lines.filter((line) => line.includes('not compared'))
        expect(lines.length).toBeGreaterThan(0)
        for (const line of lines) expect(line).not.toContain('AE 0')
      }
    })

    it('fails an entry missing from one index and from both', () => {
      const one = [entry('Inicio', null, null, { built: gone, design: unsettled })]
      expect(compareIndexes(one, [], null, load)).toEqual({
        lines: ['Inicio: FAIL missing in after'],
        failed: true,
      })
      expect(compareIndexes([], one, null, load).lines).toEqual(['Inicio: FAIL missing in before'])
      const neither = compareIndexes([], [], new Set(['Inicio']), load)
      expect(neither.failed).toBe(true)
      expect(neither.lines).toEqual(['Inicio: FAIL in neither index'])
    })
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

  it('prints exactly today\'s output, stderr and exit code without --box', () => {
    const changed = image(2, 2)
    changed.data.set([99, 98, 97, 255], 0)
    const result = run(output(image(2, 2)), output(changed))
    expect(result.stdout).toBe('Inicio built: AE 1\nInicio design: AE 0\n')
    expect(result.stderr).toBe('ae: the before/after differ, or could not be compared\n')
    expect(result.status).toBe(1)
    const same = output(image(2, 2))
    const clean = run(same, same)
    expect(clean.stdout).toBe('Inicio built: AE 0\nInicio design: AE 0\n')
    expect(clean.stderr).toBe('')
    expect(clean.status).toBe(0)
  })

  it('prints today\'s lines without --box for a size mismatch and a one-sided null', () => {
    const size = run(output(image(2, 2)), output(image(3, 3)))
    expect(size.stdout).toBe('Inicio built: FAIL different dimensions\nInicio design: AE 0\n')
    const gone = run(output(image(2, 2)), output(null))
    expect(gone.stdout).toBe('Inicio built: FAIL not compared — no reason recorded\nInicio design: AE 0\n')
  })

  it('--box adds the box of a differing side, coordinates only', () => {
    const changed = image(4, 3)
    changed.data.set([99, 98, 97, 255], (1 * 4 + 2) * 4)
    const result = run(output(image(4, 3)), output(changed), '--box')
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('Inicio built: AE 1 box x=2 y=1 w=1 h=1\n')
    expect(result.stdout).not.toMatch(/99|98|97/)
  })

  it('--box leaves an AE 0 line as it is', () => {
    const dir = output(image(2, 2))
    const result = run(dir, dir, '--box')
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('Inicio built: AE 0\nInicio design: AE 0\n')
  })

  it('--box prints both dimensions on a size mismatch and no box', () => {
    const result = run(output(image(2, 2)), output(image(3, 4)), '--box')
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('Inicio built: FAIL different dimensions before 2x2 after 3x4\n')
    expect(result.stdout).not.toMatch(/Inicio built.*box/)
  })

  it('exits 2 with usage when it is not given two directories', () => {
    const result = spawnSync('node', [SCRIPT], { encoding: 'utf-8' })
    expect(result.status).toBe(2)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('usage: ae.mjs <before-dir> <after-dir> [--only A,B]\n')
  })
})
