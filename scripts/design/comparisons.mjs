// Comparisons (agentic-system ADR-0040): each design screen next to the same screen of the
// sample app, at the same width, one PNG per screen.
//
//   node scripts/design/comparisons.mjs --facts <sample.json> --out <dir> [--only A,B] [--strict]
//
// `--facts` is what `scripts/design/sample-app.sh` wrote. Screens and how to reach each
// state come from `scripts/design/screens.json`. A step that fails, a screen not built
// yet and a page wider than its viewport are written on the image and in `index.json`,
// never thrown: one broken screen must not hide the others. The facts carry `today`.
//
// A design capture never touches the network (ADR-0042): its Google Fonts requests are
// served from @fontsource/plus-jakarta-sans, every other non-file request is aborted. Both
// captures run on a paused fake clock (the facts' `today` at noon, Argentina) and are taken
// only once the page is at rest (ADR-0042, `settle.mjs`): the applied-check passes and, for three
// frames, nothing is requested, mutated or animating and the layout (control state included) is
// the same; one more frame after the shot must still be calm with the same hash. So what is
// captured does not depend on how loaded the machine is. A side that did not settle, whose font is not applied, or whose step
// threw has no capture (`null`); each is a note on the sheet and in `index.json`, and with
// `--strict` the run also exits non-zero, after writing everything. Besides `<screen>.png`
// the raw captures go to `<screen>.design.png` and `<screen>.built.png`, listed in
// `index.json` as `design` and `built` (an absolute path, or null when there is none).
//
// An entry with `text_scale` is captured with its text scaled (`textScale.mjs`), on both
// sides: applied and verified after the page has settled and its steps are done, then verified
// again right after the screenshot, in the same page. A miss in either is a failure of the
// screen, like a font failure. A `section` crop needs exactly one element with that label;
// any other count is a screen that threw, never a silent first match.

import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { assertAccountKinds, assertScreens, assertSelectedAccounts, assertSelectedNeeds } from './screens.mjs'
import { fontCss, fontRoute } from './fonts.mjs'
import { pageProbe } from './probe.mjs'
import {
  SETTLE_ADVANCE_MS,
  SETTLE_BOUND,
  SETTLE_FRAMES,
  SETTLE_QUIET_HOPS,
  SETTLE_REASON_UNSETTLED,
  animationRecords,
  frameRecords,
  settleWith,
  shotKept,
  signatureOf,
  sideOutcome,
  unfinished,
} from './settle.mjs'
import { applyInPage, gatherInPage, TOLERANCE, unscaled } from './textScale.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const PROTOTYPE = join(REPO, 'docs', 'product', 'design-system', 'pantallas')
const require = createRequire(join(REPO, 'web', 'package.json'))
const { chromium } = require('playwright')
const FONT_ROOT = join(REPO, 'web', 'node_modules', '@fontsource', 'plus-jakarta-sans')

const { values } = parseArgs({
  options: {
    facts: { type: 'string' },
    out: { type: 'string' },
    only: { type: 'string' },
    strict: { type: 'boolean', default: false },
  },
})
if (!values.facts || !values.out) {
  console.error('usage: comparisons.mjs --facts <sample.json> --out <dir> [--only A,B] [--strict]')
  process.exit(2)
}
const facts = JSON.parse(readFileSync(values.facts, 'utf-8'))
const { screens } = JSON.parse(readFileSync(join(HERE, 'screens.json'), 'utf-8'))
assertScreens(screens)
const only = values.only ? new Set(values.only.split(',')) : null
// `facts.accounts`: the sample's extra businesses by name, each `{ email, password }`;
// `facts.account_kinds`: each one's kind, `open` or `ended` (ADR-0042, GH-189).
const accounts = facts.accounts ?? {}
// A configuration error, like bad usage: nothing is captured, and no credential is printed.
try {
  const selected = screens.filter((s) => !only || only.has(s.screen))
  assertAccountKinds(accounts, facts.account_kinds)
  assertSelectedAccounts(selected, facts.account_kinds)
  assertSelectedNeeds(selected, screens)
} catch (error) {
  console.error(`comparisons: ${error.message}`)
  process.exit(2)
}
// The capture's clock is the sample's own day at noon in Argentina, never the wall clock.
if (typeof facts.today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(facts.today)) {
  console.error('comparisons.mjs: the facts have no `today` (an ISO date); rerun scripts/design/sample-app.sh')
  process.exit(2)
}
const out = resolve(values.out)
mkdirSync(out, { recursive: true })

