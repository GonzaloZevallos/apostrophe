import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest'

// The seam: `node scripts/design/comparisons.mjs --census` and the `index.json` it writes. The
// built side is a tiny page served here (a long document, and a layer over the screen); the
// design side is the real prototype, served from the repo.
const SCRIPT = resolve(__dirname, '../../../scripts/design/comparisons.mjs')
const REGISTRY = resolve(__dirname, '../../../scripts/design/screens.json')
const FONT = resolve(
  __dirname,
  '../../node_modules/@fontsource/geist/files/geist-latin-400-normal.woff2',
)

// The step bound every case runs at (--step-timeout). Measured: one design page load starved of CPU
// takes 8 to 20 s (web/vite.config.ts; measured with the load average at 15 to 20, last re-measured
// 2026-10-27: slowest whole case 8.2 s); 60 s is 3 times the worst page load of 20 s.
const CENSUS_STEP_MS = 60_000
// The ceiling of one case. Measured 2026-10-27 (three runs of `vitest run --project census` beside
// `pytest -n 8` and `npm run typecheck` in loops; load average 15 to 20 at the start of each run):
// slowest case 8208 ms ('keeps the entry keys and both PNGs...'; the other two 4890 to 6526 ms).
// max(180000, 2 x 8208 = 16416, 8208 + CENSUS_STEP_MS = 68208) = 180000, so the 180 s floor sets it:
// a case that only waits on a step can take up to CENSUS_STEP_MS for each of its several steps.
const CENSUS_TEST_MS = 180_000

const FACE = [400, 500, 600, 700]
  .map(
    (weight) =>
      `@font-face{font-family:'Plus Jakarta Sans';font-weight:${weight};src:url(/font.woff2) format('woff2')}`,
  )
  .join('')

const page = (body: string): string =>
  `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/font.css">
<style>body{margin:0;font-family:'Plus Jakarta Sans',sans-serif}</style>${body}`

const PAGES: Record<string, string> = {
  // A box sized by the viewport that grows only: the screen is `100vh` high with its content
  // overflowing, and `.fill` is out of flow, so the document is as tall after the growth as before.
  'n': page(
    `<div class="pantalla" style="height:100vh"><div class="tall" style="height:2000px">Nueva venta</div>
     <div class="fill" style="position:absolute;top:0;left:0;width:5px;height:100vh"></div></div>
     <div class="barra" style="position:fixed;bottom:0;left:0;right:0;height:60px"></div>
     <div class="cinta" style="position:sticky;top:8px;height:20px"></div>`,
  ),
  // A layer over a document taller than the screen: the shot never grows it, the census does, and
  // the page is calm at the shot's height and never calm once the census has grown it. The timer is
  // installed at load and reads `innerHeight` on each tick, so the page does not depend on when the
  // browser delivers a `resize` event (on GitHub's runner it came after the settle's calm frames).
  'r': page(
    `<div style="height:2000px">Nueva venta</div>
     <div class="capa" style="position:fixed;inset:0;background:#fff"></div>
     <script>let ticks = 0
     setInterval(() => { if (innerHeight > 1500) document.body.dataset.t = String((ticks += 1)) }, 5)</script>`,
  ),
  'j': page(
    `<div class="fondo">Nueva venta</div>
     <div class="capa" style="position:fixed;inset:0;overflow:auto">
       <div class="hoja" style="height:3000px"></div></div>`,
  ),
}

// Pages that depend on how many times they were loaded (GH-601), told by their token like the rest:
// the first load of a `late-*` token writes the DOM on every tick of the capture's clock, so no frame
// of it is ever calm; every later load is a calm page. `never` is never calm on any load. Each case
// uses its own token, so the count of one never reaches another.
const NEVER_CALM = page(
  `<div>Nueva venta</div>
   <script>let ticks = 0
   setInterval(() => { document.body.dataset.t = String((ticks += 1)) }, 5)</script>`,
)
// The same page, which also sends a write as it loads: its side is never captured again.
const WRITES = NEVER_CALM.replace('</script>', "\nfetch('/write', { method: 'POST' })</script>")
const CALM = page('<div>Nueva venta</div>')
const loads = new Map<string, number>()
const pageOf = (token: string): string | undefined => {
  if (token === 'never') return NEVER_CALM
  if (token === 'wrote') return WRITES
  if (!token.startsWith('late-')) return PAGES[token]
  const count = (loads.get(token) ?? 0) + 1
  loads.set(token, count)
  return count === 1 ? NEVER_CALM : CALM
}

