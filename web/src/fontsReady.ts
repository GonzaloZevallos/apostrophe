/**
 * The faces the first screen is drawn in, awaited before the first render with a cap: the
 * `@fontsource/geist` faces are `font-display: swap`, so a page rendered before they arrive is
 * laid out in the fallback face (wider: Entrar's tagline wraps and its form ends below a
 * 320x568 screen) and then jumps. A slow or failed face ends in the fallback after `capMs`
 * and never blocks the page, like `startLanguage`.
 */

export const FIRST_SCREEN_FACES = ['400 16px Geist', '500 16px Geist', '600 16px Geist', '700 16px Geist']

export const FONT_WAIT_CAP_MS = 1500

export interface FaceLoader {
  load(font: string): Promise<unknown>
}

export async function fontsReady(
  fonts: FaceLoader | undefined,
  faces: readonly string[] = FIRST_SCREEN_FACES,
  capMs: number = FONT_WAIT_CAP_MS,
): Promise<void> {
  if (fonts === undefined) return
  let timer: ReturnType<typeof setTimeout> | undefined
  const cap = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, capMs)
  })
  const loaded = Promise.all(faces.map((face) => fonts.load(face))).then(
    () => undefined,
    () => undefined,
  )
  await Promise.race([loaded, cap])
  clearTimeout(timer)
}