const PHONE = [390, 844]
const CAPTURE_INSTANT = new Date(`${facts.today}T12:00:00-03:00`)
const TIMEOUT = 8000

// The user a screen signs in as: its `account`'s, else La Huerta's.
const userOf = (s) => (s.account ? accounts[s.account] : facts)

// `{name}` in a route or a step value: one of the sample's ids, or its user's email. An
// account's entry has only its own email: the ids are La Huerta's.
const placeholdersOf = (s) => (s.account ? { email: userOf(s).email } : { ...facts.ids, email: facts.email })

function resolveFacts(template, placeholders) {
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    if (!(name in placeholders)) throw new Error(`no sample fact named ${name}`)
    return String(placeholders[name])
  })
}

async function run(page, step, placeholders) {
  if (step.click) await page.getByText(step.click, { exact: true }).first().click()
  // An icon-only control has an accessible name and no text: found by role and exact name,
  // and strict, so zero matches or two fail the row instead of picking one.
  else if (step.press) await page.getByRole('button', { name: step.press, exact: true }).click()
  else if (step.fill) await page.getByLabel(step.fill.label).first().fill(resolveFacts(step.fill.value, placeholders))
  else if (step.select) await page.getByLabel(step.select.label).first().selectOption({ index: step.select.index })
  else if (step.wait) await page.getByText(step.wait, { exact: true }).first().waitFor()
  // The page has settled by now: only the network goes, the page is never reloaded. Every
  // font face it has not loaded yet is loaded first, since offline it could never be. The
  // preload records nothing: `appliedCheck` stays the only verdict on fonts.
  else if (step.offline) {
    await page.evaluate(async () => {
      const unloaded = [...document.fonts].filter((face) => face.status === 'unloaded')
      await Promise.allSettled(unloaded.map((face) => face.load()))
      await document.fonts.ready
    })
    await page.context().setOffline(true)
  }
  else throw new Error(`unknown step ${JSON.stringify(step)}`)
}

// Installed and paused before any page exists, so the page starts on the capture's instant
// and no timer fires until the capture advances the clock.
async function pauseClock(context) {
  await context.clock.install({ time: new Date(CAPTURE_INSTANT.getTime() - 1000) })
  await context.clock.pauseAt(CAPTURE_INSTANT)
}

async function addProbe(context) {
  await context.addInitScript(`(${pageProbe.toString()})(${signatureOf.toString()})`)
}

// One frame of the fake clock, then what the page looks like, in this order: no request in
// flight and none completed since the previous frame (that answer is `idle`); every finite
// animation that is running or pending finished, and only those (`unfinished` decides, paused
// and infinite ones are never touched); one real macrotask so queued work has run, then
// `quietHops` more, so a commit that lands later still counts; the mutation flag read and reset;
// then only a hash and booleans go back. A frame that finished something or saw a mutation is
// never calm (`settle.mjs`). The caller sends this function to the page with the pure helpers
// from `settle.mjs` as its arguments, all by `toString()`.
function sampleFrame(frameRecords, animationRecords, unfinished, quietHops) {
  return (async () => {
    const idle = await window.__captureQuiet()
    const flagged = unfinished(animationRecords(document))
    let unfinishedAnimation = false
    document.getAnimations().forEach((animation, index) => {
      if (!flagged[index]) return
      unfinishedAnimation = true
      try {
        animation.finish()
      } catch {
        // Nothing to do: the frame already counts as not calm.
      }
    })
    for (let hop = 0; hop <= quietHops; hop += 1) {
      await new Promise((resolve) => {
        const channel = new MessageChannel()
        channel.port1.onmessage = () => resolve()
        channel.port2.postMessage(0)
      })
    }
    const mutated = window.__captureMutated()
    const fontsLoaded = document.fonts.status === 'loaded'
    return {
      idle,
      unfinishedAnimation,
      mutated,
      fontsLoaded,
      hash: window.__captureSignature(frameRecords(document), {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        imagesComplete: [...document.images].every((i) => i.complete),
        fontsLoaded,
      }),
    }
  })()
}

