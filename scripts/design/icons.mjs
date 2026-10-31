// The app icons (GH-493). `web/public/icons/mark.svg` is the only source of the Yerba mark; this
// script renders the PNG icons from it with Playwright's Chromium, offline, and writes
// `web/public/icons/icons.json` (the SHA-256 of the SVG and each output's name and size, no PNG
// hash: Chromium's output bytes are not stable). It never edits the SVG's markup: the file is
// handed to an <img> as it is.
//
// Run from `web/`: `npm run icons`. If Chromium cannot launch the script stops with its error;
// a PNG is never edited by hand.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const ICONS = join(REPO, 'web', 'public', 'icons')
const require = createRequire(join(REPO, 'web', 'package.json'))
const { chromium } = require('playwright')
const { PNG } = require('pngjs')

// The Yerba green: the mark's own ground, read from the rounded square's fill in mark.svg so the
// script never carries a second copy. Maskable and apple-touch icons fill their page with it.
const GREEN = /<rect[^>]*\bfill="(#[0-9A-Fa-f]{6})"/.exec(readFileSync(join(ICONS, 'mark.svg'), 'utf8'))?.[1]
if (GREEN === undefined) throw new Error('mark.svg has no rounded square with a hex fill')
// The safe zone of a maskable icon: every white pixel inside a circle of 0.4 of the side (80 %).
const SAFE_RADIUS = 0.4

// What to draw: `ground` is the page colour (null = transparent), `fit` scales the mark into the
// safe zone.
const OUTPUTS = [
  { file: 'icon-192.png', size: 192, ground: null, fit: false },
  { file: 'icon-512.png', size: 512, ground: null, fit: false },
  { file: 'icon-maskable-512.png', size: 512, ground: GREEN, fit: true },
  { file: 'apple-touch-icon.png', size: 180, ground: GREEN, fit: true },
]

const pageFor = (dataUrl, size, ground, scale) => `<!doctype html>
<html><head><style>
  html, body { margin: 0; padding: 0; width: ${size}px; height: ${size}px; overflow: hidden;
    background: ${ground ?? 'transparent'}; }
  img { position: absolute; left: ${(size * (1 - scale)) / 2}px; top: ${(size * (1 - scale)) / 2}px;
    width: ${size * scale}px; height: ${size * scale}px; }
</style></head><body><img id="mark" src="${dataUrl}"></body></html>`

// The farthest a white pixel lies from the centre, as a fraction of the side.
function farthestWhite(png) {
  let farthest = 0
  const mid = (png.width - 1) / 2
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const at = (png.width * y + x) * 4
      const [r, g, b, a] = [png.data[at], png.data[at + 1], png.data[at + 2], png.data[at + 3]]
      if (a > 0 && r > 200 && g > 200 && b > 200) {
        farthest = Math.max(farthest, Math.hypot(x - mid, y - mid) / png.width)
      }
    }
  }
  return farthest
}

async function render(browser, dataUrl, { size, ground }, scale) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  try {
    await page.setContent(pageFor(dataUrl, size, ground, scale))
    await page.evaluate(() => document.getElementById('mark').decode())
    return await page.screenshot({ omitBackground: ground === null, type: 'png' })
  } finally {
    await page.close()
  }
}

// The scale that puts the mark's white inside the safe zone: 1 when it already fits.
async function safeScale(browser, dataUrl, output) {
  const full = PNG.sync.read(await render(browser, dataUrl, output, 1))
  const farthest = farthestWhite(full)
  return farthest <= SAFE_RADIUS ? 1 : (SAFE_RADIUS * 0.98) / farthest
}

const svg = readFileSync(join(ICONS, 'mark.svg'))
const dataUrl = `data:image/svg+xml;base64,${svg.toString('base64')}`

const browser = await chromium.launch()
try {
  for (const output of OUTPUTS) {
    const scale = output.fit ? await safeScale(browser, dataUrl, output) : 1
    writeFileSync(join(ICONS, output.file), await render(browser, dataUrl, output, scale))
  }
} finally {
  await browser.close()
}

const record = {
  source: 'mark.svg',
  sha256: createHash('sha256').update(svg).digest('hex'),
  icons: OUTPUTS.map(({ file, size }) => ({ file, size })),
}
writeFileSync(join(ICONS, 'icons.json'), `${JSON.stringify(record, null, 2)}\n`)
