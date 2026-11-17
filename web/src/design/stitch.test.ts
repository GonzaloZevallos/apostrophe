import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { scrollPlan, type ScrollFrame } from '../../../scripts/design/shot.mjs'
import { stitch } from '../../../scripts/design/stitch.mjs'

const WIDTH = 4

// A page as a PNG whose every row has its own colour, so a row copied twice or never is visible.
function page(deviceHeight: number, deviceWidth: number): PNG {
  const out = new PNG({ width: deviceWidth, height: deviceHeight })
  for (let row = 0; row < deviceHeight; row++) {
    for (let column = 0; column < deviceWidth; column++) {
      out.data.set([row % 256, Math.floor(row / 256) % 256, column, 255], (row * deviceWidth + column) * 4)
    }
  }
  return out
}

// What the browser's screenshot at a scroll offset is: the viewport's window onto the page.
function screenshot(source: PNG, offset: number, viewportHeight: number, dpr: number): Buffer {
  const height = viewportHeight * dpr
  const out = new PNG({ width: source.width, height })
  const from = offset * dpr * source.width * 4
  source.data.copy(out.data, 0, from, from + height * source.width * 4)
  return PNG.sync.write(out)
}

function frames(source: PNG, plan: ScrollFrame[], viewportHeight: number, dpr: number): Buffer[] {
  return plan.map((frame) => screenshot(source, frame.offset, viewportHeight, dpr))
}

function planOf(scrollHeight: number, viewportHeight: number, dpr: number, boundaries: number[] = []): ScrollFrame[] {
  const planned = scrollPlan({ scrollHeight }, { width: WIDTH, height: viewportHeight }, dpr, undefined, boundaries, 'built')
  if (!('frames' in planned)) throw new Error('fixture plan refused')
  return planned.frames
}

