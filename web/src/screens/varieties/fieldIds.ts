/**
 * The ids a typed field's own spans carry, from one `useId`: its label span (the control's
 * `aria-labelledby`, so its name is that word alone and never the help or the error the wrapping
 * `<label>` also holds) and its help and error spans (the control's `aria-describedby`).
 */

/** What a typed control points at. */
export interface FieldIds {
  labelledBy: string
  describedBy: string
}

/** The ids of one field's label, help and error spans, from one `useId`. */
export function fieldIds(base: string): { label: string; help: string; error: string } {
  return { label: `${base}-rotulo`, help: `${base}-ayuda`, error: `${base}-error` }
}

/** The description of a field: its help, and its error while one is shown. */
export function describedBy(ids: { help: string; error: string }, error: string | undefined): string {
  return error === undefined ? ids.help : `${ids.help} ${ids.error}`
}
