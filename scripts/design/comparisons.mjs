// Comparisons (agentic-system ADR-0040): each design screen next to the same screen of the
// sample app, at the same width, one PNG per screen.
//
//   node scripts/design/comparisons.mjs --facts <sample.json> --out <dir> [--only A,B] [--strict]
//                                  [--census] [--step-timeout <ms>] [--registry <screens.json>] [--built-only]
//
// Every capture, phone and desktop, both sides, runs on a calm page (`shot.mjs`: `CALM_CONTEXT`,
// `CALM_CSS`, `PROBE_CSS`): reduced motion in the context, animation and transition durations
// and delays at 0 in the probe's adopted stylesheet, and the fonts ready before the first frame.
//
// Each `index.json` entry has `capture` (`captured` when both PNGs exist, else `not-captured`)
// and, for a side with no PNG, `reasons.design` or `reasons.built`: a fixed English line built
// by `named()` in `shot.mjs`, never page text. Both are optional for every reader; the Spanish
// `notes` stay. A plain run exits 0 even when no row is captured; `--strict` exits 1 after every
// row has run and `index.json` is written, except that a run over the whole registry (no `--only`) only
// counts the rows with no built screen (`route: null`) as `not compared: no built screen`. Bad usage or an
// unreadable `--registry` (default: `screens.json` next to this file) exits 2. A failed write of `index.json` fails the run.
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
// `--built-only` (screen images, docs/product/screen-images.md, ADR-0079; read in one place, above the run loop): the run
// skips the design side and the sheet, captures at a device scale factor of 1, and writes only
// `<screen>.built.png` and `index.json`. Each entry keeps its shape; its `design` and `file` are null and
// `capture` says whether the built PNG exists. Without it everything runs as before.
//
// `--step-timeout <ms>` (an integer of at least 1; default 8000) is the wall-clock bound of one
// step of a capture. It bounds `withinTimeout` and the built page's Playwright default; the design
// page's default is the larger of 30000 and it. The settle bounds count frames and do not change.

import { createRequire } from 'node:module'
import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { assertAccountKinds, assertScreens, assertSelectedAccounts, assertSelectedNeeds, viewportsOf } from './screens.mjs'
import { pngCssWidth, sheetHtml } from './sheet.mjs'
import { FONT_FAMILIES, fontCss, fontRoute } from './fonts.mjs'
import { applyInPage } from './textScale.mjs'
import { createCensus } from './census.mjs'
import { resolveStep } from '../../web/src/i18n/step.ts'
import { loadBundle } from '../../web/scripts/i18n/loadBundle.ts'
import {
  CAPTURE_ATTEMPTS,
  SETTLE_ADVANCE_MS,
  captureWithRetries,
  isRetryableKind,
  retryNote,
  retrySummary,
  sideOutcome,
} from './settle.mjs'
import { BUILT_DEVICE_PINS, CAPTURE_SCALE, captureContextOptions, launchOptions, named, rowCapture, shotReason, staleFiles } from './shot.mjs'
import {
  addProbe,
  configureShot,
  firstLine,
  pauseClock,
  scaleMisses,
  settle,
  settleKinded,
  takeShot,
  verifyAfterShot,
  withinTimeout,
} from './take-shot.mjs'

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
    registry: { type: 'string' },
    'built-only': { type: 'boolean', default: false },
  },
})
if (!values.facts || !values.out) {
  console.error(
    'usage: comparisons.mjs --facts <sample.json> --out <dir> [--only A,B] [--strict] [--census] [--step-timeout <ms>] [--registry <screens.json>] [--built-only]',
  )
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
// The registry: `--registry`, else the one next to this file. A file that cannot be read, is not
// JSON or is not a registry is a configuration error like bad usage; nothing of it is printed.
let screens
try {
  ;({ screens } = JSON.parse(readFileSync(values.registry ?? join(HERE, 'screens.json'), 'utf-8')))
  assertScreens(screens)
} catch {
  console.error('comparisons: the registry could not be read')
  process.exit(2)
}
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

const DEVICE_SCALE_FACTOR = CAPTURE_SCALE
const CAPTURE_INSTANT = new Date(`${facts.today}T12:00:00-03:00`)
configureShot({ timeoutMs: TIMEOUT, instant: CAPTURE_INSTANT })

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

// A step may name a locale key instead of an English text: resolved against the `en` bundle, read once.
const EN = loadBundle('en')

async function run(page, rawStep, placeholders) {
  const step = resolveStep(rawStep, EN)
  if (step.click) await page.getByText(step.click, { exact: true }).first().click()
  // An icon-only control has an accessible name and no text: found by role and exact name,
  // and strict, so zero matches or two fail the row instead of picking one.
  else if (step.press) await page.getByRole('button', { name: step.press, exact: true }).click()
  else if (step.fill) await page.getByLabel(step.fill.label, { exact: true }).fill(resolveFacts(step.fill.value, placeholders))
  else if (step.select) await page.getByLabel(step.select.label, { exact: true }).selectOption({ index: step.select.index })
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

// An entry's scaled text (`text_scale`, both sides): applied once the page has settled and its
// steps are done, verified at once (a miss is a failure of the side), and verified again right
// after the screenshot, in the same page. A note names the side and a count, never page text.
// Applying it moves the layout, so the page settles again before the final settle.

async function applyTextScale(page, s, side, ofFirstText) {
  if (!s.text_scale) return { reason: null, kind: null }
  await page.evaluate(applyInPage, { factor: s.text_scale })
  const miss = await scaleMisses(page, s, side, 'antes de la captura')
  if (miss) return { reason: miss, kind: 'other' }
  return settleKinded(page, { advanceMs: SETTLE_ADVANCE_MS, ofFirstText })
}

// The design file an entry is compared against: `design`, else the entry's own name.
const designOf = (s) => s.design ?? s.screen

// Whether the attempt's page sent any request other than a read, set before the page navigates. The
// built login goes through `context.request` before the page exists, so it is not counted here.
function watchWrites(page, probe) {
  probe.writes = []
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.method() !== 'HEAD') {
      probe.wrote = true
      probe.writes.push(request)
    }
  })
}

