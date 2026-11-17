/**
 * `FieldRefusal`: a field's own refusal, drawn right at the field with the Attention icon beside
 * the sentence (`docs/product/icon-and-text-rule.md`, "Notices"). The icon is decorative
 * (`aria-hidden`): the sentence is the name, and the field points at it through `aria-describedby`.
 * `.campo__error` itself does not change; every other field's error is still a plain one.
 */

import type { ReactNode } from 'react'
import { AvisoCuerpo } from './AvisoAmbar'

export interface FieldRefusalProps {
  /** The id the field's `aria-describedby` names. */
  id: string
  children: ReactNode
}

export default function FieldRefusal({ id, children }: FieldRefusalProps) {
  return (
    <span id={id} className="campo__error" role="alert">
      <AvisoCuerpo attention>{children}</AvisoCuerpo>
    </span>
  )
}
