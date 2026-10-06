/**
 * `Catalogo` at `/varieties/catalog` (`Catalogo.dc.html`, `CatalogoCompu.dc.html`): today's
 * catalog text, built by the backend alone from today's prices and stock. A detail, so
 * "‹ Variedades" and no "+ Nueva venta". "Cómo se ve en Telegram" comes only from
 * `telegramPreview(data.text)` (plan, invariants: "No component splits on `**`").
 * Compartir hands the native share sheet (`share.ts`, the only module naming it) and
 * Copiar copies (`clipboard.ts`, the one path that works over the home network's plain
 * http, ADR-0002) exactly the API's `text`, byte for byte; both are enabled only once
 * this mount's own fetch has resolved, so neither can hand over a text a cache kept.
 * "Qué no sale y por qué" words every variety the server says is out, one reason each
 * (`REASON_LABEL`), never by color alone; each name opens that variety's "En el catálogo"
 * section. The header and footer are edited in Configuración → Mensaje del catálogo, the
 * bot in Integraciones: this screen only links out. The pin's status and Publicar are
 * `PinPublish`. Until section-forms moves it, a variety's catalog attributes are still
 * edited from here.
 *
 * The query is `catalogQueryOptions()` (ADR-0022): fetched on every mount, never kept
 * and never refetched on focus or reconnect. A save's own answer becomes the query's
 * data directly, through `writeCatalog`.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router'
import {
  catalogQueryOptions,
  writeCatalog,
  type Catalog,
  type CatalogVariety,
  type CatalogVarietyState,
} from '../api/catalog'
import { ApiError, NetworkError, UNKNOWN_CODE, put } from '../api/client'
import type { Me } from '../api/me'
import { GONE_NOTICE, isGone, kindOf, resolveOverride, type RefusalCode } from '../api/refusals'
import { copyText } from '../clipboard'
import { canShare, shareText } from '../share'
import AvisoExito, { type SuccessToast } from '../components/AvisoExito'
import Insignia, { type InsigniaTono } from '../components/Insignia'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import SinConexion from '../components/SinConexion'
import PinPublish from './PinPublish'
import { CATALOG_SAVED } from './settings/messages'
import { telegramPreview } from './telegramPreview'
import { CATALOG_SECTION_ID, VARIETIES, VARIETY } from '../routes'

export const CATALOG_COPIED = 'Catálogo copiado'
export const COPY_FAILED_MESSAGE = 'No se pudo copiar.'
export const SHARE_FAILED_MESSAGE = 'No se pudo compartir.'
const SETTINGS_CATALOG_MESSAGE = '/settings/catalog-message'
export const EMPTY_STATE_TITLE = 'No hay nada en el catálogo hoy'
export const EMPTY_STATE_DETAIL = 'No hay nada para copiar todavía'
export const EMOJI_INVALID_MESSAGE = 'Poné exactamente un emoji'
export const INDICA_SHARE_INVALID_MESSAGE = 'El porcentaje de índica va de 0 a 100'
export const AROMA_TOO_LONG_MESSAGE = 'El aroma es demasiado largo'
export const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'

// The one table from GET /catalog's `state` to the word that says why a variety does not
// go out (PRD criterion 4). The front never decides the reason, it only words the server's.
const REASON_LABEL: Record<Exclude<CatalogVarietyState, 'in'>, { word: string; tono: InsigniaTono }> = {
  hidden: { word: 'oculta', tono: 'neutro' },
  no_price: { word: 'sin precio', tono: 'neutro' },
  sold_out: { word: 'agotada', tono: 'critico' },
  no_entries: { word: 'sin entradas', tono: 'neutro' },
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
  const catalogQuery = useQuery(catalogQueryOptions())

  const [toast, setToast] = useState<SuccessToast | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [shareFailed, setShareFailed] = useState(false)
  const [sharing, setSharing] = useState(false)
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
    writeCatalog(queryClient, view)
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

  async function onShare(text: string): Promise<void> {
    setShareFailed(false)
    setSharing(true)
    try {
      setShareFailed((await shareText(text)) === 'failed')
    } finally {
      setSharing(false)
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
  const settled = catalogQuery.isFetchedAfterMount && !catalogQuery.isFetching
  const leftOut = catalog?.varieties.filter((variety) => variety.state !== 'in') ?? []

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="encabezado__fila">
          <Link to={VARIETIES} className="boton-enlace">
            ‹ Variedades
          </Link>
        </div>
        <h1 className="encabezado__titulo">Catálogo</h1>

        {gone && (
          <div role="status" className="aviso-neutro">
            <span className="aviso-neutro__texto">{GONE_NOTICE}</span>
          </div>
        )}
        {toast !== null && <AvisoExito texto={toast} />}

        <div className="catalogo__columnas">
        <div className="catalogo__vista">
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
        </div>

        <div className="catalogo__panel">
        {catalog !== undefined && catalog.text !== null && (
          <>
            <div className="catalogo__acciones">
              {canShare() && (
                <button
                  type="button"
                  className="boton catalogo__compartir"
                  disabled={!settled || sharing}
                  onClick={() => void onShare(catalog.text as string)}
                >
                  Compartir
                </button>
              )}
              <button
                type="button"
                className="boton boton--suave catalogo__copiar"
                disabled={!settled || copying}
                onClick={() => void onCopy(catalog.text as string)}
              >
                Copiar
              </button>
            </div>
            {shareFailed && (
              <span className="campo__error" role="alert">
                {SHARE_FAILED_MESSAGE}
              </span>
            )}
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
            {leftOut.length > 0 && (
              <div className="catalogo__no-sale">
                <span className="rotulo">Qué no sale y por qué</span>
                <ul className="catalogo__lista">
                  {leftOut.map((variety) => {
                    const reason = REASON_LABEL[variety.state as Exclude<CatalogVarietyState, 'in'>]
                    return (
                      <li key={variety.id} className="catalogo__fila">
                        <span className="catalogo__fila-texto">
                          <Link
                            to={{ pathname: VARIETY(variety.id), hash: CATALOG_SECTION_ID }}
                            className="catalogo__fila-nombre"
                          >
                            {variety.name}
                          </Link>
                        </span>
                        <Insignia tono={reason.tono}>{reason.word}</Insignia>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <span className="rotulo">Atributos en el catálogo</span>
            <div className="catalogo__lista">
              {catalog.varieties.map((variety) => (
                <div key={variety.id} className="catalogo__fila">
                  <span className="catalogo__fila-emoji">{variety.emoji ?? ''}</span>
                  <span className="catalogo__fila-texto">
                    <span className="catalogo__fila-nombre">{variety.name}</span>
                    {detailFor(variety) !== '' && (
                      <span className="catalogo__fila-detalle">{detailFor(variety)}</span>
                    )}
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

            <Link to={SETTINGS_CATALOG_MESSAGE} state={{ inApp: true }} className="boton-enlace">
              Editar encabezado y pie
            </Link>
          </>
        )}
        </div>
        </div>
      </div>
    </main>
  )
}
