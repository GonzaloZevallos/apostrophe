import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { HOME } from '../routes'

// The app icon (GH-493): one SVG, `web/public/icons/mark.svg`, and the PNGs
// `scripts/design/icons.mjs` renders from it. The test decodes what ships.
const PUBLIC = `${resolve(__dirname, '../../public')}/`
const ICONS = `${PUBLIC}icons/`
const INDEX_HTML = resolve(__dirname, '../../index.html')

const MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="#1E6B47"/><g fill="#FFFFFF"><path transform="translate(-8 -8) scale(1.12)" d="M60 24a20 20 0 0 1 20 20C80 68 66 86 42 94l-3-7C54 80 62 72 64 63.6A20 20 0 1 1 60 24Z"/></g></svg>'

type Pixel = { r: number; g: number; b: number; a: number }

const decode = (name: string): PNG => PNG.sync.read(readFileSync(`${ICONS}${name}`))

const pixel = (png: PNG, x: number, y: number): Pixel => {
  const at = (png.width * y + x) * 4
  const [r = -1, g = -1, b = -1, a = -1] = png.data.subarray(at, at + 4)
  return { r, g, b, a }
}

const GREEN: Pixel = { r: 0x1e, g: 0x6b, b: 0x47, a: 255 }
const WHITE: Pixel = { r: 255, g: 255, b: 255, a: 255 }

const corners = (png: PNG): Pixel[] => {
  const last = png.width - 1
  return [pixel(png, 0, 0), pixel(png, last, 0), pixel(png, 0, last), pixel(png, last, last)]
}

const centre = (png: PNG): Pixel => pixel(png, png.width >> 1, png.height >> 1)

// The farthest a white pixel lies from the centre, as a fraction of the side. The maskable
// safe zone is a circle of 0.4 of the side (the 80 % the platform guarantees).
const farthestWhite = (png: PNG): number => {
  let farthest = 0
  const mid = (png.width - 1) / 2
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const { r, g, b, a } = pixel(png, x, y)
      if (a > 0 && r > 200 && g > 200 && b > 200) {
        farthest = Math.max(farthest, Math.hypot(x - mid, y - mid) / png.width)
      }
    }
  }
  return farthest
}

const iconsJson = (): {
  source: string
  sha256: string
  icons: { file: string; size: number }[]
} => JSON.parse(readFileSync(`${ICONS}icons.json`, 'utf8'))

const manifest = (): {
  id: string
  name: string
  short_name: string
  icons: { src: string; sizes: string; type: string; purpose?: string }[]
} => JSON.parse(readFileSync(`${PUBLIC}manifest.webmanifest`, 'utf8'))

describe('mark.svg', () => {
  it('is the request markup, byte for byte', () => {
    expect(readFileSync(`${ICONS}mark.svg`, 'utf8')).toBe(MARK_SVG)
  })

  it('hashes to the value icons.json recorded when the PNGs were rendered', () => {
    const hash = createHash('sha256').update(readFileSync(`${ICONS}mark.svg`)).digest('hex')
    expect(iconsJson().sha256).toBe(hash)
  })
})

describe('icons.json', () => {
  it('records each output by name and size, and no PNG hash', () => {
    const recorded = iconsJson()
    expect(recorded.source).toBe('mark.svg')
    expect(recorded.icons).toEqual([
      { file: 'icon-192.png', size: 192 },
      { file: 'icon-512.png', size: 512 },
      { file: 'icon-maskable-512.png', size: 512 },
      { file: 'apple-touch-icon.png', size: 180 },
    ])
    expect(Object.keys(recorded).sort()).toEqual(['icons', 'sha256', 'source'])
    for (const entry of recorded.icons) expect(Object.keys(entry).sort()).toEqual(['file', 'size'])
  })

  it('matches the decoded size of every PNG', () => {
    for (const { file, size } of iconsJson().icons) {
      const png = decode(file)
      expect([png.width, png.height]).toEqual([size, size])
    }
  })
})

describe('the rounded-square icons', () => {
  it.each(['icon-192.png', 'icon-512.png'])('%s is transparent at its corner', (name) => {
    const png = decode(name)
    expect(pixel(png, 0, 0).a).toBe(0)
    expect(centre(png)).not.toMatchObject({ a: 0 })
  })

  it.each(['icon-192.png', 'icon-512.png'])('%s has the Yerba green and the white mark', (name) => {
    const png = decode(name)
    const mid = png.width >> 1
    // Below the apostrophe's bowl, still inside the rounded square: the green.
    expect(pixel(png, Math.round(png.width * 0.15), mid)).toEqual(GREEN)
    expect(pixel(png, Math.round(png.width * 0.5), Math.round(png.width * 0.3))).toEqual(WHITE)
  })
})

describe.each([
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
])('%s', (name, size) => {
  const png = decode(name)

  it(`is ${size} px`, () => {
    expect([png.width, png.height]).toEqual([size, size])
  })

  it('is opaque Yerba green at all four corners and white at the centre', () => {
    for (const corner of corners(png)) expect(corner).toEqual(GREEN)
    expect(centre(png)).toEqual(WHITE)
  })

  it('keeps every white pixel inside the 80 % safe zone', () => {
    expect(farthestWhite(png)).toBeLessThanOrEqual(0.4)
  })
})

describe('what the safe-zone check rejects', () => {
  it('measures a white pixel outside the circle', () => {
    const png = new PNG({ width: 100, height: 100 })
    for (let at = 0; at < png.data.length; at += 4) {
      png.data.set([0x1e, 0x6b, 0x47, 255], at)
    }
    png.data.set([255, 255, 255, 255], (100 * 2 + 2) * 4)
    expect(farthestWhite(png)).toBeGreaterThan(0.4)
  })
})

describe('no old blue', () => {
  it.each(['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'])(
    '%s has no pixel bluer than it is green',
    (name) => {
      const png = decode(name)
      for (let y = 0; y < png.height; y += 1) {
        for (let x = 0; x < png.width; x += 1) {
          const { g, b, a } = pixel(png, x, y)
          if (a > 0) expect(b).toBeLessThanOrEqual(g)
        }
      }
    },
  )
})

describe('the manifest', () => {
  it('keeps the installed app: id, name and short_name', () => {
    const { id, name, short_name: shortName } = manifest()
    // The installed identity is the app's root: the id is the Home path and never moves.
    expect([id, name, shortName]).toEqual([HOME, 'apostrophe', 'apostrophe'])
  })

  it('lists the PNG icons with their sizes, maskable only on the maskable one', () => {
    expect(manifest().icons).toEqual([
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ])
  })
})

describe('the page', () => {
  const html = readFileSync(INDEX_HTML, 'utf8')

  it('uses the SVG as the favicon, with the PNG as fallback', () => {
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/icons/mark.svg" />')
    expect(html).toContain('<link rel="icon" type="image/png" href="/icons/icon-192.png" />')
  })

  it('keeps the apple-touch-icon link', () => {
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />')
  })
})
