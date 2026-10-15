// Fonts of a design capture (ADR-0041). The design files load Plus Jakarta Sans from Google
// Fonts with `display=swap`; a capture must not depend on the network, so the request is
// answered from the app's own self-hosted package (@fontsource/plus-jakarta-sans), with
// `font-display: block`. Pure: no file is read here, `comparisons.mjs` injects the reader.

// Where the stylesheet says its files live; a request for one is served from `files/`.
export const GSTATIC_PREFIX = 'https://fonts.gstatic.com/s/plusjakartasans/v1/'

const FAMILY = /^Plus Jakarta Sans:wght@(\d+(?:;\d+)*)$/
const FILE_NAME = /^[a-z0-9-]+\.woff2?$/

// What to do with a request URL: a stylesheet for the weights it asks, a font file by its
// name, or nothing (the capture aborts it).
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
    const match = families.length === 1 ? FAMILY.exec(families[0]) : null
    if (match) return { kind: 'stylesheet', weights: match[1].split(';').map(Number) }
    return { kind: 'unserved' }
  }
  const prefix = new URL(GSTATIC_PREFIX)
  if (parsed.hostname === prefix.hostname && parsed.pathname.startsWith(prefix.pathname)) {
    const name = parsed.pathname.slice(prefix.pathname.length)
    if (FILE_NAME.test(name)) return { kind: 'file', name }
  }
  return { kind: 'unserved' }
}

// The stylesheet for `weights`, from `read(weight)` (the text of fontsource's `<weight>.css`).
// `read` throws when the weight has no local CSS: there is no fallback to the network.
export function fontCss(weights, read) {
  return weights
    .map((weight) => {
      const css = read(weight)
        .replace(/font-display:\s*swap/g, 'font-display: block')
        .replace(/url\(\.\/files\/([^)]+)\)/g, `url(${GSTATIC_PREFIX}$1)`)
      for (const [, target] of css.matchAll(/url\(([^)]+)\)/g)) {
        if (!target.startsWith(GSTATIC_PREFIX)) {
          throw new Error(`the stylesheet of weight ${weight} has a URL outside the local files`)
        }
      }
      return css
    })
    .join('\n')
}