let server: Server
let dir: string
let url: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'census-'))
  server = createServer((request, response) => {
    const path = request.url ?? '/'
    if (path === '/font.css') {
      response.setHeader('content-type', 'text/css')
      response.end(FACE)
    } else if (path === '/font.woff2') {
      response.setHeader('content-type', 'font/woff2')
      response.end(readFileSync(FONT))
    } else {
      response.setHeader('content-type', 'text/html')
      // The page is told by its token, the last segment of the route.
      response.end(pageOf(/[^/]*$/.exec(path)?.[0] ?? '') ?? page(''))
    }
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((done) => server.close(done))
  rmSync(dir, { recursive: true, force: true })
})

type Side = Record<string, unknown> & {
  sizes_changed?: Array<Record<string, unknown>>
  pinned?: Array<Record<string, unknown>>
}
type Run = { entries: Entry[]; status: number; output: string }
type Entry = {
  screen: string
  notes: string[]
  design: string | null
  built: string | null
  capture?: 'captured' | 'not-captured'
  reasons?: { design?: string; built?: string }
  census?: { design?: Side; built?: Side }
}

// Asynchronous on purpose: the page is served by this very process.
async function run(name: string, only: string, extra: string[], joinToken = 'j'): Promise<Run> {
  return runWith(name, only, ['--step-timeout', String(CENSUS_STEP_MS), ...extra], joinToken)
}

function writeFacts(name: string, joinToken = 'j'): string {
  const facts = join(dir, `${name}.json`)
  writeFileSync(
    facts,
    JSON.stringify({
      today: '2026-09-16',
      url,
      email: 'a@b.co',
      account_kinds: {},
      ids: { new_business_token: 'n', join_token: joinToken, reset_token: 'r' },
    }),
  )
  return facts
}

// One spawn of the script with the exact arguments given: its exit status and what it printed.
async function spawnScript(args: string[]): Promise<{ status: number; output: string }> {
  const child = spawn('node', [SCRIPT, ...args], {
    detached: true,
  })
  // `detached` makes the child the leader of its own process group, so `-pid` names that group.
  // Signalling the group reaches the Chromium it launched even after node exited or crashed, which
  // a signal to the child alone would not. `ESRCH` means the group is already gone: the normal case.
  onTestFinished(() => {
    if (child.pid === undefined) return
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
  })
  let output = ''
  child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()))
  child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()))
  const status = await new Promise<number>((done) => child.on('close', (code) => done(code ?? -1)))
  return { status, output }
}

async function runWith(name: string, only: string, extra: string[], joinToken = 'j'): Promise<Run> {
  const out = join(dir, name)
  const { status, output } = await spawnScript(['--facts', writeFacts(name, joinToken), '--out', out, '--only', only, ...extra])
  const index = join(out, 'index.json')
  // A child that died before writing the index (a missing browser, say) fails with its own exit
  // status and output, not with an ENOENT on a file it never wrote.
  if (!existsSync(index)) throw new Error(`comparisons.mjs exited with status ${status} and wrote no index.json:\n${output}`)
  return { entries: JSON.parse(readFileSync(index, 'utf-8')), status, output }
}

