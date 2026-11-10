// The driver of the screen images over the filesystem (docs/product/screen-images.md, ADR-0079).
// `screenImages.mjs` decides; this module reads the folders, tells the pure plan what it needs
// to know, and applies what the plan says. It decides nothing about what is written, removed or
// failed.
//
//   node scripts/design/screenImagesRun.mjs plan --index <index.json> --built-dir <dir> --committed <dir> --out <dir>
//                                          [--base-sha <sha>] [--mode local|pr|master] [--registry <screens.json>]
//   node scripts/design/screenImagesRun.mjs compare --a <dir> --b <dir> --out <index.json>
//   node scripts/design/screenImagesRun.mjs apply --out <dir> --target <dir>
//   node scripts/design/screenImagesRun.mjs not-started --reason <reason> --out <dir> [--registry <screens.json>]
//   node scripts/design/screenImagesRun.mjs exit-code --out <dir>
//
// `plan` writes `plan.json` (always with `appStarted` and the failures), `summary.md` and the webp
// of every row to write into `--out`. `exit-code` prints nothing and exits 1 when the plan did not
// start the app or has a failure, else 0. Bad usage exits 2.

import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import {
  decodeRgba,
  encodeWebp,
  imageFile,
  NOT_STARTED,
  planPublish,
  renderSummary,
  samePixels,
  UNSTABLE_NOTE,
} from './screenImages.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REGISTRY = join(HERE, 'screens.json')

/**
 * The rows of a `screens.json`.
 * @param {string} file
 * @returns {Promise<Array<Readonly<Record<string, unknown>>>>}
 */
async function loadRegistry(file) {
  return JSON.parse(await readFile(file, 'utf-8')).screens
}

/** @param {unknown} error */
const missing = (error) => /** @type {{ code?: string }} */ (error)?.code === 'ENOENT'

/**
 * Every file name in the folder; none when the folder is missing.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
export async function readCommitted(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isFile()).map((e) => e.name)
  } catch (error) {
    if (missing(error)) return []
    throw error
  }
}

/**
 * @param {string} file
 * @param {(buf: Buffer) => Promise<import('./screenImages.mjs').Rgba>} decode
 * @returns {Promise<import('./screenImages.mjs').Rgba | null>} null when the file is missing or not an image
 */
async function decodeFile(file, decode) {
  try {
    return await decode(await readFile(file))
  } catch {
    return null
  }
}

/**
 * Whether each row's built PNG differs, in decoded pixels, from its committed image. A committed
 * image that is missing or cannot be decoded is `different`; a built PNG that cannot be decoded
 * is `unreadable-new`. A row with no built PNG in the index has no verdict.
 * @param {object} input
 * @param {ReadonlyArray<import('./screenImages.mjs').IndexEntry>} input.index
 * @param {string} input.builtDir
 * @param {string} input.committedDir
 * @param {(buf: Buffer) => Promise<import('./screenImages.mjs').Rgba>} [input.decode]
 * @returns {Promise<Map<string, import('./screenImages.mjs').Changed>>}
 */
export async function classify({ index, builtDir, committedDir, decode = decodeRgba }) {
  /** @type {Map<string, import('./screenImages.mjs').Changed>} */
  const verdicts = new Map()
  for (const entry of index) {
    if (entry.built === null || verdicts.has(entry.screen)) continue
    const built = await decodeFile(join(builtDir, `${entry.screen}.built.png`), decode)
    if (built === null) {
      verdicts.set(entry.screen, 'unreadable-new')
      continue
    }
    const committed = await decodeFile(join(committedDir, imageFile(entry.screen)), decode)
    verdicts.set(entry.screen, committed !== null && samePixels(built, committed) ? 'same' : 'different')
  }
  return verdicts
}

/** The filesystem calls `applyPlan` makes, so a test can interrupt it. */
export const realFs = { mkdir, readFile, writeFile, rename, unlink }

/**
 * Applies a plan to the target folder: each write goes to `.<name>.webp.tmp` and is renamed into
 * place, removals come last. A plan that writes nothing does not create the folder.
 * @param {object} input
 * @param {import('./screenImages.mjs').Plan} input.plan
 * @param {string} input.outDir where the encoded webp files are
 * @param {string} input.targetDir
 * @param {typeof realFs} [input.fs]
 */
export async function applyPlan({ plan, outDir, targetDir, fs = realFs }) {
  if (plan.write.length > 0) await fs.mkdir(targetDir, { recursive: true })
  for (const { file } of plan.write) {
    const temp = join(targetDir, `.${file}.tmp`)
    await fs.writeFile(temp, await fs.readFile(join(outDir, file)))
    await fs.rename(temp, join(targetDir, file))
  }
  // A leftover `.tmp` of the row just written was renamed away by that write: already gone.
  for (const name of plan.remove) {
    try {
      await fs.unlink(join(targetDir, name))
    } catch (error) {
      if (!missing(error)) throw error
    }
  }
}

/**
 * The plan of a run that did not start: nothing changes, and `plan.json` and `summary.md` say why.
 * @param {object} input
 * @param {string} input.outDir
 * @param {keyof typeof NOT_STARTED} input.reason
 * @param {ReadonlyArray<Readonly<Record<string, unknown>>>} [input.registry]
 */