// A step that sent a write is done only once the write has its response (or has failed): the
// settle that follows then starts from the page's answer, not from a request still on its way. Bounded
// by `TIMEOUT` like every wait here; it is the same for every row and both sides.
async function writesAnswered(probe) {
  await withinTimeout(Promise.all(probe.writes.map((request) => request.response())))
}

// The page's first navigation. A Playwright timeout is the side's retryable `step-timeout`; any other
// error is thrown, as it was before kinds existed.
async function navigate(page, url) {
  try {
    await page.goto(url)
  } catch (error) {
    if (error?.name === 'TimeoutError') return sideOutcome(firstLine(error), null, 'step-timeout')
    throw error
  }
  return null
}

// One attempt at the design side: its own context, page and census (`census`, or null).
async function captureDesign(browser, s, options, ctx, census, probe) {
  const context = await browser.newContext(options)
  try {
    await pauseClock(context)
    await addProbe(context)
    await routeDesign(context, ctx)
    const page = await context.newPage()
    page.setDefaultTimeout(Math.max(PLAYWRIGHT_DEFAULT_MS, TIMEOUT))
    watchWrites(page, probe)
    const navigated = await navigate(page, pathToFileURL(join(PROTOTYPE, `${designOf(s)}.dc.html`)).href)
    if (navigated) return navigated
    const first = await settleKinded(page, { advanceMs: SETTLE_ADVANCE_MS, afterGoto: true, ofFirstText: true })
    if (first.reason) return sideOutcome(first.reason, null, first.kind)
    const scaled = await applyTextScale(page, s, 'diseño', true)
    if (scaled.reason) return sideOutcome(scaled.reason, null, scaled.kind)
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
async function captureBuilt(browser, s, options, census, probe) {
  const context = await browser.newContext({ ...options, ...BUILT_DEVICE_PINS })
  try {
    return await captureBuiltIn(context, s, census, probe)
  } finally {
    await census?.dispose()
    await context.close()
  }
}

async function captureBuiltIn(context, s, census, probe) {
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
  watchWrites(page, probe)
  const navigated = await navigate(page, resolveFacts(s.route, placeholders))
  if (navigated) return navigated
  const first = await settleKinded(page, { advanceMs: SETTLE_ADVANCE_MS, afterGoto: true, ofFirstText: false })
  if (first.reason) return sideOutcome(first.reason, null, first.kind)
  for (const step of s.steps ?? []) {
    let reached
    try {
      await run(page, step, placeholders)
      await writesAnswered(probe)
      reached = await settleKinded(page, { advanceMs: SETTLE_ADVANCE_MS, ofFirstText: false })
    } catch (error) {
      reached = { reason: firstLine(error), kind: error?.name === 'TimeoutError' ? 'step-timeout' : 'other' }
    }
    if (reached.reason) {
      return sideOutcome(`estado no alcanzado en ${JSON.stringify(step)}: ${reached.reason}`, null, reached.kind)
    }
  }
  const scaled = await applyTextScale(page, s, 'construido', false)
  if (scaled.reason) return sideOutcome(scaled.reason, null, scaled.kind)
  const shot = await takeShot(page, { block: null, ofFirstText: false, census, side: 'built' })
  if (shot.failure !== null) return shot
  const outcome = await verifyAfterShot(page, s, 'construido', shot.png, 'built')
  await census?.after(page)
  return outcome
}

// `designWidth` and `builtWidth` are each column's width in CSS pixels. A row with a `design_viewport`
// is captured wider than its drawing's section (a section's clip is narrower than its viewport), so
// its design column takes the width its own PNG was shot at; any other row keeps its viewport's width.
async function composeSheet(browser, s, designWidth, builtWidth, design, built, notes, file) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const designColumn = s.design_viewport && design ? pngCssWidth(design, DEVICE_SCALE_FACTOR) : designWidth
  await page.setContent(
    sheetHtml({
      screen: s.screen,
      designFile: designOf(s),
      section: s.section,
      route: s.route,
      notes,
      designPng: design,
      builtPng: built,
      designWidth: designColumn,
      builtWidth,
    }),
  )
  await page.locator('body').screenshot({ path: file })
  await context.close()
}

// The census of one side of one attempt; its settle is the capture's own, with no clock advance.
const censusSide = (options, ofFirstText) =>
  createCensus({
    deviceScaleFactor: options.deviceScaleFactor,
    settle: (page) => settle(page, { advanceMs: 0, ofFirstText }),
  })

// The capture of one side, whole, again while it missed for load and its attempt sent no write
// (`settle.mjs`, ADR-0076). `capture(census, probe)` is one attempt, in its own context and with its
// own census (`makeCensus()`, or none); the row keeps the last attempt's. What the side could not do
// is a failure of the screen, not a throw, and that side has no PNG under any name. A pass after a
// miss is a note, never a failure; a side that missed every attempt keeps its failure and the kinds
// it missed by.
// Returns `{ png, reason }`: the reason is a fixed `named()` line, never the Spanish note.
async function attempt(label, side, ctx, makeCensus, capture) {
  // Counted as each attempt starts, so a capture that throws after a miss still counts its attempts.
  let started = 0
  try {
    const result = await captureWithRetries(
      async () => {
        started += 1
        const census = ctx.census ? makeCensus() : null
        if (ctx.census) ctx.census[side] = census
        const probe = { wrote: false }
        const outcome = await capture(census, probe)
        return { outcome, wrote: probe.wrote }
      },
      { attempts: CAPTURE_ATTEMPTS, retryable: isRetryableKind },
    )
    const note = retryNote(side, result, CAPTURE_ATTEMPTS)
    if (result.outcome.failure === null) {
      if (note) ctx.notes.push(note)
      if (started > 1) ctx.retried.push(started)
      return { png: result.outcome.png, reason: null }
    }
    fail(ctx, `${label} no se pudo capturar: ${result.outcome.failure}${note}`)
    if (started > 1) ctx.retried.push(started)
    return { png: null, reason: shotReason(result.outcome.failure, side) }
  } catch (error) {
    fail(ctx, `${label} no se pudo capturar: ${firstLine(error)}`)
    if (started > 1) ctx.retried.push(started)
    return { png: null, reason: named('could not take the shot', side) }
  }
}

// `--built-only` is read here and nowhere else: it picks the browser's launch flags (`launchOptions`) and, in the run
// loop below, the device scale factor of 1, the only place a run passes `scale`.
const builtOnly = values['built-only']
const browser = await chromium.launch(launchOptions(builtOnly))
const results = []
let failed = false
// The rows with a side captured more than once, and those sides' attempts: the run's summary line.
let retriedRows = 0
let retriedAttempts = 0
// The screens with no built screen yet (`route: null`) that this run went over. In a run over the whole
// registry (no `--only`) they are `not compared: no built screen`, not a failure of `--strict`; a row
// asked for by name with `--only` is still one (GH-601, human decision).
const unbuilt = new Set()
try {
  for (const s of screens) {
    if (only && !only.has(s.screen)) continue
    if (s.route === null) unbuilt.add(s.screen)
    // Each side has its own context options: the design side's size is `design_viewport` when the
    // row has one, the built side's is always `viewport ?? PHONE` (screens.mjs, `viewportsOf`).
    const sizes = viewportsOf(s)
    const scale = builtOnly ? 1 : undefined
    const designOptions = captureContextOptions({ width: sizes.design[0], height: sizes.design[1], url: facts.url, scale })
    const builtOptions = captureContextOptions({ width: sizes.built[0], height: sizes.built[1], url: facts.url, scale })
    // A row's side PNGs come only from this run's own buffers: the previous run's are deleted first.
    for (const file of staleFiles(readdirSync(out), [s.screen])) unlinkSync(join(out, file))
    const ctx = { notes: [], failures: [], census: values.census ? { design: null, built: null } : null, retried: [] }
    const { notes } = ctx
    const entry = { screen: s.screen, file: null, notes, design: null, built: null }
    // What each side recorded: a path only once its PNG write has returned, else a fixed reason.
    const sides = { design: { path: null, reason: null }, built: { path: null, reason: null } }
    try {
      const design = builtOnly
        ? { png: null, reason: null }
        : await attempt(
            'el diseño',
            'design',
            ctx,
            () => censusSide(designOptions, true),
            (census, probe) => captureDesign(browser, s, designOptions, ctx, census, probe),
          )
      let built = { png: null, reason: named('no built screen yet', 'built') }
      if (s.route === null) notes.push('todavía no existe en la app')
      else {
        built = await attempt(
          'lo construido',
          'built',
          ctx,
          () => censusSide(builtOptions, false),
          (census, probe) => captureBuilt(browser, s, builtOptions, census, probe),
        )
      }
      sides.design.reason = design.reason
      sides.built.reason = built.reason
      if (design.png) {
        const path = join(out, `${s.screen}.design.png`)
        writeFileSync(path, design.png)
        entry.design = sides.design.path = path
      }
      if (built.png) {
        const path = join(out, `${s.screen}.built.png`)
        writeFileSync(path, built.png)
        entry.built = sides.built.path = path
      }
      if (!builtOnly) {
        const file = join(out, `${s.screen}.png`)
        await composeSheet(browser, s, sizes.design[0], sizes.built[0], design.png, built.png, notes, file)
        entry.file = file
      }
    } catch (error) {
      fail(ctx, `la pantalla falló: ${firstLine(error)}`)
    }
    // A side with no path and no reason threw before it could record one.
    for (const side of builtOnly ? ['built'] : ['design', 'built']) {
      if (sides[side].path === null && !sides[side].reason) sides[side].reason = named('could not take the shot', side)
    }
    // A built-only row is captured when its built PNG exists: the design side is not asked for.
    Object.assign(entry, rowCapture(builtOnly ? { design: { path: sides.built.path, reason: null }, built: sides.built } : sides))
    if (ctx.census) {
      const censusSides = Object.entries(ctx.census).filter(
        ([, side]) => side !== null && Object.keys(side.record).length > 0,
      )
      if (censusSides.length) entry.census = Object.fromEntries(censusSides.map(([name, side]) => [name, side.record]))
    }
    if (ctx.failures.length) failed = true
    if (ctx.retried.length) {
      retriedRows += 1
      retriedAttempts += ctx.retried.reduce((sum, used) => sum + used, 0)
    }
    results.push(entry)
    console.log(`${s.screen}: ${notes.length ? notes.join('; ') : 'ok'}`)
  }
} finally {
  // The index first, so a browser that will not close cannot lose it; a write that fails is not
  // caught and fails the run.
  try {
    writeFileSync(join(out, 'index.json'), JSON.stringify(results, null, 2))
  } finally {
    await browser.close()
  }
}
console.log(retrySummary(retriedRows, retriedAttempts))
// Rows with no built screen, listed by name in the index (`capture: 'not-captured'`, built reason `no built
// screen yet`); a whole-registry run only counts them. A row with a built route that is not captured, a
// failed capture and a design side that failed (`failed`) all still fail `--strict`.
const excused = only ? [] : results.filter((e) => e.capture === 'not-captured' && unbuilt.has(e.screen))
if (excused.length) console.log(`not compared: no built screen: ${excused.length} rows`)
// `--strict`, after the index is written: any failed capture or any row not captured exits 1.
if (values.strict && (failed || results.some((e) => e.capture === 'not-captured' && !excused.includes(e)))) {
  console.error('comparisons: --strict and a row is not captured, or a capture failed (a side that did not settle or could not be reached, a font, a screen that threw, or a screen not built yet)')
  process.exitCode = 1
}
