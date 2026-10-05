// The app picks its theme from `data-tema` alone, never from the system (plan,
// subtask `light-by-default`): a stray `color_scheme` entry would silently emulate
// a dark system again, and a `tema` other than `'oscuro'` names a value the app
// does not recognise.
/**
 * @param {ReadonlyArray<Readonly<Record<string, unknown>>>} screens
 * @returns {void}
 */
export function assertScreens(screens) {
  for (const s of screens) {
    if ('color_scheme' in s) throw new Error(`${s.screen}: color_scheme is retired, use tema: 'oscuro'`)
    if ('tema' in s && s.tema !== 'oscuro') throw new Error(`${s.screen}: unknown tema ${JSON.stringify(s.tema)}`)
  }
}
