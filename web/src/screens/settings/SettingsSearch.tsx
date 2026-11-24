/**
 * `SettingsSearch`, the search of the phone Settings home: the field row, the heading slot and the
 * results. `SettingsHome` gives it the shown groups (`shownRowsByGroup(ctx)`), whether both reads
 * have settled, and the normal content (the Business card and the list) as `children`; the
 * children show unless results do, so an empty field always shows the normal groups.
 *
 * The field is one `<input>` that is never remounted. Search opens on a tap or a change, never on
 * focus, through `useSettingsSearchEntry` (the only reader and writer of the history flag). The
 * text is reset during render when search closes, never in an effect. The heading slot is one
 * always-mounted live region: empty until both reads have answered or failed, so a count never
 * shows early; "Nothing found" replaces the list only once it has settled.
 */

import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { EMPTY_STATE_KEYS } from '../../copy/emptyStates'
import Icono from '../../components/Icono'
import InAppLink from '../../components/InAppLink'
import type { ShownGroup } from './settingsRows'
import { searchSettingsRows } from './settingsSearch'
import { useSettingsSearchEntry } from './useSettingsSearchEntry'

interface SettingsSearchProps {
  readonly groups: readonly ShownGroup[]
  /** Both reads the rows depend on have answered or failed. */
  readonly settled: boolean
  /** The normal content, shown unless results are. */
  readonly children: ReactNode
}

const ENTERED_FROM_SETTINGS = { enteredFrom: 'settings' }

export default function SettingsSearch({ groups, settled, children }: SettingsSearchProps) {
  const { t } = useTranslation()
  const { isOpen, open, close } = useSettingsSearchEntry()
  const [text, setText] = useState('')
  const [wasOpen, setWasOpen] = useState(isOpen)
  const [field, setField] = useState<HTMLInputElement | null>(null)

  if (wasOpen !== isOpen) {
    setWasOpen(isOpen)
    if (!isOpen) setText('')
  }

  const showResults = isOpen && text.trim() !== ''
  const results = showResults ? searchSettingsRows(groups, (key) => t(key), text) : []
  const heading =
    !showResults || !settled
      ? ''
      : results.length === 0
        ? t(EMPTY_STATE_KEYS.settingsSearchNothing)
        : t('settings:search.results', { count: results.length })

  return (
    <>
      <div className="ajustes-inicio-busqueda">
        <div className="ajustes-inicio-busqueda__fila">
          <div className="ajustes-inicio-busqueda__campo">
            <span className="ajustes-inicio-busqueda__lupa" aria-hidden="true">
              <Icono nombre="buscar" />
            </span>
            <input
              ref={setField}
              className="ajustes-inicio-busqueda__input"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              placeholder={t('settings:search.placeholder')}
              aria-label={t('settings:search.label')}
              value={text}
              onClick={() => {
                if (!isOpen) open()
              }}
              onChange={(event) => {
                setText(event.target.value)
                if (!isOpen) open()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
              }}
            />
            {text === '' ? null : (
              <button
                type="button"
                className="ajustes-inicio-busqueda__borrar"
                aria-label={t('settings:search.clear')}
                onClick={() => {
                  setText('')
                  field?.focus()
                }}
              >
                <Icono nombre="cerrar" />
              </button>
            )}
          </div>
          {isOpen ? (
            <button type="button" className="ajustes-inicio-busqueda__cancelar" onClick={close}>
              {t('common:cancel')}
            </button>
          ) : null}
        </div>
        <p
          role="status"
          aria-live="polite"
          className={
            isOpen
              ? 'ajustes-inicio-busqueda__ranura ajustes-inicio-busqueda__ranura--abierta'
              : 'ajustes-inicio-busqueda__ranura'
          }
        >
          {heading}
        </p>
      </div>
      {showResults ? (
        results.length === 0 ? null : (
          <ul className="ajustes-inicio-busqueda__resultados">
            {results.map(({ row, groupLabelKey }) => (
              <li key={row.key} className="ajustes-inicio__fila-celda">
                <InAppLink
                  to={row.to}
                  replace
                  state={ENTERED_FROM_SETTINGS}
                  className="ajustes__item ajustes-inicio__fila"
                >
                  <span className="ajustes-inicio__icono">
                    <Icono nombre={row.icon} />
                  </span>
                  <span className="ajustes-inicio__textos">
                    <span className="ajustes-inicio__rotulo ajustes-inicio-busqueda__linea">{t(row.labelKey)}</span>{' '}
                    <span className="ajustes-inicio__detalle">{t(groupLabelKey)}</span>
                  </span>
                  <span className="ajustes-inicio__flecha" aria-hidden="true">
                    <Icono nombre="chevron" />
                  </span>
                </InAppLink>
              </li>
            ))}
          </ul>
        )
      ) : (
        children
      )}
    </>
  )
}
