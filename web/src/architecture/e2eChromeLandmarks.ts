/**
 * The e2e chrome-landmark rule (GH-727, D-69509906): the phone's bottom bar and its New sale
 * entry are located in one place, `web/e2e/helpers/chrome.ts`, so a later change to the bar changes
 * locators there and nowhere else. No other file under `web/e2e/` may contain the classes
 * `bar-inferior` (which also covers the + , `bar-inferior__mas`) or `boton-nueva-venta` (which also
 * covers the computer rail's `boton-nueva-venta--escritorio`), comments included: a comment that names a class is a
 * second place that must change with it.
 *
 * There is no allowlist and no per-file exemption but the helper module itself. It is a text scan
 * of the sources it is given: a landmark built by joining strings is invisible to it.
 */

export interface E2eSource {
  /** The file's path relative to `web/e2e/`, with `/` separators. */
  path: string
  text: string
}

/** The one file allowed to name the landmarks. */
export const CHROME_HELPER = 'helpers/chrome.ts'

export const LANDMARKS = ['bar-inferior', 'boton-nueva-venta'] as const

/** The paths, in the order given, of the sources outside the helper module that name a landmark. */
export function findChromeLandmarks(sources: readonly E2eSource[]): string[] {
  return sources
    .filter((source) => source.path !== CHROME_HELPER)
    .filter((source) => LANDMARKS.some((landmark) => source.text.includes(landmark)))
    .map((source) => source.path)
}
