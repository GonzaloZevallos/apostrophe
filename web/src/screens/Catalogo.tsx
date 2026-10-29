/**
 * `Catalogo` at `/varieties/catalog` (`Catalogo.dc.html`, `CatalogoCompu.dc.html`): today's
 * catalog text, built by the backend alone from today's prices and stock. A detail, so
 * (the shell draws its "‹ Variedades") and no "+ Nueva venta". "Cómo se ve en Telegram" comes only from
 * `telegramPreview(data.text)` (plan, invariants: "No component splits on `**`").
 * Compartir hands the native share sheet (`share.ts`, the only module naming it) and
 * Copiar copies (`clipboard.ts`, the one path that works over the home network's plain
 * http, ADR-0002) `plainCopy(text)`: the API's `text` with its paired `**` removed and
 * every line break kept, so it pastes into Telegram with its line breaks; both are enabled only once
 * this mount's own fetch has resolved, so neither can hand over a text a cache kept. A share
 * or copy still pending (an iOS sheet that never finishes) holds neither button: another tap
 * starts a new one, and only the latest tap's outcome shows. No timer, nothing copied on its own.
 * "Qué no sale y por qué" words every variety the server says is out, one reason each
 * (`REASON_LABEL`), never by color alone; each name opens that variety's "En el catálogo"
 * section. The header and footer are edited in Configuración → Mensaje del catálogo, the
 * bot in Integraciones: this screen only links out. The pin's status and Publicar are
 * `PinPublish`. Until section-forms moves it, a variety's catalog attributes are still
 * edited from here.
 *
 * The query is `catalogQueryOptions()` (ADR-0022): fetched on every mount, never kept
 * and never refetched on focus or reconnect.
 */

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router'
import { catalogQueryOptions, type CatalogVarietyState } from '../api/catalog'
import { NetworkError } from '../api/client'
import type { Me } from '../api/me'
import { copyText } from '../clipboard'
import { canShare, shareText } from '../share'
import Boton from '../components/Boton'
import BotonLink from '../components/BotonLink'
import AvisoExito, { type SuccessToast } from '../components/AvisoExito'
import Insignia, { type InsigniaTono } from '../components/Insignia'
import ErrorGenerico from '../components/ErrorGenerico'
import SinConexion from '../components/SinConexion'
import PinPublish from './PinPublish'
import { CATALOG_TEXT } from '../copy/catalog'
import { useTranslation } from 'react-i18next'
import { EMPTY_STATE_KEYS } from '../copy/emptyStates'
import { plainCopy } from './catalogCopy'
import { telegramPreview } from './telegramPreview'
import { CATALOG_SECTION_ID, SETTINGS_CATALOG_MESSAGE, VARIETY, pathTo } from '../routes'
import { COMMON_TEXT } from '../copy/common'
import { STOCK_TEXT } from '../copy/stock'

export const CATALOG_COPIED = CATALOG_TEXT.catalogoCopiado
export const COPY_FAILED_MESSAGE = CATALOG_TEXT.noSePudoCopiar
export const SHARE_FAILED_MESSAGE = CATALOG_TEXT.noSePudoCompartir

// The one table from GET /catalog's `state` to the word that says why a variety does not
// go out (PRD criterion 4). The front never decides the reason, it only words the server's.
const REASON_LABEL: Record<Exclude<CatalogVarietyState, 'in'>, { word: string; tono: InsigniaTono }> = {
  hidden: { word: CATALOG_TEXT.reasonHidden, tono: 'neutro' },
  no_price: { word: CATALOG_TEXT.reasonNoPrice, tono: 'neutro' },
  sold_out: { word: STOCK_TEXT.statusSoldOut, tono: 'critico' },
  no_entries: { word: STOCK_TEXT.statusNoEntries, tono: 'neutro' },
}

export default function Catalogo() {
  const { t } = useTranslation()
  useOutletContext<Me>()
  const catalogQuery = useQuery(catalogQueryOptions())

  const [toast, setToast] = useState<SuccessToast | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [shareFailed, setShareFailed] = useState(false)
  // One counter per action: a tap takes the next number and applies its outcome only while
  // it is still the latest, so a share or copy that settles late shows nothing.
  const latestShare = useRef(0)
  const latestCopy = useRef(0)

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  // `copyText` and `shareText` are called before any await: the share sheet and the
  // `execCommand` fallback need the tap's own user activation. Neither rejects.
  async function onCopy(text: string): Promise<void> {
    setCopyFailed(false)
    const mine = ++latestCopy.current
    const ok = await copyText(text)
    if (mine !== latestCopy.current) return
    if (ok) setToast(CATALOG_COPIED)
    else setCopyFailed(true)
  }

  async function onShare(text: string): Promise<void> {
    setShareFailed(false)
    const mine = ++latestShare.current
    const outcome = await shareText(text)
    if (mine === latestShare.current) setShareFailed(outcome === 'failed')
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
        <h1 className="encabezado__titulo">{COMMON_TEXT.catalog}</h1>

        {toast !== null && <AvisoExito texto={toast} />}

        <div className="catalogo__columnas">
        <div className="catalogo__vista">
        <span className="rotulo">{CATALOG_TEXT.comoSeVeEn}</span>
        {catalog === undefined ? (
          <div className="catalogo__vista-previa" />
        ) : catalog.text === null ? (
          <div className="estado-vacio">
            <span className="estado-vacio__titulo">{t(EMPTY_STATE_KEYS.catalogTitle)}</span>
            <span className="estado-vacio__detalle">{t(EMPTY_STATE_KEYS.catalogDetail)}</span>
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
                <Boton
                  icon="compartir"
                  disabled={!settled}
                  onClick={() => void onShare(plainCopy(catalog.text as string))}
                >
                  {COMMON_TEXT.share}
                </Boton>
              )}
              <Boton
                variant="secondary"
                icon="copiar"
                disabled={!settled}
                onClick={() => void onCopy(plainCopy(catalog.text as string))}
              >
                {COMMON_TEXT.copy}
              </Boton>
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
                <span className="rotulo">{CATALOG_TEXT.queNoSaleY}</span>
                <ul className="catalogo__lista">
                  {leftOut.map((variety) => {
                    const reason = REASON_LABEL[variety.state as Exclude<CatalogVarietyState, 'in'>]
                    return (
                      <li key={variety.id} className="catalogo__fila">
                        <span className="catalogo__fila-texto">
                          <Link
                            to={{ pathname: pathTo(VARIETY, { id: variety.id }), hash: CATALOG_SECTION_ID }}
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

            <BotonLink to={SETTINGS_CATALOG_MESSAGE} variant="link">
              {CATALOG_TEXT.editarEncabezadoYPie}
            </BotonLink>
          </>
        )}
        </div>
        </div>
      </div>
    </main>
  )
}
