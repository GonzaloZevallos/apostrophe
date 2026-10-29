/**
 * "Apariencia" (`ConfiguracionApariencia.dc.html` and its Compu sibling): Automatic, Light or
 * Dark, a radio group. A tap applies and remembers the choice at once through `theme.ts`
 * (ADR-0026, amended by the owner's decision of 2026-10-29): Automatic follows the phone,
 * Light and Dark win over it. No save button, no toast and no unsaved-changes question, so
 * the frame gets `dirty={false}` and no leave dialog, and "Cerrar" always closes at once. The
 * current choice is told by `aria-checked`, the filled pill, the bolder word and a check
 * beside the word, never by color alone. The control never shows whether the phone is now
 * light or dark.
 */

import { useState } from 'react'
import { chooseTheme, currentChoice, followSystem, type ThemeChoice } from '../../theme'
import Icono from '../../components/Icono'
import SettingsGroup from './SettingsGroup'
import { SETTINGS_TEXT } from '../../copy/settings'
import { COMMON_TEXT } from '../../copy/common'

const CHOICES: readonly { value: ThemeChoice; label: string; apply: () => void }[] = [
  { value: 'automatic', label: SETTINGS_TEXT.automatic, apply: followSystem },
  { value: 'light', label: SETTINGS_TEXT.light, apply: () => { chooseTheme('claro') } },
  { value: 'dark', label: SETTINGS_TEXT.dark, apply: () => { chooseTheme('oscuro') } },
]

export default function AppearanceGroup() {
  const [choice, setChoice] = useState<ThemeChoice>(currentChoice)

  return (
    <SettingsGroup title={COMMON_TEXT.appearance} dirty={false}>
      <span className="rotulo ajustes-tema__rotulo" id="ajustes-tema-rotulo">
        {SETTINGS_TEXT.theme}
      </span>
      <div className="ajustes-tema" role="radiogroup" aria-labelledby="ajustes-tema-rotulo">
        {CHOICES.map((option) => {
          const checked = choice === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              className={checked ? 'ajustes-tema__opcion ajustes-tema__opcion--activa' : 'ajustes-tema__opcion'}
              onClick={() => {
                option.apply()
                setChoice(option.value)
              }}
            >
              {checked && <Icono nombre="hecho" />}
              {option.label}
            </button>
          )
        })}
      </div>
      <p className="ajustes-tema__ayuda">{SETTINGS_TEXT.automaticFollowsYourPhone}</p>
    </SettingsGroup>
  )
}
