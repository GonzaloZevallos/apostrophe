/**
 * `Boton`: the one button the app draws, and the closed lists of the icon and text rule
 * (`docs/product/icon-and-text-rule.md`, ADR-0037) written as a type. The union below
 * is the rule: what it forbids does not compile (`Boton.types.test.tsx`).
 *
 * - **Icon + text** (`variant` primary, secondary, destructive or critical, with an `icon`): an
 *   action. The icon is decorative (`aria-hidden`), so the accessible name is the word.
 *   `critical` is the destructive action's trigger ("Eliminar variedad"): an outline and text in
 *   `--critico`, never a fill. The filled `--critico` is only the answer of a confirmation
 *   (`AnswerButton`), which `findFilledCritical` keeps true.
 * - **Text only**, and only these kinds: `textOnly="submit"` with `type="submit"` (the
 *   submit of a form or sheet), `link` (enlace), `undo` (Deshacer) and `back`
 *   ("‹ <parent>"). They accept no `icon`. Back is never close.
 * - **Icon only** (`variant="icon"`): an obvious action from the closed `ACTION_ICON`
 *   map (`botonVisual.tsx`: delete, search, close, edit, share), with a required `ariaLabel`
 *   (the exact current word, never a new one) and a 44 px target (`.boton-icono`).
 * - `row`: a full-width, left-aligned, stacked-content button for a tappable list row,
 *   reset only through its own `boton--fila` class.
 *
 * - `notice`: a tappable notice drawn as its designed card (`.boton-aviso`), named by its
 *   own visible text. It accepts no `icon`, no `ariaLabel` and no `textOnly`; a chevron
 *   inside its children is a decorative mark, not an icon of the control.
 *
 * No screen writes its own button base styles: every variant is one of `app.css`'s
 * `.boton*` classes, never an inline style or a one-off class. Variant names are
 * English (CODING_STANDARDS §10); only the rendered word is Spanish.
 * `ariaDescribedBy` is for a row whose own message sits just below it: the row names
 * the message, never the other way around.
 *
 * `BotonLink` draws the same union as an in-app link, from `botonVisual.tsx`.
 */

import type { MouseEvent, ReactNode } from 'react'
import { botonVisual } from './botonVisual'
import type { NombreIcono } from './Icono'

/** The actions that may be drawn with no visible word. Closed: adding one changes
 * the rule document first, never a single screen. */
export type IconOnlyAction = 'delete' | 'search' | 'close' | 'edit' | 'share'

interface BotonCommon {
  /** Receives the click, so a link kind can `preventDefault` and go back by history. */
  onClick?: (event: MouseEvent<HTMLElement>) => void
  disabled?: boolean
  ariaDescribedBy?: string
  /** For a button that opens and closes what `ariaControls` names (the price form's date chip). */
  ariaExpanded?: boolean
  ariaControls?: string
}

interface BotonWithText extends BotonCommon {
  children: ReactNode
  /** Rarely needed: a name longer than the visible word (a row's "Línea 2: Rosa"). */
  ariaLabel?: string
  action?: undefined
}

export interface BotonIconText extends BotonWithText {
  variant?: 'primary' | 'secondary' | 'destructive' | 'critical'
  icon: NombreIcono
  textOnly?: undefined
  type?: 'button'
}

export interface BotonSubmit extends BotonWithText {
  variant?: 'primary' | 'secondary' | 'destructive'
  icon?: undefined
  textOnly: 'submit'
  type: 'submit'
}

export interface BotonTextKind extends BotonWithText {
  variant: 'link' | 'undo' | 'back'
  icon?: undefined
  textOnly?: undefined
  type?: 'button'
}

export interface BotonRow extends BotonWithText {
  variant: 'row'
  icon?: undefined
  textOnly?: undefined
  type?: 'button'
}

/** A tappable notice: a card that opens what it points to. Its sentence is its name. */
export interface BotonNotice extends BotonCommon {
  variant: 'notice'
  children: ReactNode
  icon?: undefined
  ariaLabel?: undefined
  textOnly?: undefined
  action?: undefined
  type?: 'button'
}

export interface BotonIconOnly extends BotonCommon {
  variant: 'icon'
  action: IconOnlyAction
  /** The control's name: the exact current word of the action. */
  ariaLabel: string
  children?: undefined
  icon?: undefined
  textOnly?: undefined
  type?: 'button'
}

/** Every shape but the submit, which a link cannot be. */
export type BotonVisualProps = BotonIconText | BotonTextKind | BotonRow | BotonNotice | BotonIconOnly

export type BotonProps = BotonVisualProps | BotonSubmit

/** Every variant a `Boton` can be drawn as, `primary` being the default of an absent one. */
export type BotonVariant = NonNullable<BotonProps['variant']> | 'primary'

export default function Boton(props: BotonProps) {
  const { className, ariaLabel, content } = botonVisual(props)
  return (
    <button
      type={props.type ?? 'button'}
      className={className}
      onClick={props.onClick}
      disabled={props.disabled ?? false}
      aria-label={ariaLabel}
      aria-describedby={props.ariaDescribedBy}
      aria-expanded={props.ariaExpanded}
      aria-controls={props.ariaControls}
    >
      {content}
    </button>
  )
}
