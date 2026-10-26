import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// The seam: `node scripts/design/comparisons.mjs --census` and the `index.json` it writes. The
// built side is a tiny page served here (a long document, and a layer over the screen); the
// design side is the real prototype, served from the repo.
const SCRIPT = resolve(__dirname, '../../../scripts/design/comparisons.mjs')
const FONT = resolve(
  __dirname,
  '../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2',
)

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
     <div class="barra" style="position:fixed;bottom:0;left:0;right:0;height:60px"></div>`,
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
      response.end(PAGES[/[^/]*$/.exec(path)?.[0] ?? ''] ?? page(''))
    }
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((done) => server.close(done))
  rmSync(dir, { recursive: true, force: true })
})

type Side = Record<string, unknown> & { sizes_changed?: Array<Record<string, unknown>> }
type Run = { entries: Entry[]; status: number; output: string }
type Entry = {
  screen: string
  design: string | null
  built: string | null
  census?: { design?: Side; built?: Side }
}

// Asynchronous on purpose: the page is served by this very process.
async function run(name: string, only: string, extra: string[]): Promise<Run> {
  const facts = join(dir, `${name}.json`)
  const out = join(dir, name)
  writeFileSync(
    facts,
    JSON.stringify({
      today: '2026-09-16',
      url,
      email: 'a@b.co',
      account_kinds: {},
      ids: { new_business_token: 'n', join_token: 'j', reset_token: 'r' },
    }),
  )
  const child = spawn('node', [SCRIPT, '--facts', facts, '--out', out, '--only', only, '--strict', ...extra])
  let output = ''
  child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()))
  child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()))
  const status = await new Promise<number>((done) => child.on('close', (code) => done(code ?? -1)))
  const index = join(out, 'index.json')
  // A child that died before writing the index (a missing browser, say) fails with its own exit
  // status and output, not with an ENOENT on a file it never wrote.
  if (!existsSync(index)) throw new Error(`comparisons.mjs exited with status ${status} and wrote no index.json:\n${output}`)
  return { entries: JSON.parse(readFileSync(index, 'utf-8')), status, output }
}

describe('comparisons.mjs --census', () => {
  it('writes the census fields of a long page and of a layer, on both sides', async () => {
    const { entries, status, output } = await run('on', 'NegocioNuevo,Invitacion', ['--census'])
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
    expect(fill?.after).toMatchObject({ height: built?.document?.scroll_height })
    expect(built?.sizes_changed?.some((entry) => entry.path === 'div.barra')).toBe(false)

    const covered = layer.census?.built
    expect(covered).toMatchObject({ layer: true, class: 'layer' })
    expect(covered?.layer_metrics).toMatchObject({
      overflows: true,
      frame_inside_viewport: true,
      scroll_containers: [{ path: 'div.capa', ordinal: 0, client_height: 844, scroll_height: 3000, scroll_top: 0 }],
    })

    expect(tall.census?.design).toMatchObject({ device_scale_factor: 2, viewport_before: { width: 390 } })
    expect(tall.design).not.toBeNull()
    expect(tall.built).not.toBeNull()
  }, 180_000)

  it('keeps the entry keys and both PNGs the same as without it', async () => {
    const on = await run('same-on', 'NegocioNuevo', ['--census'])
    const off = await run('same-off', 'NegocioNuevo', [])
    expect(on.status, on.output).toBe(0)
    expect(off.status, off.output).toBe(0)
    expect(Object.keys(off.entries[0] as Entry)).toEqual(['screen', 'file', 'notes', 'design', 'built'])
    expect(off.entries[0]?.census).toBeUndefined()
    const bytes = (path: string | null): Buffer => readFileSync(path as string)
    expect(bytes(on.entries[0]?.design ?? null).equals(bytes(off.entries[0]?.design ?? null))).toBe(true)
    expect(bytes(on.entries[0]?.built ?? null).equals(bytes(off.entries[0]?.built ?? null))).toBe(true)
  }, 180_000)

  it('records a census that cannot settle as a fixed error and changes nothing else', async () => {
    const { entries, status, output } = await run('error', 'Reset', ['--census'])
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
  }, 180_000)
})
