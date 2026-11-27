/**
 * `SearchField`: the phone's search input for a list on screen (Products search). It is
 * controlled: it shows only what `value` says and keeps no text of its own. It filters,
 * it never chooses a value, so it is not a `Selector`. The label is visually hidden and
 * names the input; the placeholder is what the eye reads.
 */

import { useId, useRef } from 'react'
import Icono from './Icono'

export interface SearchFieldProps {
  label: string
  placeholder: string
  clearLabel: string
  value: string
  onChange: (value: string) => void
}

export function SearchField({ label, placeholder, clearLabel, value, onChange }: SearchFieldProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  function clear() {
    // Focus first and synchronously: the button unmounts once the value is empty.
    inputRef.current?.focus()
    onChange('')
  }

  return (
    <div className="search-field">
      <label className="visualmente-oculto" htmlFor={id}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        className="search-field__input"
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        inputMode="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
      <span className="search-field__icon" aria-hidden="true">
        <Icono nombre="buscar" />
      </span>
      {value !== '' && (
        <button type="button" className="search-field__clear" aria-label={clearLabel} onClick={clear}>
          <Icono nombre="cerrar" />
        </button>
      )}
    </div>
  )
}
