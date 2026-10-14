/**
 * `expectIconAndTextRule`: the icon and text rule (`docs/product/icon-and-text-rule.md`)
 * read off rendered DOM, for a screen's test to call over its container. A test helper:
 * no module outside tests imports from `src/test/` (`testImports.real.test.ts`).
 *
 * It fails, naming the offender, when in `container`:
 * 1. a button or link has no accessible name;
 * 2. an svg inside a control with visible text is not `aria-hidden` (the icon next to a
 *    word is decorative, so the name stays the word);
 * 3. a control with no visible text is not the icon-only control (`.boton-icono`);
 * 4. a control with visible text and no svg is none of: the submit (`type="submit"`),
 *    link/undo/back (`.boton--enlace`), a row (`.boton--fila`), an option control (a
 *    tab, radio, switch or checkbox role, or a class in `options.optionClasses`), or an
 *    answer inside a `dialog` or `alertdialog`;
 *    A tappable notice (`.boton-aviso`) is also known, but must be named by its visible
 *    text, with no `aria-label` of its own;
 * 5. two entries inside one `[data-menu]` share an icon (a drawing, compared by its
 *    markup);
 * 6. an element marked `data-copy="<kind>"` is longer than `options.limits[<kind>]`, its
 *    text measured with `options.samples` (a placeholder name to its worst-case text,
 *    `{name}` in the text) substituted first. Limits are 2b's `LIMITS`
 *    (`web/src/copy/limits.ts`); whichever of `control-seam` and `info-notice-copy`
 *    merges second passes them here from its screens' tests.
 */

import { expect } from 'vitest'

export interface RuleOptions {
  /** Class names of option controls a screen may keep as a raw text button. */
  optionClasses?: readonly string[]
  /** `data-copy` kind to its limit in characters. */
  limits?: Readonly<Record<string, number>>
  /** Placeholder (`{name}` in the text) to its worst-case sample. */
  samples?: Readonly<Record<string, string>>
}

const OPTION_ROLES = ['tab', 'radio', 'switch', 'checkbox', 'menuitemradio']

function visibleText(control: Element): string {
  return (control.textContent ?? '').trim()
}

function describe(control: Element): string {
  const name = control.getAttribute('aria-label') ?? visibleText(control)
  return `<${control.tagName.toLowerCase()} class="${control.className}"> "${name}"`
}

function accessibleName(control: Element): string {
  return (control.getAttribute('aria-label') ?? visibleText(control)).trim()
}

function isAnswer(control: Element): boolean {
  return control.closest('[role="dialog"], [role="alertdialog"]') !== null
}

function problemsOf(control: Element, options: RuleOptions): string[] {
  const problems: string[] = []
  const hasText = visibleText(control) !== ''
  const svgs = Array.from(control.querySelectorAll('svg'))
  if (accessibleName(control) === '') problems.push(`${describe(control)} has no accessible name`)
  if (control.classList.contains('boton-aviso') && accessibleName(control) !== visibleText(control)) {
    problems.push(`${describe(control)} notice must be named by its visible text`)
  }
  if (hasText) {
    for (const svg of svgs) {
      if (svg.getAttribute('aria-hidden') !== 'true') {
        problems.push(`${describe(control)} has an icon that is not aria-hidden`)
      }
    }
    const role = control.getAttribute('role') ?? ''
    const known =
      control.getAttribute('type') === 'submit' ||
      control.classList.contains('boton--enlace') ||
      control.classList.contains('boton--fila') ||
      control.classList.contains('boton-aviso') ||
      OPTION_ROLES.includes(role) ||
      (options.optionClasses ?? []).some((name) => control.classList.contains(name)) ||
      isAnswer(control)
    if (svgs.length === 0 && !known) {
      problems.push(`${describe(control)} is text only but is not a submit, link, undo, back or answer`)
    }
  } else if (!control.classList.contains('boton-icono')) {
    problems.push(`${describe(control)} has no visible text but is not an icon-only control`)
  }
  return problems
}

function menuProblems(container: HTMLElement): string[] {
  const problems: string[] = []
  for (const menu of Array.from(container.querySelectorAll('[data-menu]'))) {
    const seen = new Map<string, string>()
    for (const entry of Array.from(menu.querySelectorAll('a, button'))) {
      const drawing = entry.querySelector('svg')?.innerHTML
      if (drawing === undefined) continue
      const other = seen.get(drawing)
      if (other !== undefined) {
        problems.push(`${describe(entry)} shares its icon with "${other}" in one menu`)
      }
      seen.set(drawing, accessibleName(entry))
    }
  }
  return problems
}

function copyProblems(container: HTMLElement, options: RuleOptions): string[] {
  const limits = options.limits ?? {}
  const problems: string[] = []
  for (const element of Array.from(container.querySelectorAll('[data-copy]'))) {
    const kind = element.getAttribute('data-copy') ?? ''
    const limit = limits[kind]
    if (limit === undefined) continue
    let text = visibleText(element)
    for (const [placeholder, sample] of Object.entries(options.samples ?? {})) {
      text = text.split(`{${placeholder}}`).join(sample)
    }
    if (text.length > limit) {
      problems.push(`"${text}" is ${text.length} characters, over the ${limit} of "${kind}"`)
    }
  }
  return problems
}

/** Every problem the rule finds in `container`, in reading order; empty when it holds. */
export function iconAndTextProblems(container: HTMLElement, options: RuleOptions = {}): string[] {
  const controls = Array.from(container.querySelectorAll('button, a'))
  return [
    ...controls.flatMap((control) => problemsOf(control, options)),
    ...menuProblems(container),
    ...copyProblems(container, options),
  ]
}

export function expectIconAndTextRule(container: HTMLElement, options: RuleOptions = {}): void {
  expect(iconAndTextProblems(container, options)).toEqual([])
}
