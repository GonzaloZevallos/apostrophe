/**
 * The one flag "Agregar otra variedad" leaves in the history state of step 1's entry:
 * `anotherVariety: true` and nothing else (no name, amount or id). It tells step 1 to open
 * its empty form instead of the "Hecho" view of the variety already saved. The variety
 * write replaces the entry with no state, so a reload after it shows the price form.
 */

export interface AnotherVarietyState {
  anotherVariety: true
}

export function anotherVarietyState(): AnotherVarietyState {
  return { anotherVariety: true }
}

export function hasAnotherVariety(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'anotherVariety' in state && state.anotherVariety === true
}
