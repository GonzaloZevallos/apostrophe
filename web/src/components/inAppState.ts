/**
 * The one producer of the history state that says "the app is behind this entry": `inApp`
 * (`useBackOr` and `useGoneExit` read it) and `from`, the pathname the entry was opened from
 * (`useGoneExit` compares it with the screen's parent). Every in-app link goes through it,
 * `InAppLink` included; `findInAppLiterals` is the scan that keeps it so. A pathname is the
 * most it carries: no name, amount or business (history state holds none).
 */

export interface InAppState {
  inApp: true
  from: string
}

export function inAppState(location: { pathname: string }, extra: object = {}): InAppState {
  return { ...extra, inApp: true, from: location.pathname }
}

const LITERAL = /\binApp\s*:\s*true\b/

/** The paths of the sources that write the marker by hand: all but this module and its test. */
export function findInAppLiterals(files: readonly { path: string; content: string }[]): string[] {
  return files
    .filter(({ path }) => !/(^|\/)inAppState(\.test)?\.ts$/.test(path))
    .filter(({ content }) => LITERAL.test(content))
    .map(({ path }) => path)
}
