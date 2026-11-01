import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { FontFamily, FontFamilyName } from '../../../scripts/design/fonts.mjs'
import { FONT_FAMILIES, fontCss, fontRoute } from '../../../scripts/design/fonts.mjs'

const GSTATIC_PREFIX = FONT_FAMILIES['Plus Jakarta Sans'].prefix
const GEIST_PREFIX = FONT_FAMILIES['Geist'].prefix
const JAKARTA = 'Plus Jakarta Sans'

const CSS2 =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'
const GEIST_CSS2 = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap'

// The shape of @fontsource/geist/<w>.css: several unicode-range blocks, each with
// `font-display: swap` and relative `./files/` URLs, woff2 first and woff after. The family
// is Geist: the drawings ask for Plus Jakarta Sans and must get Geist under that name.
const fontsourceCss = (weight: number): string =>
  ['latin-ext', 'latin']
    .map(
      (subset) => `/* geist-${subset}-${weight}-normal */
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-display: swap;
  font-weight: ${weight};
  src: url(./files/geist-${subset}-${weight}-normal.woff2) format('woff2'), url(./files/geist-${subset}-${weight}-normal.woff) format('woff');
  unicode-range: U+0100-02BA,U+02BD-02C5;
}
`,
    )
    .join('\n')

describe('fontRoute', () => {
  it('reads the weights of the css2 URL every design file uses', () => {
    expect(fontRoute(CSS2)).toEqual({
      kind: 'stylesheet',
      family: JAKARTA,
      weights: [400, 500, 600, 700],
    })
  })

  it('reads the family and weights of the Geist URL the redesign drawings use', () => {
    expect(fontRoute(GEIST_CSS2)).toEqual({
      kind: 'stylesheet',
      family: 'Geist',
      weights: [400, 500, 600, 700],
    })
  })

  it('serves a Geist file under the Geist prefix, with its family', () => {
    expect(fontRoute(`${GEIST_PREFIX}geist-latin-400-normal.woff2`)).toEqual({
      kind: 'file',
      family: 'Geist',
      name: 'geist-latin-400-normal.woff2',
    })
  })

  it('refuses a Plus Jakarta Sans file under either prefix, since that package is gone', () => {
    expect(fontRoute(`${GEIST_PREFIX}plus-jakarta-sans-latin-400-normal.woff2`)).toEqual({
      kind: 'unserved',
    })
    expect(fontRoute(`${GSTATIC_PREFIX}plus-jakarta-sans-latin-400-normal.woff2`)).toEqual({
      kind: 'unserved',
    })
  })

  it('serves nothing for a request of two families, even when both are known', () => {
    const two =
      'https://fonts.googleapis.com/css2?family=Geist:wght@400&family=Plus+Jakarta+Sans:wght@400&display=swap'
    expect(fontRoute(two)).toEqual({ kind: 'unserved' })
  })

  it('merges a family asked twice into one stylesheet request, weights sorted and unique', () => {
    const twice =
      'https://fonts.googleapis.com/css2?family=Geist:wght@500;600;700&family=Geist:wght@400;500;600&display=swap'
    expect(fontRoute(twice)).toEqual({
      kind: 'stylesheet',
      family: 'Geist',
      weights: [400, 500, 600, 700],
    })
  })

  it('still serves nothing when a repeated family is joined by an unknown one', () => {
    const mixed =
      'https://fonts.googleapis.com/css2?family=Geist:wght@400&family=Roboto:wght@400&display=swap'
    expect(fontRoute(mixed)).toEqual({ kind: 'unserved' })
  })

  it('leaves Roboto unserved as a stylesheet and as a file', () => {
    expect(fontRoute('https://fonts.googleapis.com/css2?family=Roboto:wght@400')).toEqual({
      kind: 'unserved',
    })
    expect(fontRoute('https://fonts.gstatic.com/s/roboto/v30/roboto-latin-400-normal.woff2')).toEqual({
      kind: 'unserved',
    })
  })

  it('serves a gstatic file by its name', () => {
    expect(fontRoute(`${GSTATIC_PREFIX}geist-latin-400-normal.woff2`)).toEqual({
      kind: 'file',
      family: JAKARTA,
      name: 'geist-latin-400-normal.woff2',
    })
    expect(fontRoute(`${GSTATIC_PREFIX}geist-latin-400-normal.woff`)).toEqual({
      kind: 'file',
      family: JAKARTA,
      name: 'geist-latin-400-normal.woff',
    })
  })

  it.each([
    ['another host', 'https://example.com/css2?family=Plus+Jakarta+Sans:wght@400'],
    ['another family', 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700'],
    ['a family with the wrong case', 'https://fonts.googleapis.com/css2?family=geist:wght@400'],
    ['a file URL', 'file:///repo/docs/product/design-system/tokens.css'],
    ['a name with a slash', `${GSTATIC_PREFIX}sub/geist-latin-400-normal.woff2`],
    ['a name with ..', `${GSTATIC_PREFIX}..%2Fpackage.json.woff2`],
    ['a name that climbs', `${GSTATIC_PREFIX}../files/x.woff2`],
    ['another extension', `${GSTATIC_PREFIX}geist-latin-400-normal.ttf`],
    ['a gstatic host with another prefix', 'https://fonts.gstatic.com/other/x.woff2'],
    ['no URL at all', 'not a url'],
  ])('leaves %s unserved', (_label, url) => {
    expect(fontRoute(url)).toEqual({ kind: 'unserved' })
  })
})

describe('fontCss', () => {
  const read = (weight: number): string => fontsourceCss(weight)

  it('has no swap and says block', () => {
    const css = fontCss(JAKARTA, [400, 500, 600, 700], read)
    expect(css).not.toContain('swap')
    expect(css).toContain('font-display: block')
  })

  it('points every src URL at the fixed gstatic prefix', () => {
    const css = fontCss(JAKARTA, [400, 700], read)
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1] ?? '')
    expect(urls).toHaveLength(8)
    for (const url of urls) {
      expect(url.startsWith(GSTATIC_PREFIX)).toBe(true)
    }
    expect(css).not.toContain('./files/')
  })

  it('declares every face under the drawings family, filled with the Geist files', () => {
    const css = fontCss(JAKARTA, [400, 600], read)
    expect(css.match(/font-family: 'Plus Jakarta Sans';/g)).toHaveLength(4)
    expect(css).not.toContain("'Geist'")
    expect(css).toContain(`url(${GSTATIC_PREFIX}geist-latin-400-normal.woff2)`)
    expect(css).not.toContain('plus-jakarta-sans-')
  })

  it('keeps one block per unicode-range of every weight asked', () => {
    const css = fontCss(JAKARTA, [400, 500], read)
    expect(css.match(/@font-face/g)).toHaveLength(4)
    expect(css).toContain('font-weight: 500')
  })

  it('refuses a stylesheet that would fetch a font from outside the local files', () => {
    const remote = (): string =>
      "@font-face { font-family: 'X'; font-display: swap; src: url(https://example.com/x.woff2); }"
    expect(() => fontCss(JAKARTA, [400], remote)).toThrow(/outside the local files/)
  })

  it('throws for a weight with no local CSS, without falling back to the network', () => {
    const offline = (weight: number): string => {
      throw new Error(`ENOENT ${weight}.css`)
    }
    expect(() => fontCss(JAKARTA, [400], offline)).toThrow(/ENOENT/)
  })
})

