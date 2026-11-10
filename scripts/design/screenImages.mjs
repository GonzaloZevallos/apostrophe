// Screen images (docs/product/screen-images.md): the pure core of publishing them. One PNG per
// row goes in, a lossless webp comes out, and a plan says what to write, remove, keep and fail.
// Only the encoder and the decoder touch sharp; everything else is data in, data out, so the
// rules are tested without a browser or a disk (`screenImagesRun.mjs` is the one that reads and
// writes files).
//
// "Changed" is decided on decoded pixels, never on webp bytes or hashes (ADR-0079): a new
// encoder version that writes other bytes for the same picture must not touch a committed image.

import sharp from 'sharp'
import { screenImageRows } from './screens.mjs'

// The one lever on the size of an image: the encoder's effort (0 to 6). The encoding stays
// lossless; changing anything else needs the owner's decision (ADR-0079).
export const EFFORT = 6

// The Playwright image variant the capture runs in; the version comes from the lockfile.
export const PLAYWRIGHT_DISTRO = 'noble'

// Why a run changed nothing, as the sentence `summary.md` shows.
export const NOT_STARTED = {
  'docker-unavailable': 'Docker is not available.',
  'image-unavailable': 'The Playwright image could not be pulled.',
  'app-not-started': 'The sample app did not start.',
}

// The note `screen-images.sh --twice` and `--apply` put on a row whose two captures differ.
export const UNSTABLE_NOTE = 'unstable between two captures'

// The notes of `comparisons.mjs` that are failures (its `fail()`); its other notes are information.
const FAILURE_NOTE =
  /no se pudo capturar|la pantalla falló|tipografía local no disponible|se abortó un pedido de tipografía/

/** @param {string} screen */
export const imageFile = (screen) => `${screen}.webp`

/**
 * Lossless webp, fixed effort, no metadata (sharp writes none unless asked to).
 * @param {Buffer} png
 * @returns {Promise<Buffer>}
 */
export function encodeWebp(png) {
  return sharp(png).webp({ lossless: true, effort: EFFORT }).toBuffer()
}

/**
 * A webp or a PNG as RGBA bytes.
 * @param {Buffer} buf
 */
export async function decodeRgba(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, data }
}

/**
 * @param {{ width: number, height: number, data: Buffer }} a
 * @param {{ width: number, height: number, data: Buffer }} b
 */
export function samePixels(a, b) {
  return a.width === b.width && a.height === b.height && a.data.equals(b.data)
}

/**
 * @param {Readonly<Record<string, unknown>>} entry
 * @returns {string | null} the failure of the row's entry, or null
 */
function entryFailure(entry) {
  const notes = Array.isArray(entry.notes) ? entry.notes.filter((n) => typeof n === 'string') : []
  const note = notes.find((n) => n === UNSTABLE_NOTE || FAILURE_NOTE.test(n))
  if (note !== undefined) return note
  if (entry.built === null || entry.built === undefined) {
    const reasons = /** @type {{ built?: unknown } | undefined} */ (entry.reasons)
    return typeof reasons?.built === 'string' ? `no built PNG: ${reasons.built}` : 'no built PNG'
  }
  return null
}

/**
 * What a publish run does with `docs/assets/screens/`.
 * @param {object} input
 * @param {ReadonlyArray<Readonly<Record<string, unknown>>>} input.registry
 * @param {ReadonlyArray<string>} input.committed file names in the folder
 * @param {ReadonlyArray<Readonly<Record<string, unknown>>> | null} input.index
 * @param {ReadonlyMap<string, 'same' | 'different' | 'unreadable-new'>} input.changed
 * @param {boolean} input.appStarted
 * @param {keyof typeof NOT_STARTED} [input.reason] why the app did not start
 */
export function planPublish({ registry, committed, index, changed, appStarted, reason = 'app-not-started' }) {
  const rows = screenImageRows(registry).map((s) => String(s.screen))
  /** @param {string} why */
  const failAll = (why) => rows.map((row) => ({ row, reason: why }))
  if (!appStarted) {
    if (!(reason in NOT_STARTED)) throw new Error(`unknown reason ${JSON.stringify(reason)}`)
    return { write: [], remove: [], keep: [], failures: failAll(NOT_STARTED[reason]), appStarted, reason }
  }
  if (index === null) {
    return { write: [], remove: [], keep: [], failures: failAll('no index'), appStarted }
  }
  const byScreen = new Map()
  for (const entry of index) if (!byScreen.has(entry.screen)) byScreen.set(entry.screen, entry)
  const have = new Set(committed)
  /** @type {Array<{ file: string, status: 'new' | 'changed' }>} */
  const write = []
  /** @type {string[]} */
  const keep = []
  /** @type {Array<{ row: string, reason: string }>} */
  const failures = []
  for (const row of rows) {
    const entry = byScreen.get(row)
    const failure = entry === undefined ? 'not in the index' : entryFailure(entry)
    if (failure !== null) {
      failures.push({ row, reason: failure })
      continue
    }
    const file = imageFile(row)
    const state = changed.get(row)
    if (state === undefined) failures.push({ row, reason: 'not compared with the committed image' })
    else if (state === 'unreadable-new') failures.push({ row, reason: 'the built PNG could not be read' })
    else if (state === 'same' && have.has(file)) keep.push(row)
    else write.push({ file, status: have.has(file) ? 'changed' : 'new' })
  }
  const wanted = new Set(rows.map(imageFile))
  const remove = committed.filter((name) => !wanted.has(name)).sort()
  return { write, remove, keep, failures, appStarted }
}

