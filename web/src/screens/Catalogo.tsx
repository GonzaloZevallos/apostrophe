/**
 * `Catalogo` (plan, "Front"; `Catalogo.dc.html`): today's catalog text, built by the
 * backend alone from today's prices and stock. "Cómo se ve en Telegram" comes only
 * from `telegramPreview(data.text)` (plan, invariants: "No component splits on
 * `**`"); Copiar copies the raw API text through `clipboard.ts::copyText`, the one
 * path that works over the home network's plain http (ADR-0002), and is not
 * rendered until this open's own fetch has resolved. "Qué sale en el catálogo"
 * tells every variety in or out by word (`STATE_LABEL`), never by color alone, and
 * opens that variety's attributes for editing. The header and footer show here
 * read-only; "Editar encabezado y pie" opens Configuración → Mensaje del catálogo. The pin's status and Publicar are `PinPublish`; the bot's
 * settings and Probarlo live in Configuración → Integraciones, not here.
 *
 * The query is frozen (`gcTime: 0`, `staleTime: Infinity`, no refetch on focus or
 * reconnect — plan, invariants): a seller who leaves the screen open must not have
 * it silently recompute behind their back, and a save's own answer becomes the
 * query's data directly, through `setQueryData`, rather than invalidating and
 * refetching.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE, get, put } from '../api/client'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import { GONE_NOTICE, isGone, kindOf, resolveOverride, type RefusalCode } from '../api/refusals'
import { copyText } from '../clipboard'
import AvisoExito, { type SuccessToast } from '../components/AvisoExito'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import SinConexion from '../components/SinConexion'
import PinPublish from './PinPublish'
import { CATALOG_SAVED } from './settings/messages'
import { telegramPreview } from './telegramPreview'
import { MORE } from '../routes'

export const CATALOG_COPIED = 'Catálogo copiado'
export const COPY_FAILED_MESSAGE = 'No se pudo copiar.'
export const EMPTY_STATE_TITLE = 'No hay nada en el catálogo hoy'
export const EMPTY_STATE_DETAIL = 'No hay nada para copiar todavía'
export const EMOJI_INVALID_MESSAGE = 'Poné exactamente un emoji'
export const INDICA_SHARE_INVALID_MESSAGE = 'El porcentaje de índica va de 0 a 100'
export const AROMA_TOO_LONG_MESSAGE = 'El aroma es demasiado largo'
export const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'

type CatalogVarietyState = 'in' | 'hidden' | 'no_price' | 'sold_out' | 'no_entries'

// The first reason that applies, in words, never by color alone (PRD criterion 4).
const STATE_LABEL: Record<CatalogVarietyState, string> = {
  in: 'Sale',
  hidden: 'Oculta',
  no_price: 'No sale: sin precio hoy',
  sold_out: 'No sale: está agotada',
  no_entries: 'No sale: sin entradas',
}

interface CatalogVariety {
  id: number
  name: string
  emoji: string | null
  indica_share: number | null
  aroma: string | null
  shown: boolean
  state: CatalogVarietyState
}

interface Catalog {
  text: string | null
  header: string
  footer: string
  varieties: CatalogVariety[]
}

const ATTRIBUTES_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'catalog.emoji_invalid': EMOJI_INVALID_MESSAGE,
  'catalog.indica_share_invalid': INDICA_SHARE_INVALID_MESSAGE,
  'catalog.aroma_too_long': AROMA_TOO_LONG_MESSAGE,
}

function detailFor(variety: CatalogVariety): string {
  const bits: string[] = []
  if (variety.indica_share !== null) bits.push(`${variety.indica_share}% índica`)
  if (variety.aroma !== null && variety.aroma !== '') bits.push(variety.aroma)
  return bits.join(' · ')
}

export default function Catalogo() {
  useOutletContext<Me>()
  const queryClient = useQueryClient()
  const catalogQuery = useQuery({
    queryKey: keys.catalog(),
    queryFn: () => get<Catalog>('/catalog'),
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const [toast, setToast] = useState<SuccessToast | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [copying, setCopying] = useState(false)
  const [gone, setGone] = useState(false)

  const [editingVarietyId, setEditingVarietyId] = useState<number | null>(null)
  const [attrShown, setAttrShown] = useState(true)
  const [attrEmoji, setAttrEmoji] = useState('')
  const [attrIndicaShare, setAttrIndicaShare] = useState('')
  const [attrAroma, setAttrAroma] = useState('')
  const [attrError, setAttrError] = useState<string | null>(null)
  const [attrOffline, setAttrOffline] = useState(false)
  const [savingAttrs, setSavingAttrs] = useState(false)

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!gone) return
    const timer = setTimeout(() => setGone(false), 4000)
    return () => clearTimeout(timer)
  }, [gone])

  function applyWrite(view: Catalog): void {
    queryClient.setQueryData(keys.catalog(), view)
  }

  function startEditingVariety(variety: CatalogVariety): void {
    setEditingVarietyId(variety.id)
    setAttrShown(variety.shown)
    setAttrEmoji(variety.emoji ?? '')
    setAttrIndicaShare(variety.indica_share === null ? '' : String(variety.indica_share))
    setAttrAroma(variety.aroma ?? '')
    setAttrError(null)
    setAttrOffline(false)
  }

  async function onSaveAttributes(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (editingVarietyId === null) return
    setAttrError(null)
    setAttrOffline(false)
    // Only a shape check (whole digits, so it is representable as the `int` the API
    // takes): the 0–100 range itself is the domain's `IndicaShare` rule alone (plan,
    // invariants; CODING_STANDARDS §10, "the backend decides") — a value that is
    // shaped like an integer but out of range (e.g. "150") must reach the server and
    // come back as `catalog.indica_share_invalid`, not be refused here first.
    const trimmedShare = attrIndicaShare.trim()
    let indicaShare: number | null = null
    if (trimmedShare !== '') {
      if (!/^\d+$/.test(trimmedShare)) {
        setAttrError(INDICA_SHARE_INVALID_MESSAGE)
        return
      }
      indicaShare = Number(trimmedShare)
    }
    setSavingAttrs(true)
    try {
      const view = await put<Catalog>(`/catalog/varieties/${editingVarietyId}`, {
        shown: attrShown,
        emoji: attrEmoji.trim() === '' ? null : attrEmoji.trim(),
        indica_share: indicaShare,
        aroma: attrAroma.trim() === '' ? null : attrAroma,
      })
      applyWrite(view)
      setEditingVarietyId(null)
      setToast(CATALOG_SAVED)
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        setEditingVarietyId(null)
        setGone(true)
      } else if (caught instanceof ApiError) {
        const message = resolveOverride(ATTRIBUTES_OVERRIDES, caught.code)
        if (message !== undefined) setAttrError(message)
        else if (caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal') {
          setAttrError(GENERIC_REFUSAL_MESSAGE)
        } else {
          setAttrError(ERROR_GENERICO_MENSAJE)
        }
      } else if (caught instanceof NetworkError) {
        setAttrOffline(true)
      } else {
        setAttrError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSavingAttrs(false)
    }
  }

  async function onCopy(text: string): Promise<void> {
    setCopyFailed(false)
    setCopying(true)
    try {
      const ok = await copyText(text)
      if (ok) setToast(CATALOG_COPIED)
      else setCopyFailed(true)
    } finally {
      setCopying(false)
    }
  }

  if (catalogQuery.isError) {
    if (catalogQuery.error instanceof NetworkError) {
      return (
        <main className="pantalla">
          <div className="cuerpo">
            <SinConexion />
          </div>
        </main>
      )
    }
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <ErrorGenerico />
        </div>
      </main>
    )
  }

  const catalog = catalogQuery.data

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="encabezado__fila">
          <Link to={MORE} aria-label="Volver" className="encabezado__volver">
            ‹
          </Link>
          <span className="encabezado__titulo">Catálogo</span>
        </div>

        {gone && (
          <div role="status" className="aviso-neutro">
            <span className="aviso-neutro__texto">{GONE_NOTICE}</span>
          </div>
        )}
        {toast !== null && <AvisoExito texto={toast} />}

        <span className="rotulo">Cómo se ve en Telegram</span>
        {catalog === undefined ? (
          <div className="catalogo__vista-previa" />
        ) : catalog.text === null ? (
          <div className="estado-vacio">
            <span className="estado-vacio__titulo">{EMPTY_STATE_TITLE}</span>
            <span className="estado-vacio__detalle">{EMPTY_STATE_DETAIL}</span>
          </div>
        ) : (
          <div className="catalogo__vista-previa">
            {telegramPreview(catalog.text).map((segment, index) =>
              segment.bold ? (
                <strong key={index}>{segment.text}</strong>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
          </div>
        )}

        {catalog !== undefined && catalog.text !== null && (
          <>
            <button
              type="button"
              className="boton"
              disabled={copying}
              onClick={() => void onCopy(catalog.text as string)}
            >
              Copiar
            </button>
            {copyFailed && (
              <span className="campo__error" role="alert">
                {COPY_FAILED_MESSAGE}
              </span>
            )}
          </>
        )}

        <PinPublish />

        {catalog !== undefined && (
          <>
            <span className="rotulo">Qué sale en el catálogo</span>
            <div className="catalogo__lista">
              {catalog.varieties.map((variety) => (
                <div key={variety.id} className="catalogo__fila">
                  <span className="catalogo__fila-emoji">{variety.emoji ?? ''}</span>
                  <span className="catalogo__fila-texto">
                    <span className="catalogo__fila-nombre">{variety.name}</span>
                    {detailFor(variety) !== '' && (
                      <span className="catalogo__fila-detalle">{detailFor(variety)}</span>
                    )}
                    <span className="catalogo__fila-estado">{STATE_LABEL[variety.state]}</span>
                  </span>
                  <button
                    type="button"
                    className="boton-enlace"
                    aria-label={`Editar ${variety.name}`}
                    onClick={() => startEditingVariety(variety)}
                  >
                    Editar
                  </button>
                </div>
              ))}
            </div>

            {editingVarietyId !== null && (
              <form className="formulario" onSubmit={onSaveAttributes}>
                <label className="campo campo--casilla">
                  <input
                    type="checkbox"
                    checked={attrShown}
                    onChange={(event) => setAttrShown(event.target.checked)}
                  />
                  <span className="campo__rotulo">Se muestra en el catálogo</span>
                </label>
                <label className="campo">
                  <span className="campo__rotulo">Emoji</span>
                  <input
                    className="campo__input"
                    type="text"
                    value={attrEmoji}
                    onChange={(event) => setAttrEmoji(event.target.value)}
                  />
                </label>
                <label className="campo">
                  <span className="campo__rotulo">Porcentaje de índica</span>
                  <input
                    className="campo__input"
                    type="text"
                    inputMode="numeric"
                    value={attrIndicaShare}
                    onChange={(event) => setAttrIndicaShare(event.target.value)}
                  />
                </label>
                <label className="campo">
                  <span className="campo__rotulo">Aroma/sabor</span>
                  <input
                    className="campo__input"
                    type="text"
                    value={attrAroma}
                    onChange={(event) => setAttrAroma(event.target.value)}
                  />
                </label>
                {attrError !== null && (
                  <span className="campo__error" role="alert">
                    {attrError}
                  </span>
                )}
                {attrOffline && <SinConexion />}
                <button className="boton" type="submit" disabled={savingAttrs}>
                  Guardar
                </button>
              </form>
            )}

            <div className="catalogo__encabezado-pie">
              <div className="catalogo__fila">
                <span className="catalogo__fila-texto">
                  <span className="campo__rotulo">Encabezado</span>
                  <span>{catalog.header}</span>
                </span>
              </div>
              <div className="catalogo__fila">
                <span className="catalogo__fila-texto">
                  <span className="campo__rotulo">Pie</span>
                  <span>{catalog.footer}</span>
                </span>
              </div>
              <Link
                to="/settings/catalog-message"
                state={{ inApp: true }}
                className="boton-enlace"
              >
                Editar encabezado y pie
              </Link>
            </div>

          </>
        )}
      </div>
    </main>
  )
}