describe('comparisons.mjs --census', () => {
  it('writes the census fields of a long page and of a layer, on both sides', async () => {
    const { entries, status, output } = await run('on', 'NegocioNuevo,Invitacion', ['--census', '--strict'])
    expect(status, output).toBe(0)
    const [tall, layer] = entries as [Entry, Entry]

    const built = tall.census?.built
    expect(built).toMatchObject({
      device_scale_factor: 2,
      viewport_before: { width: 390, height: 844 },
      layer: false,
      wide: false,
      grown: true,
      class: 'grown',
    })
    expect(built?.document).toMatchObject({ scroll_width: 390, inner_width: 390, inner_height: 844 })
    expect(built?.viewport_shot).toMatchObject({ width: 390 })
    expect(built?.census_error).toBeUndefined()
    const fill = built?.sizes_changed?.find((entry) => entry.path === 'div.fill')
    expect(fill).toMatchObject({ ordinal: 0, before: { height: 844 }, same_node: true, pantalla: false })
    expect(built?.sizes_changed?.find((entry) => entry.path === 'div.pantalla')).toMatchObject({ pantalla: true })
    expect(fill).toMatchObject({ query_900: 'n/a' })
    const document = built?.document as { scroll_height: number } | undefined
    expect(fill?.after).toMatchObject({ height: document?.scroll_height })
    expect(built?.sizes_changed?.some((entry) => entry.path === 'div.barra')).toBe(false)
    // The phone side records its pinned elements, each with the class `pinnedClass` gives it.
    expect(built?.pinned).toEqual([
      expect.objectContaining({
        path: 'div.barra',
        position: 'fixed',
        inset_top: 784, // the computed value of `top` is the used one: 844 high, 60 tall
        inset_bottom: 0,
        transform: 'none',
        pinned_class: 'chrome',
      }),
      expect.objectContaining({ path: 'div.cinta', position: 'sticky', inset_top: 8, pinned_class: 'content' }),
    ])
    expect(built?.pinned?.[0]).toHaveProperty('margin_top')
    expect(built?.pinned?.[0]).toHaveProperty('margin_bottom')

    const covered = layer.census?.built
    expect(covered).toMatchObject({ layer: true, class: 'layer' })
    expect(covered?.pinned).toBeUndefined()
    expect(covered?.layer_metrics).toMatchObject({
      overflows: true,
      frame_inside_viewport: true,
      scroll_containers: [{ path: 'div.capa', ordinal: 0, client_height: 844, scroll_height: 3000, scroll_top: 0 }],
    })

    expect(tall.census?.design).toMatchObject({ device_scale_factor: 2, viewport_before: { width: 390 } })
    expect(tall.design).not.toBeNull()
    expect(tall.built).not.toBeNull()
  }, CENSUS_TEST_MS)

  it('keeps the entry keys and both PNGs the same as without it', async () => {
    const on = await run('same-on', 'NegocioNuevo', ['--census', '--strict'])
    const off = await run('same-off', 'NegocioNuevo', ['--strict'])
    expect(on.status, on.output).toBe(0)
    expect(off.status, off.output).toBe(0)
    expect(Object.keys(off.entries[0] as Entry)).toEqual(['screen', 'file', 'notes', 'design', 'built', 'capture'])
    expect(off.entries[0]?.census).toBeUndefined()
    const bytes = (path: string | null): Buffer => readFileSync(path as string)
    expect(bytes(on.entries[0]?.design ?? null).equals(bytes(off.entries[0]?.design ?? null))).toBe(true)
    expect(bytes(on.entries[0]?.built ?? null).equals(bytes(off.entries[0]?.built ?? null))).toBe(true)
  }, CENSUS_TEST_MS)

  it('records a census that cannot settle as a fixed error and changes nothing else', async () => {
    const { entries, status, output } = await run('error', 'Reset', ['--census', '--strict'])
    expect(status, output).toBe(0)
    const [entry] = entries as [Entry]
    expect(entry.built).not.toBeNull()
    expect(entry.census?.built).toMatchObject({
      census_error: 'census settle after growth failed',
      census_settle: 'unsettled',
      class: 'layer',
    })
    expect(entry.census?.built?.sizes_changed).toBeUndefined()
    expect(entry.census?.design?.census_error).toBeUndefined()
  }, CENSUS_TEST_MS)

  it('fails the built side when a step cannot finish within --step-timeout', async () => {
    const { status, output } = await runWith('forced', 'Reset', ['--census', '--strict', '--step-timeout', '1'])
    expect(status, output).toBe(1)
    expect(output).toContain('lo construido no se pudo capturar')
  }, CENSUS_TEST_MS)

  // Measured 2026-11-07 (one `vitest run --project census`, load average 12 to 15 at the start): the
  // three cases below took 6564 ms (second attempt passes), 10851 ms (never calm, three attempts, the
  // slowest) and 6744 ms (the same with --census); well under the 30 s that would have dropped the
  // never-calm case.
  it('captures the built side again from a fresh context when the first load never comes to rest', async () => {
    const { entries, status, output } = await run('late-a', 'Invitacion', [], 'late-a')
    expect(status, output).toBe(0)
    const [entry] = entries as [Entry]
    expect(entry.built).not.toBeNull()
    expect(readFileSync(entry.built as string).subarray(1, 4).toString()).toBe('PNG')
    expect(entry.notes).toEqual(['built: settled on attempt 2 of 3 after unsettled'])
    expect(output).toContain('retries: 1 rows, 2 attempts')
  }, CENSUS_TEST_MS)

  it('fails the side with the kinds of all three attempts when it never comes to rest', async () => {
    const { entries, status, output } = await run('never', 'Invitacion', ['--strict'], 'never')
    expect(status, output).toBe(1)
    const [entry] = entries as [Entry]
    expect(entry.built).toBeNull()
    expect(entry.design).not.toBeNull()
    expect(entry.notes).toEqual([
      'lo construido no se pudo capturar: la pantalla no quedó quieta (after 3 attempts: unsettled, unsettled, unsettled)',
    ])
    expect(output).toContain('retries: 1 rows, 3 attempts')
  }, CENSUS_TEST_MS)

  it('does not capture a side again once its page sent a write', async () => {
    const { entries, status, output } = await run('wrote', 'Invitacion', ['--strict'], 'wrote')
    expect(status, output).toBe(1)
    const [entry] = entries as [Entry]
    expect(entry.built).toBeNull()
    expect(entry.notes).toEqual(['lo construido no se pudo capturar: la pantalla no quedó quieta'])
    expect(output).toContain('retries: 0 rows, 0 attempts')
  }, CENSUS_TEST_MS)

  it('writes the census of the attempt that passed, with no error or settle miss from the one before', async () => {
    const { entries, status, output } = await run('late-c', 'Invitacion', ['--census'], 'late-c')
    expect(status, output).toBe(0)
    const [entry] = entries as [Entry]
    expect(entry.built).not.toBeNull()
    expect(entry.census?.built).toMatchObject({ device_scale_factor: 2, viewport_before: { width: 390 } })
    expect(entry.census?.built?.census_settle).toBeUndefined()
    expect(entry.census?.built?.census_error).toBeUndefined()
    expect(entry.notes).toEqual(['built: settled on attempt 2 of 3 after unsettled'])
  }, CENSUS_TEST_MS)

  it.each(['0', 'abc'])('rejects --step-timeout %s before any browser starts', async (value) => {
    await expect(runWith(`bad-${value}`, 'Reset', ['--strict', '--step-timeout', value])).rejects.toThrow(/status 2/)
  })
})