/** @param {number} bytes */
const bytesText = (bytes) => `${bytes} B`

/**
 * @param {string} heading
 * @param {ReadonlyArray<string>} lines
 */
const section = (heading, lines) => [`## ${heading}`, '', ...(lines.length ? lines.map((l) => `- ${l}`) : ['- none']), '']

/**
 * The Markdown report of a plan.
 * @param {object} input
 * @param {ReturnType<typeof planPublish>} input.plan
 * @param {Readonly<Record<string, number>>} input.sizes bytes of each image the folder holds after the plan, by file name
 * @param {string | null} input.baseSha
 * @param {'local' | 'pr' | 'master'} input.mode
 */
export function renderSummary({ plan, sizes, baseSha, mode }) {
  const out = ['# Screen images', '']
  if (!plan.appStarted && plan.reason !== undefined) out.push(NOT_STARTED[plan.reason], '')
  if (mode === 'pr') {
    out.push(
      `Base: ${baseSha ?? 'unknown'}`,
      '',
      'A listed change may come from a merge whose images are not committed yet.',
      '',
    )
  }
  const named = (/** @type {string} */ file) => file.replace(/\.webp$/, '')
  out.push(
    ...section('New', plan.write.filter((w) => w.status === 'new').map((w) => named(w.file))),
    ...section('Changed', plan.write.filter((w) => w.status === 'changed').map((w) => named(w.file))),
    ...section('Removed', plan.remove),
    ...section('Failed', plan.failures.map((f) => `${f.row}: ${f.reason}`)),
  )
  const files = Object.keys(sizes).sort()
  const total = files.reduce((sum, file) => sum + sizes[file], 0)
  out.push(
    '## Size',
    '',
    `Total of docs/assets/screens/: ${bytesText(total)} in ${files.length} images`,
    '',
    ...files.map((file) => `- ${file}: ${bytesText(sizes[file])}`),
    '',
  )
  return out.join('\n')
}

/**
 * The Playwright image tag of the lockfile's `playwright` version.
 * @param {string | { packages?: Record<string, { version?: string } | undefined> }} lockfileJson
 */
export function playwrightImage(lockfileJson) {
  const lock = typeof lockfileJson === 'string' ? JSON.parse(lockfileJson) : lockfileJson
  const version = lock?.packages?.['node_modules/playwright']?.version
  if (typeof version !== 'string' || version === '') {
    throw new Error('web/package-lock.json has no node_modules/playwright version')
  }
  return `mcr.microsoft.com/playwright:v${version}-${PLAYWRIGHT_DISTRO}`
}

/**
 * The arguments after `docker run` of a capture: the checkout and its modules read-only, the
 * output folder the only writable mount, and no mount target inside the checkout.
 * @param {object} input
 * @param {string} input.image
 * @param {string} input.repoDir
 * @param {number} input.uid
 * @param {number} input.gid
 * @param {string} input.factsPath
 * @param {string} input.outDir
 * @param {ReadonlyArray<string>} input.only
 * @returns {string[]}
 */
export function containerArgs({ image, repoDir, uid, gid, factsPath, outDir, only }) {
  return [
    '--rm',
    '--init',
    '--ipc=host',
    '--network',
    'host',
    '--user',
    `${uid}:${gid}`,
    '-e',
    'HOME=/tmp',
    '-v',
    `${repoDir}:/work/repo:ro`,
    '-v',
    `${repoDir}/web/node_modules:/work/node_modules:ro`,
    '-v',
    `${factsPath}:/work/facts.json:ro`,
    '-v',
    `${outDir}:/out`,
    '-w',
    '/work/repo',
    image,
    'node',
    'scripts/design/comparisons.mjs',
    '--built-only',
    '--facts',
    '/work/facts.json',
    '--out',
    '/out',
    '--only',
    only.join(','),
  ]
}
