/**
 * The ids a typed field's own spans carry, from one `useId`: its label span (the control's
 * `aria-labelledby`, so its name is that word alone and never the help or the error the wrapping
 * `<label>` also holds) and its help and error spans (the control's `aria-describedby`).
 */

/** What a typed control points at; empty for a host that keeps the wrapping label as the name. */
export interface FieldAria {
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

/** The ids of one field's label, help and error spans, from one `useId`. */
export function fieldIds(base: string): { label: string; help: string; error: string } {
  return { label: `${base}-rotulo`, help: `${base}-ayuda`, error: `${base}-error` }
}

/**
 * The aria props of one control: its own label span as the name and its help (and its error
 * while one is shown) as the description, or nothing when `own` is false.
 */
export function ariaOf(own: boolean, ids: { label: string; help: string; error: string }, error: string | undefined): FieldAria {
  if (!own) return {}
  return { 'aria-labelledby': ids.label, 'aria-describedby': error === undefined ? ids.help : `${ids.help} ${ids.error}` }
}
