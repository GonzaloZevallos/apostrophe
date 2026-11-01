// Comparisons (agentic-system ADR-0040): each design screen next to the same screen of the
// sample app, at the same width, one PNG per screen.
//
//   node scripts/design/comparisons.mjs --facts <sample.json> --out <dir> [--only A,B] [--strict]
//                                  [--census] [--step-timeout <ms>]
//
// `--facts` is what `scripts/design/sample-app.sh` wrote. Screens and how to reach each
// state come from `scripts/design/screens.json`. A step that fails, a screen not built
// yet are written on the image and in `index.json`,
// never thrown: one broken screen must not hide the others. The facts carry `today`.
//
// A design capture never touches the network (ADR-0042): its Google Fonts requests are
// served from the self-hosted Geist files (FONT_FAMILIES), every other non-file request is aborted. Both
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
//
// `--census` (off by default) adds an optional `census` to each `index.json` entry, `{ design?, built? }`
// (`census.mjs`): what each side looked like before its viewport grew, and which element sizes
// changed once it did, read after the real shot on the same page, which is then discarded. It
// never changes a PNG, a failure or the exit code: a census that could not be read is a fixed
// English `census_error`.
//
// `--step-timeout <ms>` (an integer of at least 1; default 8000) is the wall-clock bound of one
// step of a capture. It bounds `withinTimeout` and the built page's Playwright default; the design
// page's default is the larger of 30000 and it. The settle bounds count frames and do not change.

import { createRequire } from 'node:module'
import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { assertAccountKinds, assertScreens, assertSelectedAccounts, assertSelectedNeeds } from './screens.mjs'
import { FONT_FAMILIES, fontCss, fontRoute } from './fonts.mjs'
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
import { createCensus } from './census.mjs'
import { coversScreen, layerMiss, planShot, regionMiss, shotStepReason, sizeRecordMiss, staleFiles, viewportMovedReason, viewportUnchanged } from './shot.mjs'
import { allElements, fixedInPage, layerReadInPage, readMetrics, sameNodesInPage, snapshotInPage } from './shot-page.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const PROTOTYPE = join(REPO, 'docs', 'product', 'design-system', 'pantallas')
const require = createRequire(join(REPO, 'web', 'package.json'))
const { chromium } = require('playwright')
const fontRoot = (family) => join(REPO, 'web', 'node_modules', FONT_FAMILIES[family].package)

