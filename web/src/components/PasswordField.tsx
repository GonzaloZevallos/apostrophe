/**
 * A password field with its own reveal (ADR-0025): hidden by default, "Mostrar" /
 * "Ocultar" toggles it, and a refusal shows inline as an alert, under the input.
 * The reveal is a sibling of the label, never inside it, so the label's name stays
 * the field's name.
 */

import { useState } from 'react'
import Boton from './Boton'
import { COMMON_TEXT } from '../copy/common'

export default function PasswordField({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string | null
}) {
  const [reveal, setReveal] = useState(false)

  return (
    <>
      <label className="campo">
        <span className="campo__rotulo">{label}</span>
        <input
          className="campo__input"
          type={reveal ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        />
        {error !== undefined && error !== null && (
          <span className="campo__error" role="alert">
            {error}
          </span>
        )}
      </label>
      <span className="campo__mostrar">
        <Boton variant="link" onClick={() => setReveal((shown) => !shown)}>
          {reveal ? COMMON_TEXT.ocultar : COMMON_TEXT.mostrar}
        </Boton>
      </span>
    </>
  )
}