const SAMPLE_FRAME_SOURCE = `(${sampleFrame})(${frameRecords}, ${animationRecords}, ${unfinished}, ${SETTLE_QUIET_HOPS})`

// The hash of each page's last settled frame, which the frame sampled after its screenshot
// must equal.
const settledHash = new WeakMap()

// A wait bound, not an assertion: a fetch that never settles must not hang the capture.
function withinTimeout(promise) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// `null` when the page has finished drawing, else a reason with no page data in it. In this
// order: the network once after a navigation, the applied-check (it loads fonts, so it runs
// before the clock moves), then the clock advance and the frame sampling.
async function settle(page, { advanceMs, afterGoto = false, ofFirstText }) {
  if (afterGoto) {
    try {
      await page.waitForLoadState('networkidle')
    } catch (error) {
      return `la red no se aquietó: ${firstLine(error)}`
    }
  }
  const applied = await appliedCheck(page, ofFirstText)
  if (applied) return applied
  const clock = page.context().clock
  let lastHash = null
  const reason = await settleWith(
    {
      advance: (ms) => clock.runFor(ms),
      frame: async () => {
        await clock.runFor(16)
        const frame = await withinTimeout(page.evaluate(SAMPLE_FRAME_SOURCE))
        lastHash = frame.hash
        return frame
      },
    },
    { advanceMs, frames: SETTLE_FRAMES, bound: SETTLE_BOUND },
  )
  if (reason === null) settledHash.set(page, lastHash)
  return reason
}

// One more frame, sampled right after a screenshot with NO clock advance: a late refetch lands
// after the settled frames. The shot is kept only if that frame is calm and has the last
// settled frame's hash; any miss, or a frame that cannot be read, is the one rest failure
// (`null` when the page is still at rest). Playwright's own screenshot sets and restores a
// `style` on the page's text inputs, which the observer sees; the mutation flag is read and
// discarded first, so only what happens after the shot counts as a mutation. A refetch the
// shot caused is still caught by the frame's other conditions (a request completed since the
// last frame, a control's state in the hash).
async function restAfterShot(page) {
  try {
    await withinTimeout(page.evaluate(() => window.__captureMutated()))
    const frame = await withinTimeout(page.evaluate(SAMPLE_FRAME_SOURCE))
    return shotKept(frame, settledHash.get(page)) ? null : SETTLE_REASON_UNSETTLED
  } catch {
    return SETTLE_REASON_UNSETTLED
  }
}

const firstLine = (error) => String(error?.code ?? error?.message ?? error).split('\n')[0]

// A failure that is a note on the sheet and, under `--strict`, a non-zero exit. `ctx` is the
// screen's `{ notes, failures }`; the same message is written once.
function fail(ctx, message) {
  if (ctx.failures.includes(message)) return
  ctx.failures.push(message)
  ctx.notes.push(message)
}

const readFontCss = (weight) => readFileSync(join(FONT_ROOT, `${weight}.css`), 'utf-8')

// The design context's network: file:// goes through, Google Fonts is answered from the
// local package, everything else is aborted and never reaches the network.
async function routeDesign(context, ctx) {
  await context.route('**', async (route) => {
    const url = route.request().url()
    if (url.startsWith('file://')) return route.continue()
    const target = fontRoute(url)
    try {
      if (target.kind === 'stylesheet') {
        return await route.fulfill({ contentType: 'text/css', body: fontCss(target.weights, readFontCss) })
      }
      if (target.kind === 'file') {
        const body = readFileSync(join(FONT_ROOT, 'files', target.name))
        return await route.fulfill({ contentType: target.name.endsWith('.woff2') ? 'font/woff2' : 'font/woff', body })
      }
    } catch (error) {
      fail(ctx, `tipografía local no disponible: ${firstLine(error)}`)
    }
    if (/^https?:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) {
      fail(ctx, 'se abortó un pedido de tipografía que no se sirve en local')
    }
    await route.abort()
  })
}

