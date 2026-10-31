// Fonts of a design capture (ADR-0042). The design files load their family from Google
// Fonts with `display=swap`; a capture must not depend on the network, so the request is
// answered from the app's own self-hosted packages (@fontsource/*), with
// `font-display: block`. Pure: no file is read here, `comparisons.mjs` injects the reader.

// The closed map of families a capture serves. It is the only place in scripts/design/ that
// names a font package or a gstatic prefix: a file is served only under the prefix of its own
// family, and a family that is not a key is never served.
export const FONT_FAMILIES = Object.freeze({
  'Plus Jakarta Sans': Object.freeze({
    package: '@fontsource/plus-jakarta-sans',
    prefix: 'https://fonts.gstatic.com/s/plusjakartasans/v1/',
  }),
  Geist: Object.freeze({
    package: '@fontsource/geist',
    prefix: 'https://fonts.gstatic.com/s/geist/v1/',
  }),
})

const FAMILY = /^([^:]+):wght@(\d+(?:;\d+)*)$/
const FILE_NAME = /^[a-z0-9-]+\.woff2?$/

const isFamily = (name) => Object.hasOwn(FONT_FAMILIES, name)
// fontsource names its files `<package-name>-<subset>-<weight>-<style>`.
const fileStem = (family) => FONT_FAMILIES[family].package.split('/').pop()

// What to do with a request URL: a stylesheet for the family and weights it asks, a font file
// by its family and name, or nothing (the capture aborts it).
export function fontRoute(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return { kind: 'unserved' }
  }
  if (parsed.protocol !== 'https:') return { kind: 'unserved' }
  if (parsed.hostname === 'fonts.googleapis.com' && parsed.pathname === '/css2') {
    const families = parsed.searchParams.getAll('family')
    // One family, asked once or repeated (Marca.dc.html asks Geist twice, for two weight sets): the
    // weights are merged. Two different families stay unserved.
    const matches = families.map((family) => FAMILY.exec(family))
    const [first] = matches
    if (first && isFamily(first[1]) && matches.every((match) => match && match[1] === first[1])) {
      const weights = [...new Set(matches.flatMap((match) => (match ? match[2] : '').split(';').map(Number)))]
      return { kind: 'stylesheet', family: first[1], weights: weights.sort((a, b) => a - b) }
    }
    return { kind: 'unserved' }
  }
  for (const family of Object.keys(FONT_FAMILIES)) {
    const prefix = new URL(FONT_FAMILIES[family].prefix)
    if (parsed.hostname !== prefix.hostname || !parsed.pathname.startsWith(prefix.pathname)) continue
    const name = parsed.pathname.slice(prefix.pathname.length)
    if (FILE_NAME.test(name) && name.startsWith(`${fileStem(family)}-`)) {
      return { kind: 'file', family, name }
    }
  }
  return { kind: 'unserved' }
}

// The stylesheet of `family` for `weights`, from `read(weight)` (the text of fontsource's
// `<weight>.css`). `read` throws when the weight has no local CSS: there is no fallback to
// the network. Every URL must end up under the prefix of this family.
export function fontCss(family, weights, read) {
  if (!isFamily(family)) throw new Error(`the family ${family} is not served`)
  const { prefix } = FONT_FAMILIES[family]
  return weights
    .map((weight) => {
      const css = read(weight)
        .replace(/font-display:\s*swap/g, 'font-display: block')
        .replace(/url\(\.\/files\/([^)]+)\)/g, `url(${prefix}$1)`)
      for (const [, target] of css.matchAll(/url\(([^)]+)\)/g)) {
        if (!target.startsWith(prefix)) {
          throw new Error(`the stylesheet of weight ${weight} has a URL outside the local files`)
        }
      }
      return css
    })
    .join('\n')
}
