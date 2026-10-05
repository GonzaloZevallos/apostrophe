// Comparisons (agentic-system ADR-0040): each design screen next to the same screen of the
// sample app, at the same width, one PNG per screen.
//
//   node scripts/design/comparisons.mjs --facts <sample.json> --out <dir> [--only A,B]
//
// `--facts` is what `scripts/design/sample-app.sh` wrote. Screens and how to reach each
// state come from `scripts/design/screens.json`. A step that fails, a screen not built
// yet and a page wider than its viewport are written on the image and in `index.json`,
// never thrown: one broken screen must not hide the others.

import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { assertScreens } from './screens.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const PROTOTYPE = join(REPO, 'docs', 'product', 'design-system', 'pantallas')
const require = createRequire(join(REPO, 'web', 'package.json'))
const { chromium } = require('playwright')

const { values } = parseArgs({
  options: { facts: { type: 'string' }, out: { type: 'string' }, only: { type: 'string' } },
})
if (!values.facts || !values.out) {
  console.error('usage: comparisons.mjs --facts <sample.json> --out <dir> [--only A,B]')
  process.exit(2)
}
const facts = JSON.parse(readFileSync(values.facts, 'utf-8'))
const { screens } = JSON.parse(readFileSync(join(HERE, 'screens.json'), 'utf-8'))
assertScreens(screens)
const only = values.only ? new Set(values.only.split(',')) : null
const out = resolve(values.out)
mkdirSync(out, { recursive: true })

const PHONE = [390, 844]
const TIMEOUT = 8000

// `{name}` in a route or a step value: one of the sample's ids, or its user's email.
const PLACEHOLDERS = { ...facts.ids, email: facts.email }

function resolveFacts(template) {
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    if (!(name in PLACEHOLDERS)) throw new Error(`no sample fact named ${name}`)
    return String(PLACEHOLDERS[name])
  })
}

async function run(page, step) {
  if (step.click) await page.getByText(step.click, { exact: true }).first().click()
  else if (step.fill) await page.getByLabel(step.fill.label).first().fill(resolveFacts(step.fill.value))
  else if (step.wait) await page.getByText(step.wait, { exact: true }).first().waitFor()
  else throw new Error(`unknown step ${JSON.stringify(step)}`)
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => document.fonts.ready)
}

async function captureDesign(browser, s, options) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  await page.goto(pathToFileURL(join(PROTOTYPE, `${s.screen}.dc.html`)).href)
  await settle(page)
  const png = await page.screenshot({ fullPage: true })
  await context.close()
  return png
}

// The built screen in the state its entry asks for; what could not be reached, or a page
// wider than its viewport, goes into `notes`.
async function captureBuilt(browser, s, options, notes) {
  const context = await browser.newContext(options)
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
  if (!s.signed_out) {
    const login = await context.request.post('/auth/login', {
      data: { email: facts.email, password: facts.password },
    })
    if (!login.ok()) throw new Error(`login failed: ${login.status()}`)
  }
  const page = await context.newPage()
  page.setDefaultTimeout(TIMEOUT)
  await page.goto(resolveFacts(s.route))
  await settle(page)
  for (const step of s.steps ?? []) {
    try {
      await run(page, step)
      await settle(page)
    } catch (error) {
      notes.push(`estado no alcanzado en ${JSON.stringify(step)}: ${String(error).split('\n')[0]}`)
      break
    }
  }
  const width = options.viewport.width
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scrollWidth > width) notes.push(`desborda: ${scrollWidth}px de ancho en ${width}px`)
  const png = await page.screenshot({ fullPage: true })
  await context.close()
  return png
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
    <div class="row">${column(`Diseño · ${s.screen}.dc.html`, design)}${column(`Construido · ${s.route ?? 'sin ruta'}`, built)}</div>`)
  await page.locator('body').screenshot({ path: file })
  await context.close()
}

const browser = await chromium.launch()
const results = []
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
    const notes = []
    const design = await captureDesign(browser, s, options)
    let built = null
    if (s.route === null) notes.push('todavía no existe en la app')
    else built = await captureBuilt(browser, s, options, notes)
    const file = join(out, `${s.screen}.png`)
    await composeSheet(browser, s, width, design, built, notes, file)
    results.push({ screen: s.screen, file, notes })
    console.log(`${s.screen}: ${notes.length ? notes.join('; ') : 'ok'}`)
  }
} finally {
  await browser.close()
}
writeFileSync(join(out, 'index.json'), JSON.stringify(results, null, 2))