// The page's own font family is applied: a loaded face of it, no face in error, and the
// weights 400 to 700 available for latin text. Returns a reason (no data in it) or null.
// The family is the first one of `document.body`; a design file sets its font on an inner
// block, not on the body, so there it is the first element that draws text.
async function appliedCheck(page, ofFirstText) {
  return page.evaluate(async (ofFirstText) => {
    const unquote = (name) => name.trim().replace(/^["']|["']$/g, '')
    const skipped = new Set(['SCRIPT', 'STYLE', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'HELMET'])
    const drawsText = (node) =>
      node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '' && !skipped.has(node.parentElement?.tagName ?? 'SCRIPT')
    let source = document.body
    if (ofFirstText) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (drawsText(node)) {
          source = node.parentElement
          break
        }
      }
    }
    const family = unquote(getComputedStyle(source).fontFamily.split(',')[0])
    const sample = 'Nueva venta'
    const weights = [400, 500, 600, 700]
    // A face the page does not use yet stays unloaded; asking for it makes `check` mean
    // "this weight is available", not "this page happens to draw it".
    await Promise.all(weights.map((w) => document.fonts.load(`${w} 16px '${family}'`, sample).catch(() => [])))
    const faces = [...document.fonts]
    if (faces.some((face) => face.status === 'error')) return 'una tipografía de la página quedó en error'
    if (!faces.some((face) => unquote(face.family) === family && face.status === 'loaded')) {
      return 'ninguna cara cargada de la tipografía de la página'
    }
    const missing = weights.filter((w) => !document.fonts.check(`${w} 16px '${family}'`, sample))
    if (missing.length) return `la tipografía de la página no está aplicada en los pesos ${missing.join(', ')}`
    return null
  }, ofFirstText)
}

// An entry's scaled text (`text_scale`, both sides): applied once the page has settled and its
// steps are done, verified at once (a miss is a failure of the side), and verified again right
// after the screenshot, in the same page. A note names the side and a count, never page text.
// Applying it moves the layout, so the page settles again before the final settle.
async function scaleMisses(page, s, side, when) {
  const misses = unscaled(await page.evaluate(gatherInPage), s.text_scale, TOLERANCE)
  return misses.length ? `texto al ${Math.round(s.text_scale * 100)} %: ${misses.length} elementos fuera de escala ${when} (${side})` : null
}

async function applyTextScale(page, s, side, ofFirstText) {
  if (!s.text_scale) return null
  await page.evaluate(applyInPage, { factor: s.text_scale })
  const miss = await scaleMisses(page, s, side, 'antes de la captura')
  if (miss) return miss
  return settle(page, { advanceMs: SETTLE_ADVANCE_MS, ofFirstText })
}

// The screenshot has been taken: the scaled text is checked once more, then the page must still
// be at rest; a miss in either discards it.
async function verifyAfterShot(page, s, side, png) {
  const miss = s.text_scale ? await scaleMisses(page, s, side, 'después de la captura') : null
  return sideOutcome(miss ?? (await restAfterShot(page)), png)
}

// The design file an entry is compared against: `design`, else the entry's own name.
const designOf = (s) => s.design ?? s.screen

// A section is cropped to its parent block. When a direct child sticks out of that block
// (a fixed-width card inside a padded column), the crop is the union of the block and its
// children, in page coordinates, so no line of the section is cut; a block that holds its
// children is cropped exactly as `locator.screenshot()` does. The clip is read before the
// final settle, so that the screenshot is the very next call after it.
async function sectionClip(block) {
  return block.evaluate((el) => {
    const box = (e) => {
      const r = e.getBoundingClientRect()
      return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY }
    }
    const own = box(el)
    // A child with no box (display:none, display:contents) sits at the origin: not a part of the section.
    const drawn = [...el.children].filter((c) => c.getBoundingClientRect().width > 0 || c.getBoundingClientRect().height > 0)
    const all = [own, ...drawn.map(box)]
    const left = Math.min(...all.map((b) => b.left))
    const top = Math.min(...all.map((b) => b.top))
    const right = Math.max(...all.map((b) => b.right))
    const bottom = Math.max(...all.map((b) => b.bottom))
    const slack = 0.5
    const fits = own.left - left < slack && own.top - top < slack && right - own.right < slack && bottom - own.bottom < slack
    if (fits) return null
    // Whole pixels outward, as `locator.screenshot()` rounds its own box.
    const x = Math.floor(left)
    const y = Math.floor(top)
    return { x, y, width: Math.ceil(right) - x, height: Math.ceil(bottom) - y }
  })
}

