import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, type Browser, type BrowserContext } from 'playwright'
import { PNG } from 'pngjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SETTLE_ADVANCE_MS } from '../../../scripts/design/settle.mjs'
import { CALM_CONTEXT, CAPTURE_SCALE, named } from '../../../scripts/design/shot.mjs'
import { addProbe, configureShot, pauseClock, settle, takeShot } from '../../../scripts/design/take-shot.mjs'

// The seam: `takeShot(page, { block, ofFirstText, census, side })` in `scripts/design/take-shot.mjs`,
// driven by Playwright over `setContent` fixtures and judged on the colour bands of the stitched PNG.
// The fixtures live here and never in `screens.json`: each is a few solid bands, so a row drawn twice or
// never is a wrong colour at a known place.
//
// The step bound every case runs at: the same one the census test uses (`web/src/design/census.test.ts`):
// one page load starved of CPU takes 8 to 20 s beside the other workers, and 60 s is 3 times that.
const CENSUS_STEP_MS = 60_000
// The ceiling of one case: max(180000, 2 x slowest case, slowest case + CENSUS_STEP_MS) by the census
// rule. Measured 2026-11-07 (two runs of `vitest run src/design/take-shot.test.ts` beside `pytest -n 8` and
// `npm run typecheck` in loops, load average 17 to 20): slowest case 2455 ms ('refuses a page that jumps
// on a repeating timer'), the file 15.9 to 16.1 s in all. max(180000, 4910, 62455) = 180000, so the 180 s
// floor sets it. If a loaded run breaks it, cut fixtures; never loosen a bound.
const TAKE_SHOT_TEST_MS = 180_000

const VIEWPORT = { width: 375, height: 812 }
const FONT = resolve(__dirname, '../../node_modules/@fontsource/geist/files/geist-latin-400-normal.woff2')
const FACES = [400, 500, 600, 700]
  .map(
    (weight) =>
      `@font-face{font-family:'Geist';font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(FONT).toString('base64')}) format('woff2')}`,
  )
  .join('')

// A page of solid bands. `bands` are `[height, colour]` in CSS px, drawn in order.
const bands = (...list: Array<[number, string]>): string =>
  list.map(([height, colour]) => `<div style="height:${height}px;background:${colour}"></div>`).join('')

const html = (body: string, head = ''): string =>
  `<!doctype html><meta charset="utf-8"><style>${FACES}html,body{margin:0}body{font-family:'Geist',sans-serif}</style>${head}${body}`

const RED = '#ff0000'
const GREEN = '#00ff00'
const BLUE = '#0000ff'
const PURPLE = '#800080'
const ORANGE = '#ff8000'

let browser: Browser

beforeAll(async () => {
  browser = await chromium.launch()
  configureShot({ timeoutMs: CENSUS_STEP_MS, instant: new Date('2026-09-16T12:00:00-03:00') })
})

afterAll(async () => {
  await browser.close()
})

async function context(scale: number = CAPTURE_SCALE): Promise<BrowserContext> {
  const made = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: scale, ...CALM_CONTEXT })
  await pauseClock(made)
  await addProbe(made)
  return made
}

// One fixture, one fresh context: its settled page, then the shot.
async function shoot(markup: string, block: string | null = null, scale: number = CAPTURE_SCALE) {
  const made = await context(scale)
  try {
    const page = await made.newPage()
    await page.setContent(markup)
    const first = await settle(page, { advanceMs: SETTLE_ADVANCE_MS, afterGoto: true, ofFirstText: false })
    expect(first).toBeNull()
    return await takeShot(page, { block: block === null ? null : page.locator(block), ofFirstText: false, census: null, side: 'built' })
  } finally {
    await made.close()
  }
}

type Rgb = [number, number, number]
const rgb = (hex: string): Rgb => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)) as Rgb

// The colour at a CSS y (the middle of the row's device pixels), in the middle of the width.
function colourAt(png: PNG, cssY: number, scale: number = CAPTURE_SCALE): Rgb {
  const at = (Math.floor(cssY * scale) * png.width + Math.floor(png.width / 2)) * 4
  return [png.data[at] ?? -1, png.data[at + 1] ?? -1, png.data[at + 2] ?? -1]
}

function decode(shot: { png: Buffer | null; failure: string | null }): PNG {
  expect(shot.failure).toBeNull()
  if (shot.png === null) throw new Error('no PNG')
  return PNG.sync.read(shot.png)
}

const changed = named('the page changed while it was shot', 'built')