describe('fontCss with Geist', () => {
  const geistCss = (weight: number): string => `/* geist-latin-${weight}-normal */
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-display: swap;
  font-weight: ${weight};
  src: url(./files/geist-latin-${weight}-normal.woff2) format('woff2'), url(./files/geist-latin-${weight}-normal.woff) format('woff');
  unicode-range: U+0000-00FF;
}
`

  it('points every URL at the Geist prefix, with block', () => {
    const css = fontCss('Geist', [400, 700], geistCss)
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1] ?? '')
    expect(urls).toHaveLength(4)
    for (const url of urls) expect(url.startsWith(GEIST_PREFIX)).toBe(true)
    expect(css).toContain('font-display: block')
    expect(css).not.toContain('swap')
  })

  it('refuses a URL of the other family\'s prefix inside a Geist stylesheet', () => {
    const foreign = (): string =>
      `@font-face { font-family: 'Geist'; src: url(${GSTATIC_PREFIX}plus-jakarta-sans-latin-400-normal.woff2); }`
    expect(() => fontCss('Geist', [400], foreign)).toThrow(/outside the local files/)
  })

  it('refuses a family that is not on the map', () => {
    expect(() => fontCss('Roboto' as string as FontFamilyName, [400], geistCss)).toThrow(/Roboto/)
  })
})

const WEB = resolve(__dirname, '..', '..')

describe.each(Object.entries(FONT_FAMILIES) as [FontFamilyName, FontFamily][])('the installed package of %s', (family, entry) => {
  const root = join(WEB, 'node_modules', entry.package)
  const read = (weight: number): string => readFileSync(join(root, `${weight}.css`), 'utf-8')
  const faces = (weight: number): string[] =>
    read(weight).split('@font-face').slice(1)

  it.each([400, 500, 600, 700])('has a static %i.css served only from ./files/', (weight) => {
    const css = read(weight)
    const blocks = faces(weight)
    expect(blocks.length).toBeGreaterThan(0)
    for (const block of blocks) {
      expect(block).toMatch(new RegExp(`font-weight:\\s*${weight};`))
      expect(block).toContain(`font-family: '${entry.face}'`)
    }
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1] ?? '')
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect(url.startsWith('./files/')).toBe(true)
      expect(existsSync(join(root, 'files', url.slice('./files/'.length)))).toBe(true)
    }
  })

  it.each([400, 500, 600, 700])('has a normal face of %i covering U+0041', (weight) => {
    const covers = faces(weight).some((block) => {
      if (!/font-style:\s*normal/.test(block)) return false
      const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1] ?? ''
      return range.split(',').some((part) => {
        const [from = '', to = from] = part.trim().replace(/^U\+/, '').split('-')
        return parseInt(from, 16) <= 0x41 && 0x41 <= parseInt(to, 16)
      })
    })
    expect(covers).toBe(true)
  })

  it('answers every rewritten URL as a file of the same family', () => {
    const css = fontCss(family, [400, 500, 600, 700], read)
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1] ?? '')
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect(fontRoute(url)).toMatchObject({ kind: 'file', family })
    }
  })
})