// A full-page shot of a page taller than its viewport makes Chromium resize the viewport for a
// moment; at 900 px or more that flips the app's viewport query and remounts the screen, which
// re-reads every query it shows (GH-273). The capture does it first and settles on the result:
// the viewport grows to the height of the document, same width, so the shot never has to.
async function fitViewport(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  const { width, height: current } = page.viewportSize()
  if (height > current) await page.setViewportSize({ width, height })
}

const SHOT = { animations: 'disabled', caret: 'hide' }

async function captureDesign(browser, s, options, ctx) {
  const context = await browser.newContext(options)
  try {
    await pauseClock(context)
    await addProbe(context)
    await routeDesign(context, ctx)
    const page = await context.newPage()
    await page.goto(pathToFileURL(join(PROTOTYPE, `${designOf(s)}.dc.html`)).href)
    const first = await settle(page, { advanceMs: SETTLE_ADVANCE_MS, afterGoto: true, ofFirstText: true })
    if (first) return sideOutcome(first, null)
    const scaled = await applyTextScale(page, s, 'diseño', true)
    if (scaled) return sideOutcome(scaled, null)
    // A file that draws several states: only the block under the entry's `section` label, which
    // must be exactly one element, never a silent first match.
    let block = null
    if (s.section) {
      const label = page.getByText(s.section, { exact: true })
      const count = await label.count()
      if (count !== 1) throw new Error(`${s.screen}: section matches ${count} elements, expected 1`)
      block = label.locator('xpath=..')
    }
    await fitViewport(page)
    const clip = block ? await sectionClip(block) : null
    const last = await settle(page, { advanceMs: 0, ofFirstText: true })
    if (last) return sideOutcome(last, null)
    const png = !block
      ? await page.screenshot({ fullPage: true, ...SHOT })
      : clip
        ? await page.screenshot({ fullPage: true, clip, ...SHOT })
        : await block.screenshot(SHOT)
    return await verifyAfterShot(page, s, 'diseño', png)
  } finally {
    await context.close()
  }
}

// The built screen in the state its entry asks for; what could not be reached, or a page
// wider than its viewport, goes into `notes`.
async function captureBuilt(browser, s, options, ctx) {
  const { notes } = ctx
  const context = await browser.newContext(options)
  try {
    return await captureBuiltIn(context, s, options, ctx, notes)
  } finally {
    await context.close()
  }
}

async function captureBuiltIn(context, s, options, ctx, notes) {
  await pauseClock(context)
  await addProbe(context)
  if (s.tema) {
    // `document.documentElement` does not exist yet when this init script
    // runs (proven against this build), so it waits for the parser to
    // create it before setting the attribute.
    await context.addInitScript((tema) => {
      const apply = () => {
        document.documentElement.dataset.tema = tema
      }
      if (document.documentElement) apply()
      else document.addEventListener('DOMContentLoaded', apply, { once: true })
    }, s.tema)
  }
  const user = userOf(s)
  const placeholders = placeholdersOf(s)
  if (!s.signed_out) {
    const login = await context.request.post('/auth/login', {
      data: { email: user.email, password: user.password },
    })
    if (!login.ok()) throw new Error(`login failed: ${login.status()}`)
  }
  const page = await context.newPage()
  page.setDefaultTimeout(TIMEOUT)
  await page.goto(resolveFacts(s.route, placeholders))
  const first = await settle(page, { advanceMs: SETTLE_ADVANCE_MS, afterGoto: true, ofFirstText: false })
  if (first) return sideOutcome(first, null)
  for (const step of s.steps ?? []) {
    let reason
    try {
      await run(page, step, placeholders)
      reason = await settle(page, { advanceMs: SETTLE_ADVANCE_MS, ofFirstText: false })
    } catch (error) {
      reason = firstLine(error)
    }
    if (reason) return sideOutcome(`estado no alcanzado en ${JSON.stringify(step)}: ${reason}`, null)
  }
  const scaled = await applyTextScale(page, s, 'construido', false)
  if (scaled) return sideOutcome(scaled, null)
  const width = options.viewport.width
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scrollWidth > width) notes.push(`desborda: ${scrollWidth}px de ancho en ${width}px`)
  await fitViewport(page)
  const last = await settle(page, { advanceMs: 0, ofFirstText: false })
  if (last) return sideOutcome(last, null)
  const png = await page.screenshot({ fullPage: true, ...SHOT })
  return await verifyAfterShot(page, s, 'construido', png)
}

