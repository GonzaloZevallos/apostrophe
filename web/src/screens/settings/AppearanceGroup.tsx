/**
 * "Apariencia" (`ConfiguracionApariencia.dc.html` and its Compu sibling): Claro or Oscuro,
 * a radio group. A tap applies and remembers the choice at once through `theme.ts`
 * (ADR-0026): no save button, no toast and no unsaved-changes question, so the frame gets
 * `dirty={false}` and "Cerrar" always closes at once. The current choice is told by `aria-checked`,
 * the filled pill and the bolder word, never by color alone.
 */

import { useState } from 'react'
import { chooseTheme, currentTheme } from '../../theme'
import { GROUP_APPEARANCE, LEAVE_THEME, THEME_DARK, THEME_LABEL, THEME_LIGHT } from '../../copy/settings'
import SettingsGroup from './SettingsGroup'

const CHOICES = [
  { value: 'claro', label: THEME_LIGHT },
  { value: 'oscuro', label: THEME_DARK },
] as const

export default function AppearanceGroup() {
  const [theme, setTheme] = useState(currentTheme)

  function choose(next: (typeof CHOICES)[number]['value']) {
    chooseTheme(next)
    setTheme(next)
  }

  return (
    <SettingsGroup
      title={GROUP_APPEARANCE}
      dirty={false}
      leave={LEAVE_THEME}
    >
      <span className="rotulo ajustes-tema__rotulo" id="ajustes-tema-rotulo">
        {THEME_LABEL}
      </span>
      <div className="ajustes-tema" role="radiogroup" aria-labelledby="ajustes-tema-rotulo">
        {CHOICES.map((choice) => {
          const checked = theme === choice.value
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={checked}
              className={checked ? 'ajustes-tema__opcion ajustes-tema__opcion--activa' : 'ajustes-tema__opcion'}
              onClick={() => {
                choose(choice.value)
              }}
            >
              {choice.label}
            </button>
          )
        })}
      </div>
    </SettingsGroup>
  )
}