export async function writeNotStarted({ outDir, reason, registry }) {
  const rows = registry ?? (await loadRegistry(REGISTRY))
  const plan = planPublish({ registry: rows, committed: [], index: null, changed: new Map(), appStarted: false, reason })
  await mkdir(outDir, { recursive: true })
  await writeFile(join(outDir, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`)
  await writeFile(join(outDir, 'summary.md'), renderSummary({ plan, sizes: {}, baseSha: null, mode: 'local' }))
  return plan
}

/**
 * @param {{ plan: Pick<import('./screenImages.mjs').Plan, 'appStarted' | 'failures'> }} input
 * @returns {0 | 1}
 */
export function exitCode({ plan }) {
  return !plan.appStarted || plan.failures.length > 0 ? 1 : 0
}

/**
 * @param {string} file
 * @returns {Promise<any>} the parsed JSON, or null when the file is missing or not JSON
 */
async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * Two captures of the same rows: those whose decoded pixels differ get the unstable note and no
 * longer count as captured by `planPublish`. Returns the new index and the names that differ.
 * @param {string} dirA
 * @param {string} dirB
 */
async function compareCaptures(dirA, dirB) {
  const a = await readJson(join(dirA, 'index.json'))
  if (!Array.isArray(a)) return { index: null, unstable: [], captured: 0 }
  /** @type {string[]} */
  const unstable = []
  let captured = 0
  const index = []
  for (const entry of a) {
    if (entry.built === null) {
      index.push(entry)
      continue
    }
    captured += 1
    const first = await decodeFile(join(dirA, `${entry.screen}.built.png`), decodeRgba)
    const second = await decodeFile(join(dirB, `${entry.screen}.built.png`), decodeRgba)
    const stable = first !== null && second !== null && samePixels(first, second)
    if (stable) index.push(entry)
    else {
      unstable.push(entry.screen)
      index.push({ ...entry, notes: [...(entry.notes ?? []), UNSTABLE_NOTE] })
    }
  }
  return { index, unstable, captured }
}

/**
 * @param {string} outDir
 * @param {string} targetDir
 * @param {import('./screenImages.mjs').Plan} plan
 * @returns {Promise<Record<string, number>>} the size of each image the folder holds after the plan
 */
async function sizesAfter(outDir, targetDir, plan) {
  /** @type {Record<string, number>} */
  const sizes = {}
  const removed = new Set(plan.remove)
  for (const name of await readCommitted(targetDir)) {
    if (name.endsWith('.webp') && !name.startsWith('.') && !removed.has(name)) {
      sizes[name] = (await stat(join(targetDir, name))).size
    }
  }
  for (const { file } of plan.write) sizes[file] = (await stat(join(outDir, file))).size
  return sizes
}

/**
 * @param {ReadonlyArray<string>} argv
 * @returns {Promise<number>} the exit code
 */
export async function main(argv) {
  const [command, ...rest] = argv
  const { values } = parseArgs({
    args: rest,
    options: {
      index: { type: 'string' },
      'built-dir': { type: 'string' },
      committed: { type: 'string' },
      out: { type: 'string' },
      target: { type: 'string' },
      a: { type: 'string' },
      b: { type: 'string' },
      reason: { type: 'string' },
      'base-sha': { type: 'string' },
      mode: { type: 'string', default: 'local' },
      registry: { type: 'string', default: REGISTRY },
    },
  })
  const out = values.out
  if (out === undefined) return usage('--out is required')
  if (command === 'plan') {
    const { index: indexFile, 'built-dir': builtDir, committed } = values
    if (indexFile === undefined || builtDir === undefined || committed === undefined) {
      return usage('plan needs --index, --built-dir and --committed')
    }
    const registry = await loadRegistry(values.registry)
    const index = await readJson(indexFile)
    const known = Array.isArray(index) ? index : null
    const changed = known === null ? new Map() : await classify({ index: known, builtDir, committedDir: committed })
    const plan = planPublish({ registry, committed: await readCommitted(committed), index: known, changed, appStarted: true })
    await mkdir(out, { recursive: true })
    for (const { file } of plan.write) {
      const png = await readFile(join(builtDir, `${file.replace(/\.webp$/, '')}.built.png`))
      await writeFile(join(out, file), await encodeWebp(png))
    }
    const mode = values.mode === 'pr' || values.mode === 'master' ? values.mode : 'local'
    const sizes = await sizesAfter(out, committed, plan)
    await writeFile(join(out, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`)
    await writeFile(join(out, 'summary.md'), renderSummary({ plan, sizes, baseSha: values['base-sha'] ?? null, mode }))
    return 0
  }
  if (command === 'compare') {
    if (values.a === undefined || values.b === undefined) return usage('compare needs --a and --b')
    const { index, unstable, captured } = await compareCaptures(values.a, values.b)
    if (index === null) {
      console.log('no index in the first capture')
      return 1
    }
    await mkdir(dirname(resolve(out)), { recursive: true })
    await writeFile(out, JSON.stringify(index, null, 2))
    console.log(`rows differing between two captures: ${unstable.length} of ${captured}`)
    for (const name of unstable) console.log(`  ${name}`)
    return 0
  }
  if (command === 'apply') {
    if (values.target === undefined) return usage('apply needs --target')
    const plan = JSON.parse(await readFile(join(out, 'plan.json'), 'utf-8'))
    await applyPlan({ plan, outDir: out, targetDir: values.target })
    return 0
  }
  if (command === 'not-started') {
    const reason = values.reason
    if (reason === undefined || !(reason in NOT_STARTED)) return usage('not-started needs --reason docker-unavailable|image-unavailable|app-not-started')
    const registry = await loadRegistry(values.registry)
    await writeNotStarted({ outDir: out, reason: /** @type {keyof typeof NOT_STARTED} */ (reason), registry })
    return 0
  }
  if (command === 'exit-code') return exitCode({ plan: JSON.parse(await readFile(join(out, 'plan.json'), 'utf-8')) })
  return usage(`unknown command ${JSON.stringify(command)}`)
}

/** @param {string} message */
function usage(message) {
  console.error(`screenImagesRun: ${message}`)
  return 2
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2))
}
