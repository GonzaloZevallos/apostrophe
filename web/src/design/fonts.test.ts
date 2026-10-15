import { describe, expect, it } from 'vitest'
import { fontCss, fontRoute, GSTATIC_PREFIX } from '../../../scripts/design/fonts.mjs'

const CSS2 =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'

// The shape of @fontsource/plus-jakarta-sans/<w>.css: several unicode-range blocks, each
// with `font-display: swap` and relative `./files/` URLs, woff2 first and woff after.
const fontsourceCss = (weight: number): string =>
  ['latin-ext', 'latin']
    .map(
      (subset) => `/* plus-jakarta-sans-${subset}-${weight}-normal */
@font-face {
  font-family: 'Plus Jakarta Sans';
  font-style: normal;
  font-display: swap;
  font-weight: ${weight};
  src: url(./files/plus-jakarta-sans-${subset}-${weight}-normal.woff2) format('woff2'), url(./files/plus-jakarta-sans-${subset}-${weight}-normal.woff) format('woff');
  unicode-range: U+0100-02BA,U+02BD-02C5;
}
`,
    )
    .join('\n')

describe('fontRoute', () => {
  it('reads the weights of the css2 URL every design file uses', () => {
    expect(fontRoute(CSS2)).toEqual({ kind: 'stylesheet', weights: [400, 500, 600, 700] })
  })

  it('serves a gstatic file by its name', () => {
    expect(fontRoute(`${GSTATIC_PREFIX}plus-jakarta-sans-latin-400-normal.woff2`)).toEqual({
      kind: 'file',
      name: 'plus-jakarta-sans-latin-400-normal.woff2',
    })
    expect(fontRoute(`${GSTATIC_PREFIX}plus-jakarta-sans-latin-400-normal.woff`)).toEqual({
      kind: 'file',
      name: 'plus-jakarta-sans-latin-400-normal.woff',
    })
  })

  it.each([
    ['another host', 'https://example.com/css2?family=Plus+Jakarta+Sans:wght@400'],
    ['another family', 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700'],
    ['a file URL', 'file:///repo/docs/product/design-system/tokens.css'],
    ['a name with a slash', `${GSTATIC_PREFIX}sub/plus-jakarta-sans-latin-400-normal.woff2`],
    ['a name with ..', `${GSTATIC_PREFIX}..%2Fpackage.json.woff2`],
    ['a name that climbs', `${GSTATIC_PREFIX}../files/x.woff2`],
    ['another extension', `${GSTATIC_PREFIX}plus-jakarta-sans-latin-400-normal.ttf`],
    ['a gstatic host with another prefix', 'https://fonts.gstatic.com/other/x.woff2'],
    ['no URL at all', 'not a url'],
  ])('leaves %s unserved', (_label, url) => {
    expect(fontRoute(url)).toEqual({ kind: 'unserved' })
  })
})

describe('fontCss', () => {
  const read = (weight: number): string => fontsourceCss(weight)

  it('has no swap and says block', () => {
    const css = fontCss([400, 500, 600, 700], read)
    expect(css).not.toContain('swap')
    expect(css).toContain('font-display: block')
  })

  it('points every src URL at the fixed gstatic prefix', () => {
    const css = fontCss([400, 700], read)
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1] ?? '')
    expect(urls).toHaveLength(8)
    for (const url of urls) {
      expect(url.startsWith(GSTATIC_PREFIX)).toBe(true)
    }
    expect(css).not.toContain('./files/')
  })

  it('keeps one block per unicode-range of every weight asked', () => {
    const css = fontCss([400, 500], read)
    expect(css.match(/@font-face/g)).toHaveLength(4)
    expect(css).toContain('font-weight: 500')
  })

  it('refuses a stylesheet that would fetch a font from outside the local files', () => {
    const remote = (): string =>
      "@font-face { font-family: 'X'; font-display: swap; src: url(https://example.com/x.woff2); }"
    expect(() => fontCss([400], remote)).toThrow(/outside the local files/)
  })

  it('throws for a weight with no local CSS, without falling back to the network', () => {
    const offline = (weight: number): string => {
      throw new Error(`ENOENT ${weight}.css`)
    }
    expect(() => fontCss([400], offline)).toThrow(/ENOENT/)
  })
})