async function composeSheet(browser, s, width, design, built, notes, file) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const img = (png) => `data:image/png;base64,${png.toString('base64')}`
  const column = (label, png) =>
    `<figure><figcaption>${label}</figcaption>${png ? `<img src="${img(png)}">` : '<div class="none">—</div>'}</figure>`
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;font:14px system-ui,sans-serif;background:#e7e5e1;color:#231e18;display:inline-block}
    h1{font-size:18px;margin:0 0 6px} p{margin:0 0 12px;color:#7a4a00;font-weight:600}
    .row{display:flex;gap:24px;align-items:flex-start} figure{margin:0}
    figcaption{font-weight:600;margin-bottom:8px} img{display:block;width:${width}px;border:1px solid #9a9085}
    .none{width:${width}px;height:200px;border:1px dashed #9a9085;display:grid;place-items:center}
    </style><h1>${s.screen}</h1>${notes.map((n) => `<p>${n}</p>`).join('')}
    <div class="row">${column(`Diseño · ${designOf(s)}.dc.html${s.section ? ` · ${s.section}` : ''}`, design)}${column(`Construido · ${s.route ?? 'sin ruta'}`, built)}</div>`)
  await page.locator('body').screenshot({ path: file })
  await context.close()
}

// The capture of one side: what it could not do is a failure of the screen, not a throw, and
// that side has no PNG under any name.
async function attempt(label, ctx, capture) {
  try {
    const outcome = await capture()
    if (outcome.failure === null) return outcome.png
    fail(ctx, `${label} no se pudo capturar: ${outcome.failure}`)
  } catch (error) {
    fail(ctx, `${label} no se pudo capturar: ${firstLine(error)}`)
  }
  return null
}

const browser = await chromium.launch()
const results = []
let failed = false
try {
  for (const s of screens) {
    if (only && !only.has(s.screen)) continue
    const [width, height] = s.viewport ?? PHONE
    const options = {
      viewport: { width, height },
      deviceScaleFactor: 2,
      colorScheme: 'light',
      baseURL: facts.url,
    }
    const ctx = { notes: [], failures: [] }
    const { notes } = ctx
    const entry = { screen: s.screen, file: null, notes, design: null, built: null }
    try {
      const design = await attempt('el diseño', ctx, () => captureDesign(browser, s, options, ctx))
      let built = null
      if (s.route === null) notes.push('todavía no existe en la app')
      else built = await attempt('lo construido', ctx, () => captureBuilt(browser, s, options, ctx))
      if (design) {
        entry.design = join(out, `${s.screen}.design.png`)
        writeFileSync(entry.design, design)
      }
      if (built) {
        entry.built = join(out, `${s.screen}.built.png`)
        writeFileSync(entry.built, built)
      }
      const file = join(out, `${s.screen}.png`)
      await composeSheet(browser, s, width, design, built, notes, file)
      entry.file = file
    } catch (error) {
      fail(ctx, `la pantalla falló: ${firstLine(error)}`)
    }
    if (ctx.failures.length) failed = true
    results.push(entry)
    console.log(`${s.screen}: ${notes.length ? notes.join('; ') : 'ok'}`)
  }
} finally {
  await browser.close()
  writeFileSync(join(out, 'index.json'), JSON.stringify(results, null, 2))
}
if (values.strict && failed) {
  console.error('comparisons: --strict and a capture failed (a side that did not settle or could not be reached, a font, or a screen that threw)')
  process.exitCode = 1
}