// Exit codes and the capture fields. The registry is a fixture: the `Reset` row's real design with
// no route, so only the design side is taken and the built side is a screen not built yet.
describe('comparisons.mjs exit status and capture', () => {
  const NOT_BUILT = 'shot: no built screen yet (built)'
  const fixture = (name: string): string => {
    const path = join(dir, `${name}.registry.json`)
    const real = JSON.parse(readFileSync(REGISTRY, 'utf-8')) as { screens: Array<{ screen: string }> }
    const reset = real.screens.find((row) => row.screen === 'Reset')
    writeFileSync(path, JSON.stringify({ screens: [{ ...reset, route: null }] }))
    return path
  }

  it('exits 0 without --strict when no row is captured, and the index says why', async () => {
    const { entries, status, output } = await run('plain', 'Reset', ['--registry', fixture('plain')])
    expect(status, output).toBe(0)
    const [entry] = entries as [Entry]
    expect(entry.capture).toBe('not-captured')
    expect(entry.reasons).toEqual({ built: NOT_BUILT })
    expect(entry.design).not.toBeNull()
    expect(entry.built).toBeNull()
  }, CENSUS_TEST_MS)

  it('exits non-zero with --strict, after the index is written', async () => {
    const { entries, status, output } = await run('strict', 'Reset', ['--strict', '--registry', fixture('strict')])
    expect(status, output).not.toBe(0)
    expect(status).not.toBe(2)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.reasons?.built).toBe(NOT_BUILT)
    expect(output).toContain('comparisons: --strict and a row is not captured')
  }, CENSUS_TEST_MS)

  // A run over the whole registry (no --only): rows with no built screen are counted, not failed (GH-601).
  const wholeRun = async (name: string, rows: string[], joinToken = 'j'): Promise<Run> => {
    const path = join(dir, `${name}.registry.json`)
    const real = JSON.parse(readFileSync(REGISTRY, 'utf-8')) as { screens: Array<{ screen: string }> }
    const reset = real.screens.find((row) => row.screen === 'Reset')
    const built = real.screens.filter((row) => rows.includes(row.screen))
    writeFileSync(path, JSON.stringify({ screens: [{ ...reset, route: null }, ...built] }))
    const out = join(dir, name)
    const { status, output } = await spawnScript([
      '--facts', writeFacts(name, joinToken), '--out', out, '--step-timeout', String(CENSUS_STEP_MS),
      '--strict', '--registry', path,
    ])
    return { entries: JSON.parse(readFileSync(join(out, 'index.json'), 'utf-8')), status, output }
  }

  it('exits 0 with --strict over the whole registry when the only rows not captured have no built screen', async () => {
    const { entries, status, output } = await wholeRun('whole-ok', [])
    expect(status, output).toBe(0)
    expect(output).toContain('not compared: no built screen: 1 rows')
    const [entry] = entries as [Entry]
    expect(entry.screen).toBe('Reset')
    expect(entry.capture).toBe('not-captured')
    expect(entry.reasons).toEqual({ built: NOT_BUILT })
  }, CENSUS_TEST_MS)

  it('still exits 1 with --strict over the whole registry when a row with a built screen is not captured', async () => {
    const { entries, status, output } = await wholeRun('whole-miss', ['Invitacion'], 'never')
    expect(status, output).toBe(1)
    expect(output).toContain('not compared: no built screen: 1 rows')
    expect(output).toContain('comparisons: --strict and a row is not captured')
    const invitacion = entries.find((e) => e.screen === 'Invitacion')
    expect(invitacion?.capture).toBe('not-captured')
    expect(invitacion?.built).toBeNull()
  }, CENSUS_TEST_MS)

  it('exits 2 and writes no index when the registry cannot be read', async () => {
    const out = join(dir, 'no-registry')
    const { status, output } = await spawnScript([
      '--facts', writeFacts('no-registry'), '--out', out, '--registry', join(dir, 'missing.json'),
    ])
    expect(status, output).toBe(2)
    expect(output).toContain('comparisons: the registry could not be read')
    expect(existsSync(join(out, 'index.json'))).toBe(false)
  }, CENSUS_TEST_MS)

  it('fails the run when index.json cannot be written', async () => {
    const out = join(dir, 'unwritable')
    mkdirSync(join(out, 'index.json'), { recursive: true })
    const { status, output } = await spawnScript([
      '--facts', writeFacts('unwritable'), '--out', out, '--only', 'Reset', '--registry', fixture('unwritable'),
    ])
    expect(status, output).not.toBe(0)
    expect(output).toMatch(/EISDIR/)
  }, CENSUS_TEST_MS)
})