describe('takeShot on a phone page (scroll and stitch)', () => {
  it('refuses a page that jumps on its first scroll', async () => {
    const shot = await shoot(
      html(
        `<div id="hero" style="height:600px;background:${RED}"></div>${bands([1400, GREEN])}
         <script>addEventListener('scroll', () => { document.getElementById('hero').style.height = '900px' }, { once: true })</script>`,
      ),
    )
    expect(shot).toEqual({ png: null, failure: changed })
  }, TAKE_SHOT_TEST_MS)

  it('refuses a page that jumps on a repeating timer', async () => {
    const shot = await shoot(
      html(
        `<div id="hero" style="height:600px;background:${RED}"></div>${bands([1400, GREEN])}
         <script>let tick = 0
         setInterval(() => { if (scrollY > 0) document.getElementById('hero').style.height = 600 + (tick += 1) + 'px' }, 10)</script>`,
      ),
    )
    expect(shot.png).toBeNull()
    expect(shot.failure).not.toBeNull()
  }, TAKE_SHOT_TEST_MS)

  it('draws a top-sticky element below the fold and a fixed bar once each, with no gap', async () => {
    const shot = await shoot(
      html(
        `${bands([500, RED], [500, GREEN])}
         <div style="position:sticky;top:0;height:60px;background:${BLUE}"></div>${bands([340, PURPLE])}
         <div style="position:fixed;left:0;right:0;bottom:0;height:50px;background:${ORANGE}"></div>`,
      ),
    )
    const png = decode(shot)
    expect(png.height).toBe(1400 * CAPTURE_SCALE)
    expect(colourAt(png, 300)).toEqual(rgb(RED))
    expect(colourAt(png, 700)).toEqual(rgb(GREEN))
    expect(colourAt(png, 790)).toEqual(rgb(ORANGE))
    expect(colourAt(png, 1030)).toEqual(rgb(BLUE))
    expect(colourAt(png, 1100)).toEqual(rgb(PURPLE))
    expect(colourAt(png, 1380)).toEqual(rgb(PURPLE))
  }, TAKE_SHOT_TEST_MS)

  it('draws a bottom-sticky footer holding a fixed bar once at the end of its card, the bar once on frame 0', async () => {
    const shot = await shoot(
      html(
        `<div style="background:${RED}"><div style="height:1120px"></div>
           <div style="position:sticky;bottom:0;height:80px;background:${BLUE}">
             <div style="position:fixed;left:0;right:0;bottom:0;height:40px;background:${ORANGE}"></div>
           </div></div>${bands([600, PURPLE])}`,
      ),
    )
    const png = decode(shot)
    expect(png.height).toBe(1800 * CAPTURE_SCALE)
    expect(colourAt(png, 400)).toEqual(rgb(RED))
    expect(colourAt(png, 790)).toEqual(rgb(ORANGE))
    expect(colourAt(png, 740)).toEqual(rgb(RED))
    expect(colourAt(png, 1160)).toEqual(rgb(BLUE))
    expect(colourAt(png, 1190)).toEqual(rgb(BLUE))
    expect(colourAt(png, 1210)).toEqual(rgb(PURPLE))
    expect(colourAt(png, 1600)).toEqual(rgb(PURPLE))
  }, TAKE_SHOT_TEST_MS)

  it('refuses a header that collapses when the probe scrolls the page', async () => {
    const shot = await shoot(
      html(
        `<div id="header" style="height:200px;background:${RED}"></div>${bands([1000, GREEN])}
         <div style="position:sticky;top:0;height:60px;background:${BLUE}"></div>${bands([600, PURPLE])}
         <script>addEventListener('scroll', () => { document.getElementById('header').style.height = '50px' }, { once: true })</script>`,
      ),
    )
    expect(shot).toEqual({ png: null, failure: changed })
  }, TAKE_SHOT_TEST_MS)

  it('refuses an IntersectionObserver lazy list', async () => {
    const shot = await shoot(
      html(
        `<div id="list">${'<div class="row" style="height:100px;background:#00ffff"></div>'.repeat(30)}</div>
         <script>const seen = new IntersectionObserver((entries) => {
           for (const entry of entries) if (entry.isIntersecting) { entry.target.style.height = '180px'; seen.unobserve(entry.target) }
         })
         document.querySelectorAll('.row').forEach((row) => seen.observe(row))</script>`,
      ),
    )
    expect(shot).toEqual({ png: null, failure: changed })
  }, TAKE_SHOT_TEST_MS)

  it('refuses a sticky element that is stuck where the probe read it', async () => {
    const shot = await shoot(
      html(
        `${bands([300, RED])}<div style="height:100px;background:${GREEN}">
           <div style="position:sticky;bottom:0;height:1000px;background:${BLUE}"></div></div>${bands([1200, PURPLE])}`,
      ),
    )
    expect(shot).toEqual({ png: null, failure: named('a pinned element could not be placed', 'built') })
  }, TAKE_SHOT_TEST_MS)

  it('stitches a page whose root has scroll-behavior: smooth', async () => {
    const shot = await shoot(html(bands([600, RED], [600, GREEN], [600, BLUE]), '<style>html{scroll-behavior:smooth}</style>'))
    const png = decode(shot)
    expect(png.height).toBe(1800 * CAPTURE_SCALE)
    expect(colourAt(png, 300)).toEqual(rgb(RED))
    expect(colourAt(png, 900)).toEqual(rgb(GREEN))
    expect(colourAt(png, 1500)).toEqual(rgb(BLUE))
  }, TAKE_SHOT_TEST_MS)

  it('takes one frame of a page that fits the phone', async () => {
    const shot = await shoot(html(bands([400, RED])))
    const png = decode(shot)
    expect(png.height).toBe(VIEWPORT.height * CAPTURE_SCALE)
    expect(png.width).toBe(VIEWPORT.width * CAPTURE_SCALE)
    expect(colourAt(png, 200)).toEqual(rgb(RED))
  }, TAKE_SHOT_TEST_MS)

  it('draws a fixed bar once when its child sets visibility: visible and has a pseudo-element', async () => {
    const shot = await shoot(
      html(
        `<style>.bar{position:fixed;left:0;right:0;bottom:0;height:60px;background:#808080}
         .bar .child{visibility:visible;height:60px;background:${ORANGE}}
         .bar .child::after{content:'';display:block;position:absolute;left:0;right:0;top:0;height:10px;background:${BLUE}}</style>
         ${bands([1000, RED], [500, PURPLE])}<div class="bar"><div class="child"></div></div>`,
      ),
    )
    const png = decode(shot)
    expect(png.height).toBe(1500 * CAPTURE_SCALE)
    expect(colourAt(png, 790)).toEqual(rgb(ORANGE))
    expect(colourAt(png, 756)).toEqual(rgb(BLUE))
    expect(colourAt(png, 1470)).toEqual(rgb(PURPLE))
    expect(colourAt(png, 1442)).toEqual(rgb(PURPLE))
  }, TAKE_SHOT_TEST_MS)

  it('crops a section to its own columns and rows, on every frame', async () => {
    const shot = await shoot(
      html(
        `${bands([900, RED])}<div id="card" style="margin-left:51.4px;width:200.2px;height:400px;background:${GREEN}"></div>${bands([900, BLUE])}`,
      ),
      '#card',
    )
    const png = decode(shot)
    // Out to whole CSS px: columns 51 to 252 (201 wide), rows 900 to 1300, the grow path's crop.
    expect(png.width).toBe(201 * CAPTURE_SCALE)
    expect(png.height).toBe(400 * CAPTURE_SCALE)
    expect(colourAt(png, 200)).toEqual(rgb(GREEN))
    expect(colourAt(png, 2)).toEqual(rgb(GREEN))
    expect(colourAt(png, 398)).toEqual(rgb(GREEN))
  }, TAKE_SHOT_TEST_MS)

  it('crops a section to its CSS size at deviceScaleFactor 1, the scale of the screen images', async () => {
    const shot = await shoot(
      html(
        `${bands([900, RED])}<div id="card" style="margin-left:51.4px;width:200.2px;height:400px;background:${GREEN}"></div>${bands([900, BLUE])}`,
      ),
      '#card',
      1,
    )
    const png = decode(shot)
    // The same CSS crop as at scale 2, columns 51 to 252 and rows 900 to 1300, with one device px per CSS px.
    expect(png.width).toBe(201)
    expect(png.height).toBe(400)
    expect(colourAt(png, 200, 1)).toEqual(rgb(GREEN))
    expect(colourAt(png, 398, 1)).toEqual(rgb(GREEN))
  }, TAKE_SHOT_TEST_MS)

  it('takes a page whose textarea holds more text than its box, as the grow path did', async () => {
    const lines = Array.from({ length: 30 }, (_, at) => `line ${at}`).join('\n')
    const shot = await shoot(html(`<textarea style="display:block;height:56px;width:300px">${lines}</textarea>${bands([200, RED])}`))
    const png = decode(shot)
    expect(png.height).toBe(VIEWPORT.height * CAPTURE_SCALE)
    expect(colourAt(png, 150)).toEqual(rgb(RED))
  }, TAKE_SHOT_TEST_MS)

  it('refuses a page that fits whose element scrolls inside itself, naming it as the inner scroll', async () => {
    const shot = await shoot(
      html(`<div style="height:100px;overflow:auto"><div style="height:400px;background:${RED}"></div></div>${bands([200, BLUE])}`),
    )
    expect(shot.png).toBeNull()
    expect(shot.failure).toBe(named('the page scrolls inside an element', 'built'))
  }, TAKE_SHOT_TEST_MS)
})
