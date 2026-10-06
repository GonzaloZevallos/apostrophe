/**
 * The installed shell's document, read raw (plan, subtask `shell-document`, seam 2):
 * `index.html`, the manifest and `tokens.css` through `import.meta.glob ?raw`, the
 * same seam as `hexColors.real.test.ts`. The colors are compared with the light
 * `--papel` parsed out of `tokens.css`, never a copied literal.
 */

import { expect, test } from 'vitest'

const raw = import.meta.glob(
  ['/index.html', '/public/manifest.webmanifest', '/src/styles/tokens.css'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

/** Only the keys matter: which icon files exist under /public. Nothing is loaded. */
const iconFiles = Object.keys(import.meta.glob('/public/icons/*'))

const indexHtml = raw['/index.html'] ?? ''
const manifestText = raw['/public/manifest.webmanifest'] ?? ''
const tokens = raw['/src/styles/tokens.css'] ?? ''

interface Icon {
  src: string
  sizes: string
  type: string
  purpose?: string
}
interface Manifest {
  id?: string
  scope?: string
  lang?: string
  display?: string
  orientation?: string
  theme_color?: string
  background_color?: string
  icons: Icon[]
}

const doc = new DOMParser().parseFromString(indexHtml, 'text/html')
const manifest = JSON.parse(manifestText) as Manifest

/** The light `--papel`: the one declared in the first `:root` block of tokens.css. */
function lightPapel(): string {
  const root = /:root\s*\{([^}]*)\}/.exec(tokens)
  const match = /--papel:\s*([^;]+);/.exec(root?.[1] ?? '')
  if (match?.[1] === undefined) throw new Error('tokens.css has no light --papel')
  return match[1].trim()
}

function metaContent(name: string): string | null {
  return doc.head.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null
}

test('the viewport has its four parts and no zoom restriction', () => {
  const parts = (metaContent('viewport') ?? '').split(',').map((part) => part.trim())
  expect(parts).toEqual([
    'width=device-width',
    'initial-scale=1',
    'viewport-fit=cover',
    'interactive-widget=resizes-content',
  ])
  expect(indexHtml).not.toMatch(/maximum-scale|user-scalable/)
})

test('the app is capable on both platforms and iOS keeps its default status bar', () => {
  expect(metaContent('mobile-web-app-capable')).toBe('yes')
  expect(metaContent('apple-mobile-web-app-capable')).toBe('yes')
  expect(metaContent('apple-mobile-web-app-status-bar-style')).toBe('default')
})

/** What is wrong with a document's `theme-color` metas; empty when it is right. */
function themeColorViolations(page: Document, expected: string): string[] {
  const metas = [...page.head.querySelectorAll('meta[name="theme-color"]')]
  const found: string[] = []
  if (metas.length !== 1) found.push(`${String(metas.length)} theme-color metas, expected one`)
  for (const meta of metas) {
    if (meta.hasAttribute('media')) found.push('a theme-color meta carries media')
  }
  if (metas.length === 1 && metas[0]?.getAttribute('content') !== expected) {
    found.push('the theme-color is not the light --papel')
  }
  return found
}

test('there is exactly one theme-color, with no media, equal to the light --papel', () => {
  expect(themeColorViolations(doc, lightPapel())).toEqual([])
})

test('themeColorViolations rejects a pair of metas, one carrying media', () => {
  const broken = new DOMParser().parseFromString(
    '<meta name="theme-color" content="x" media="(prefers-color-scheme: dark)">' +
      '<meta name="theme-color" content="y">',
    'text/html',
  )
  expect(themeColorViolations(broken, lightPapel())).toEqual([
    '2 theme-color metas, expected one',
    'a theme-color meta carries media',
  ])
})

test('the document never lets the system pick a color or draws an iOS splash', () => {
  expect(indexHtml).not.toMatch(/prefers-color-scheme/)
  expect(indexHtml).not.toMatch(/apple-touch-startup-image/)
})

test('the manifest carries its identity fields and the light papel', () => {
  expect(manifest.id).toBe('/')
  expect(manifest.scope).toBe('/')
  expect(manifest.lang).toBe('es')
  expect(manifest.display).toBe('standalone')
  expect(manifest.theme_color).toBe(lightPapel())
  expect(manifest.background_color).toBe(lightPapel())
  expect('orientation' in manifest).toBe(false)
})

test('the 192 and 512 icons are purpose any, and every icon file exists', () => {
  const bySize = (sizes: string): Icon | undefined => manifest.icons.find((i) => i.sizes === sizes)
  expect(bySize('192x192')?.purpose).toBe('any')
  expect(bySize('512x512')?.purpose).toBe('any')
  for (const icon of manifest.icons) {
    expect(iconFiles).toContain(`/public${icon.src}`)
  }
})

/**
 * A maskable 512 icon must be listed and its file must exist under /public. The `any`
 * entry of the same size does not count: a launcher would crop it to its corners.
 */
export function maskableViolations(icons: Icon[], files: string[]): string[] {
  const maskable = icons.find((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable')
  if (maskable === undefined) return ['the manifest has no 512 maskable icon']
  return files.includes(`/public${maskable.src}`) ? [] : [`${maskable.src} does not exist under /public`]
}

test('the manifest lists a 512 maskable icon whose file exists', () => {
  expect(maskableViolations(manifest.icons, iconFiles)).toEqual([])
})

test('maskableViolations rejects a manifest with no maskable icon, or one with no file', () => {
  const any512: Icon = { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
  expect(maskableViolations([any512], iconFiles)).toEqual(['the manifest has no 512 maskable icon'])
  const missing: Icon = { ...any512, src: '/icons/nope.png', purpose: 'maskable' }
  expect(maskableViolations([any512, missing], iconFiles)).toEqual([
    '/icons/nope.png does not exist under /public',
  ])
})

test('themeColorViolations rejects a single meta with the wrong color', () => {
  const broken = new DOMParser().parseFromString(
    '<meta name="theme-color" content="not-the-papel">',
    'text/html',
  )
  expect(themeColorViolations(broken, lightPapel())).toEqual([
    'the theme-color is not the light --papel',
  ])
})