describe('stitch', () => {
  it.each([1, 2, 3])(
    'copies every row of a page that ends at 1234.5 CSS px exactly once (dpr %i)',
    (dpr) => {
      // The document's scrollHeight is a whole number: 1234.5 rounds up to 1235.
      const source = page(1235 * dpr, WIDTH * dpr)
      const plan = planOf(1235, 600, dpr)
      expect(plan.length).toBe(3)
      const out = PNG.sync.read(stitch(frames(source, plan, 600, dpr), plan, dpr))
      expect(out.width).toBe(WIDTH * dpr)
      expect(out.height).toBe(1235 * dpr)
      expect(Buffer.compare(out.data, source.data)).toBe(0)
    },
  )

  it('copies the rows between sticky boundaries once, with frames of different lengths', () => {
    const source = page(1000 * 2, WIDTH * 2)
    const plan = planOf(1000, 600, 2, [250.7, 700])
    expect(plan.map((frame) => frame.cropHeight)).toEqual([500, 900, 600])
    const out = PNG.sync.read(stitch(frames(source, plan, 600, 2), plan, 2))
    expect(Buffer.compare(out.data, source.data)).toBe(0)
  })

  it('is one frame for a short page, whole', () => {
    const source = page(600, WIDTH)
    const plan = planOf(300, 600, 1)
    const out = PNG.sync.read(stitch(frames(source, plan, 600, 1), plan, 1))
    expect(out.height).toBe(600)
    expect(Buffer.compare(out.data, source.data)).toBe(0)
  })

  it('copies only the rows of a clip', () => {
    const source = page(2000, WIDTH)
    const planned = scrollPlan(
      { scrollHeight: 2000 },
      { width: WIDTH, height: 600 },
      1,
      { x: 0, y: 700, width: WIDTH, height: 1300 },
      [],
      'built',
    )
    if (!('frames' in planned)) throw new Error('fixture plan refused')
    const out = PNG.sync.read(stitch(frames(source, planned.frames, 600, 1), planned.frames, 1))
    expect(out.height).toBe(1300)
    expect(Buffer.compare(out.data, source.data.subarray(700 * WIDTH * 4))).toBe(0)
  })

  const whole: ScrollFrame = { offset: 0, cropTop: 0, cropHeight: 600 }
  const one = (): { shots: Buffer[]; plan: ScrollFrame[] } => ({ shots: frames(page(600, WIDTH), [whole], 600, 1), plan: [whole] })

  it('throws on a device scale factor, offset, crop top or crop height that is not a whole number', () => {
    const { shots, plan } = one()
    expect(() => stitch(shots, plan, 1.5)).toThrow('stitch: the device scale factor is not a whole number')
    expect(() => stitch(shots, [{ ...whole, offset: 0.5 }], 1)).toThrow('stitch: an offset is not a whole number')
    expect(() => stitch(shots, [{ ...whole, cropTop: 0.5 }], 1)).toThrow('stitch: a crop top is not a whole number')
    expect(() => stitch(shots, [{ ...whole, cropHeight: 599.5 }], 1)).toThrow(
      'stitch: a crop height is not a whole number',
    )
  })

  it('throws on a plan that does not match its frames', () => {
    const { shots, plan } = one()
    expect(() => stitch(shots, [...plan, ...plan], 1)).toThrow('stitch: the frames and the plan differ in count')
    expect(() => stitch(shots, [{ offset: 0, cropTop: 100, cropHeight: 600 }], 1)).toThrow(
      'stitch: a crop lies outside its frame',
    )
    expect(() => stitch(shots, [{ offset: 0, cropTop: -1, cropHeight: 10 }], 1)).toThrow(
      'stitch: a crop lies outside its frame',
    )
  })

  it('throws on frames of different widths', () => {
    const { shots } = one()
    const wider = PNG.sync.write(new PNG({ width: WIDTH + 1, height: 600 }))
    expect(() => stitch([...shots, wider], [whole, whole], 1)).toThrow('stitch: the frames differ in width')
  })

  it('crops every frame to the columns of the plan, rows and columns copied exactly once', () => {
    // dpr 2: a page 8 device px wide, a section from CSS px 1 to 3 (device columns 2 to 6).
    const source = page(1200, 8)
    const planned = scrollPlan(
      { scrollHeight: 600 },
      { width: 4, height: 300 },
      2,
      { x: 1.2, y: 100.5, width: 1.3, height: 400, right: 2.5, bottom: 500.5 },
      [],
      'built',
    )
    if (!('frames' in planned)) throw new Error('fixture plan refused')
    expect(planned.frames.every((frame) => frame.cropLeft === 2 && frame.cropWidth === 4)).toBe(true)
    const out = PNG.sync.read(stitch(frames(source, planned.frames, 300, 2), planned.frames, 2))
    expect(out.width).toBe(4)
    expect(out.height).toBe((501 - 100) * 2)
    for (let row = 0; row < out.height; row++) {
      for (let column = 0; column < out.width; column++) {
        const at = (row * out.width + column) * 4
        const sourceRow = 200 + row
        expect([...out.data.subarray(at, at + 3)]).toStrictEqual([sourceRow % 256, Math.floor(sourceRow / 256), column + 2])
      }
    }
  })

  it('crops a section at dpr 1 to its columns and rows, each copied exactly once', () => {
    // dpr 1: a page 8 px wide, a section from CSS px 1 to 3 (columns 1 to 3), rows 100 to 501 over two frames.
    const source = page(1200, 8)
    const planned = scrollPlan(
      { scrollHeight: 600 },
      { width: 4, height: 300 },
      1,
      { x: 1.2, y: 100.5, width: 1.3, height: 400, right: 2.5, bottom: 500.5 },
      [],
      'built',
    )
    if (!('frames' in planned)) throw new Error('fixture plan refused')
    expect(planned.frames.length).toBe(2)
    expect(planned.frames.every((frame) => frame.cropLeft === 1 && frame.cropWidth === 2)).toBe(true)
    const out = PNG.sync.read(stitch(frames(source, planned.frames, 300, 1), planned.frames, 1))
    expect(out.width).toBe(2)
    expect(out.height).toBe(501 - 100)
    for (let row = 0; row < out.height; row++) {
      for (let column = 0; column < out.width; column++) {
        const at = (row * out.width + column) * 4
        const sourceRow = 100 + row
        expect([...out.data.subarray(at, at + 3)]).toStrictEqual([sourceRow % 256, Math.floor(sourceRow / 256), column + 1])
      }
    }
  })

  it('throws on columns that are not whole, differ between frames, are missing on some, or lie outside', () => {
    const { shots } = one()
    const columned: ScrollFrame = { ...whole, cropLeft: 1, cropWidth: 2 }
    expect(() => stitch(shots, [{ ...columned, cropLeft: 0.5 }], 1)).toThrow('stitch: a crop left is not a whole number')
    expect(() => stitch(shots, [{ ...columned, cropWidth: 1.5 }], 1)).toThrow('stitch: a crop width is not a whole number')
    expect(() => stitch([...shots, ...shots], [columned, whole], 1)).toThrow('stitch: only some frames have columns')
    expect(() => stitch([...shots, ...shots], [columned, { ...columned, cropLeft: 0 }], 1)).toThrow(
      'stitch: the frames differ in columns',
    )
    expect(() => stitch(shots, [{ ...columned, cropLeft: 3 }], 1)).toThrow('stitch: the columns lie outside the frames')
  })
})