const { values } = parseArgs({
  options: {
    facts: { type: 'string' },
    out: { type: 'string' },
    only: { type: 'string' },
    strict: { type: 'boolean', default: false },
    census: { type: 'boolean', default: false },
    'step-timeout': { type: 'string' },
  },
})
if (!values.facts || !values.out) {
  console.error('usage: comparisons.mjs --facts <sample.json> --out <dir> [--only A,B] [--strict] [--census] [--step-timeout <ms>]')
  process.exit(2)
}
// The wall-clock bound of one step, set once. Without the flag it is the 8 s every run had.
const TIMEOUT = values['step-timeout'] === undefined ? 8000 : Number(values['step-timeout'])
if (!/^\d+$/.test(values['step-timeout'] ?? '1') || !Number.isSafeInteger(TIMEOUT) || TIMEOUT < 1) {
  console.error('usage: comparisons.mjs --step-timeout takes a whole number of milliseconds, 1 or more')
  process.exit(2)
}
// Playwright's own default for the design page, which is not bounded by `TIMEOUT` alone.
const PLAYWRIGHT_DEFAULT_MS = 30_000
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
  await context.addInitScript(() => {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync('*, *::before, *::after { caret-color: transparent !important; }')
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  })
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
// after the settled frames. The shot is kept only if that frame is calm (no mutation since the
// last settled frame included) and has the last settled frame's hash; any miss, or a frame that
// cannot be read, is the one rest failure (`null` when the page is still at rest). Nothing is
// discarded: the shot itself does not mutate the page (see `SHOT` and `hideCaret`).
async function restAfterShot(page) {
  try {
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

const readFontCss = (family) => (weight) => readFileSync(join(fontRoot(family), `${weight}.css`), 'utf-8')

// The design context's network: file:// goes through, Google Fonts is answered from the
// local package, everything else is aborted and never reaches the network.
async function routeDesign(context, ctx) {
  await context.route('**', async (route) => {
    const url = route.request().url()
    if (url.startsWith('file://')) return route.continue()
    const target = fontRoute(url)
    try {
      if (target.kind === 'stylesheet') {
        return await route.fulfill({ contentType: 'text/css', body: fontCss(target.family, target.weights, readFontCss(target.family)) })
      }
      if (target.kind === 'file') {
        const body = readFileSync(join(fontRoot(target.family), 'files', target.name))
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

// The screenshot has been taken: the viewport must be the size it was at the final settle, the
// scaled text is checked once more, then the page must still be at rest; a miss in any discards it.
// `label` is the side in the text-scale note; `side` is the one in the shot's own reasons.
const settledViewport = new WeakMap()

async function verifyAfterShot(page, s, label, png, side) {
  if (!viewportUnchanged(settledViewport.get(page), page.viewportSize())) {
    return sideOutcome(viewportMovedReason(side), null)
  }
  const miss = s.text_scale ? await scaleMisses(page, s, label, 'después de la captura') : null
  return sideOutcome(miss ?? (await restAfterShot(page)), png)
}

// The design file an entry is compared against: `design`, else the entry's own name.
const designOf = (s) => s.design ?? s.screen

// A section is cropped to its parent block. When a direct child sticks out of that block
// (a fixed-width card inside a padded column), the crop is the union of the block and its
// children, in page coordinates, so no line of the section is cut. Always a box, whole pixels
// outward, as `locator.screenshot()` rounds its own. Read before the final settle, so that the
// screenshot is the very next call after it.
async function sectionClip(block) {
  return block.evaluate((el) => {
    const box = (e) => {
      const r = e.getBoundingClientRect()
      return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY }
    }
    // A child with no box (display:none, display:contents) sits at the origin: not a part of the section.
    const drawn = [...el.children].filter((c) => c.getBoundingClientRect().width > 0 || c.getBoundingClientRect().height > 0)
    const all = [box(el), ...drawn.map(box)]
    const left = Math.min(...all.map((b) => b.left))
    const top = Math.min(...all.map((b) => b.top))
    const right = Math.max(...all.map((b) => b.right))
    const bottom = Math.max(...all.map((b) => b.bottom))
    const x = Math.floor(left)
    const y = Math.floor(top)
    return { x, y, width: Math.ceil(right) - x, height: Math.ceil(bottom) - y }
  })
}

// Playwright's `caret: 'hide'` sets and restores a `style` attribute on the page's text inputs,
// a DOM mutation the probe would see in the frame after the shot. The caret is hidden instead by
// a constructed stylesheet (`hideCaret`), which is not a DOM mutation, and the shot leaves its
// own caret option alone: the pixels are the same and the page is untouched.
const SHOT = { animations: 'disabled', caret: 'initial' }

// A step of the shot that cannot finish is the side's failure, with a fixed reason and no error text.
const stepKind = (error) => (error?.message === 'timeout' || error?.name === 'TimeoutError' ? 'timeout' : 'error')

// Every read, resize and the shot itself run bounded by `withinTimeout`; the settle keeps its own bounds.
const bounded = (promise) => withinTimeout(Promise.resolve(promise))

// The before and after snapshots of the elements, matched by node identity through their handles.
async function sizeSnapshot(page, handle) {
  return bounded(page.evaluate(snapshotInPage, handle))
}

async function nodeIdentity(page, before, beforeHandle, after, afterHandle) {
  const afterAt = new Map(after.entries.map((entry) => [`${entry.path}\u0000${entry.ordinal}`, entry]))
  const pairs = []
  const matched = []
  for (const entry of before.entries) {
    const other = afterAt.get(`${entry.path}\u0000${entry.ordinal}`)
    if (other === undefined) continue
    pairs.push([entry.index, other.index])
    matched.push(other)
  }
  const same = await bounded(page.evaluate(sameNodesInPage, [beforeHandle, afterHandle, pairs]))
  matched.forEach((other, at) => {
    other.same_node = same[at]
  })
}

// How a shot is taken, the same for every row and both sides (`shot.mjs` decides each step; nothing here
// looks at the row, the file, the width or the kind of screen; `side` only names a failure). A layer
// over the screen is never grown: its frame must lie inside the viewport and nothing in it may be
// scrolled. Any other page grows the viewport once, to the height of the document at the same width
// (a full-page shot makes Chromium resize the viewport for a moment, and `captureBeyondViewport` does
// too: docs/adr/0052), settles, and only then is checked: the sizes before and after the growth, then
// that the region fits the viewport. The shot is a plain one, with the section's clip when there is one.
// A miss, a timeout included, is `sideOutcome(reason, null)`.
async function takeShot(page, { block, ofFirstText, census, side }) {
  const handles = []
  try {
    if (census) await bounded(census.before(page))
    return await shotSteps(page, { block, ofFirstText, census, side }, handles)
  } catch (error) {
    return sideOutcome(shotStepReason(stepKind(error), side), null)
  } finally {
    await Promise.allSettled(handles.map((handle) => handle.dispose()))
  }
}

async function shotSteps(page, { block, ofFirstText, census, side }, handles) {
  const viewport = page.viewportSize()
  const metrics = await bounded(page.evaluate(readMetrics))
  const beforeHandle = await bounded(page.evaluateHandle(allElements))
  handles.push(beforeHandle)
  const fixed = await bounded(page.evaluate(fixedInPage, beforeHandle))
  const plan = planShot(metrics, fixed, viewport)
  let before = null
  if (plan.mode === 'grow') {
    before = await sizeSnapshot(page, beforeHandle)
    if (plan.height !== viewport.height) {
      await bounded(page.setViewportSize({ width: viewport.width, height: plan.height }))
    }
  }
  const clip = block ? await bounded(sectionClip(block)) : undefined
  const last = await settle(page, { advanceMs: 0, ofFirstText })
  if (last) return sideOutcome(last, null)
  settledViewport.set(page, page.viewportSize())
  let miss
  if (plan.mode === 'layer') {
    const covering = fixed.find((element) => coversScreen([element], viewport))
    const { frame, containers } = await bounded(page.evaluate(layerReadInPage, [beforeHandle, covering.index]))
    miss = layerMiss(frame, viewport, containers, side)
  } else {
    const afterHandle = await bounded(page.evaluateHandle(allElements))
    handles.push(afterHandle)
    const after = await sizeSnapshot(page, afterHandle)
    await nodeIdentity(page, before, beforeHandle, after, afterHandle)
    miss = sizeRecordMiss(before, after, side)
  }
  miss ??= regionMiss(await bounded(page.evaluate(readMetrics)), clip, side, { layer: plan.mode === 'layer' })
  if (miss) return sideOutcome(miss, null)
  census?.atShot(page)
  const png = await bounded(page.screenshot(clip === undefined ? SHOT : { ...SHOT, clip }))
  return sideOutcome(null, png)
}

async function captureDesign(browser, s, options, ctx) {
  const census = ctx.census?.design
  const context = await browser.newContext(options)
  try {
    await pauseClock(context)
    await addProbe(context)
    await routeDesign(context, ctx)
    const page = await context.newPage()
    page.setDefaultTimeout(Math.max(PLAYWRIGHT_DEFAULT_MS, TIMEOUT))
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
    const shot = await takeShot(page, { block, ofFirstText: true, census, side: 'design' })
    if (shot.failure !== null) return shot
    const outcome = await verifyAfterShot(page, s, 'diseño', shot.png, 'design')
    await census?.after(page)
    return outcome
  } finally {
    await census?.dispose()
    await context.close()
  }
}

// The built screen in the state its entry asks for; what could not be reached is the side's failure.
async function captureBuilt(browser, s, options, ctx) {
  const context = await browser.newContext(options)
  try {
    return await captureBuiltIn(context, s, options, ctx)
  } finally {
    await ctx.census?.built.dispose()
    await context.close()
  }
}

async function captureBuiltIn(context, s, options, ctx) {
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
  const shot = await takeShot(page, { block: null, ofFirstText: false, census: ctx.census?.built, side: 'built' })
  if (shot.failure !== null) return shot
  const outcome = await verifyAfterShot(page, s, 'construido', shot.png, 'built')
  await ctx.census?.built.after(page)
  return outcome
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

// The census of a row, one per side; its settle is the capture's own, with no clock advance.
function censusOf(options, s) {
  const side = (ofFirstText) =>
    createCensus({
      deviceScaleFactor: options.deviceScaleFactor,
      settle: (page) => settle(page, { advanceMs: 0, ofFirstText }),
    })
  return { design: side(true), built: side(false) }
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
    // A row's side PNGs come only from this run's own buffers: the previous run's are deleted first.
    for (const file of staleFiles(readdirSync(out), [s.screen])) unlinkSync(join(out, file))
    const ctx = { notes: [], failures: [], census: values.census ? censusOf(options, s) : null }
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
    if (ctx.census) {
      const sides = Object.entries({ design: ctx.census.design, built: ctx.census.built }).filter(
        ([, side]) => Object.keys(side.record).length > 0,
      )
      if (sides.length) entry.census = Object.fromEntries(sides.map(([name, side]) => [name, side.record]))
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
