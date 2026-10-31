/**
 * `TimeZoneRoute`: Configuración → Negocio → "Time zone" (docs/adr/0057), the host of the
 * zone chooser on its own route. On a phone it is a `Sheet` (ADR-0062) with Close at the top and
 * "Save time zone" pinned at the bottom; the form knows nothing of the router.
 *
 * - The list starts on the stored zone, filtered by place (`filterTimeZones`). The chosen row
 *   carries a check plus the word "Selected" as its accessible name.
 * - Under the choice, "It is {datetime} there now": the API's own instant (`now_epoch_ms`) at the
 *   zone's UTC offset, formatted only by `localDateTimeIn`. A zone with no offset shows no line.
 * - Saving is one tap, no confirmation. Success leaves by history (`useBackOr`), the row's new
 *   value being the signal. `unknown_time_zone` shows its fixed text with the Attention icon,
 *   never the API's `detail`; any other failure shows the shared generic text.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, NetworkError } from '../../api/client'
import { REFUSAL_KEY } from '../../api/refusals'
import { type TimeZoneSettings, filterTimeZones, useSaveTimeZone, useTimeZone } from '../../api/timeZone'
import AvisoAmbar from '../../components/AvisoAmbar'
import Boton from '../../components/Boton'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import Icono from '../../components/Icono'
import Loading from '../../components/Loading'
import MasInfo from '../../components/MasInfo'
import Sheet, { SheetActions } from '../../components/Sheet'
import SinConexion from '../../components/SinConexion'
import { useBackOr } from '../../components/useBackOr'
import { localDateTimeIn } from '../../format/dates'
import { refusalText, type Refusal } from '../../i18n/refusalKeys'
import { SETTINGS_BUSINESS } from '../../routes'
import { useViewport } from '../../shell/useViewport'

const TIME_ZONE_INVALID: Refusal = { key: REFUSAL_KEY.unknown_time_zone }

export default function TimeZoneRoute() {
  const { t } = useTranslation()
  const leave = useBackOr(SETTINGS_BUSINESS)
  const computer = useViewport() === 'computer'
  const zones = useTimeZone()

  return (
    <Sheet
      computer={computer}
      computerClass="pantalla"
      computerDialog={false}
      label={t('timeZone:title')}
      touched={false}
      onClose={leave}
    >
      <div className="gasto-form zona">
        <div className="gasto-form__cabecera">
          <span className="gasto-form__titulo">{t('timeZone:title')}</span>
          <span className="gasto-form__cerrar">
            <Boton variant="icon" action="close" ariaLabel={t('common:close')} onClick={leave} />
          </span>
        </div>
        {zones.isPending && <Loading />}
        {zones.isError && (zones.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
        {zones.data !== undefined && <TimeZoneForm settings={zones.data} onSaved={leave} />}
      </div>
    </Sheet>
  )
}

function TimeZoneForm({ settings, onSaved }: { settings: TimeZoneSettings; onSaved: () => void }) {
  const { t } = useTranslation()
  const save = useSaveTimeZone()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(settings.time_zone)
  const [refusal, setRefusal] = useState<Refusal | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  const shown = filterTimeZones(settings.time_zones, query)
  const offset = settings.utc_offsets_minutes[settings.time_zones.indexOf(selected)] ?? null
  const preview = localDateTimeIn(settings.now_epoch_ms, offset)

  function choose(zone: string): void {
    setSelected(zone)
    setRefusal(null)
    setMessage(null)
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setRefusal(null)
    setMessage(null)
    setOffline(false)
    save.mutate(selected, {
      onSuccess: onSaved,
      onError: (caught) => {
        if (caught instanceof NetworkError) {
          setOffline(true)
        } else if (caught instanceof ApiError && caught.code === 'unknown_time_zone') {
          setRefusal(TIME_ZONE_INVALID)
        } else {
          setMessage(ERROR_GENERICO_MENSAJE)
        }
      },
    })
  }

  return (
    <form className="formulario" onSubmit={onSubmit}>
      <label className="campo">
        <span className="campo__rotulo zona__rotulo">{t('timeZone:searchLabel')}</span>
        <input
          className="campo__input"
          type="search"
          autoComplete="off"
          placeholder={t('timeZone:searchPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {shown.length === 0 ? (
        <p className="zona__vacio">{t('timeZone:empty', { query: query.trim() })}</p>
      ) : (
        <ul className="zona__lista" aria-label={t('timeZone:listLabel')}>
          {shown.map((zone) => {
            const chosen = zone === selected
            return (
              <li key={zone}>
                <button
                  type="button"
                  className={chosen ? 'zona__fila zona__fila--elegida' : 'zona__fila'}
                  aria-pressed={chosen}
                  onClick={() => choose(zone)}
                >
                  <span className="zona__nombre">{zone}</span>
                  {chosen && (
                    <span className="zona__marca">
                      <Icono nombre="hecho" label={t('timeZone:selected')} />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {preview !== null && <p className="zona__ahora">{t('timeZone:localTime', { datetime: preview })}</p>}
      <MasInfo line={t('timeZone:pastRecords')} more={t('timeZone:moreInfoBody')} />
      <SheetActions>
        {refusal !== null && (
          <AvisoAmbar attention role="alert">
            {refusalText(t, refusal)}
          </AvisoAmbar>
        )}
        {message !== null && (
          <span className="campo__error" role="alert">
            {message}
          </span>
        )}
        {offline && <SinConexion />}
        <Boton textOnly="submit" type="submit" disabled={save.isPending}>
          {save.isPending ? t('timeZone:saving') : t('timeZone:save')}
        </Boton>
      </SheetActions>
    </form>
  )
}
