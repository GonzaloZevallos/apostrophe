/**
 * `Catalogo` at `/varieties/catalog` (`Catalogo.dc.html`, `CatalogoCompu.dc.html`): today's
 * catalog text, built by the backend alone from today's prices and stock. A detail, so
 * (the shell draws its "‹ Varieties") and no "+ New sale". "How it looks in Telegram" comes only from
 * `telegramPreview(data.text)` (plan, invariants: "No component splits on `**`").
 * Share hands the native share sheet (`share.ts`, the only module naming it) and
 * Copy copies (`clipboard.ts`, the one path that works over the home network's plain
 * http, ADR-0002) exactly the API's `text`, byte for byte; both are enabled only once
 * this mount's own fetch has resolved, so neither can hand over a text a cache kept.
 * "What's left out and why" words every variety the server says is out, one reason each
 * (`REASON_LABEL`), never by color alone; each name opens that variety's "In the catalog"
 * section. The header and footer are edited in Settings → Catalog message, the
 * bot in Integrations: this screen only links out. The pin's status and Publish are
 * `PinPublish`. Until section-forms moves it, a variety's catalog attributes are still
 * edited from here.
 *
 * The query is `catalogQueryOptions()` (ADR-0022): fetched on every mount, never kept
 * and never refetched on focus or reconnect.
 */

import { useEffect, useState } from 'react'
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
import {
  CATALOG_COPIED,
  CATALOG_TITLE,
  COPY,
  COPY_FAILED_MESSAGE,
  EDIT_HEADER_AND_FOOTER,
  EMPTY_STATE_DETAIL,
  EMPTY_STATE_TITLE,
  LEFT_OUT_HIDDEN,
  LEFT_OUT_LABEL,
  LEFT_OUT_NO_ENTRIES,
  LEFT_OUT_NO_PRICE,
  LEFT_OUT_SOLD_OUT,
  PREVIEW_LABEL,
  SHARE,
  SHARE_FAILED_MESSAGE,
} from '../copy/catalog'
import { telegramPreview } from './telegramPreview'
import { CATALOG_SECTION_ID, SETTINGS_CATALOG_MESSAGE, VARIETY, pathTo } from '../routes'

// The one table from GET /catalog's `state` to the word that says why a variety does not
// go out (PRD criterion 4). The front never decides the reason, it only words the server's.
const REASON_LABEL: Record<Exclude<CatalogVarietyState, 'in'>, { word: string; tono: InsigniaTono }> = {
  hidden: { word: LEFT_OUT_HIDDEN, tono: 'neutro' },
  no_price: { word: LEFT_OUT_NO_PRICE, tono: 'neutro' },
  sold_out: { word: LEFT_OUT_SOLD_OUT, tono: 'critico' },
  no_entries: { word: LEFT_OUT_NO_ENTRIES, tono: 'neutro' },
}

export default function Catalogo() {
  useOutletContext<Me>()
  const catalogQuery = useQuery(catalogQueryOptions())

  const [toast, setToast] = useState<SuccessToast | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [shareFailed, setShareFailed] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

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
        <h1 className="encabezado__titulo">{CATALOG_TITLE}</h1>

        {toast !== null && <AvisoExito texto={toast} />}

        <div className="catalogo__columnas">
        <div className="catalogo__vista">
        <span className="rotulo">{PREVIEW_LABEL}</span>
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
                <Boton
                  icon="compartir"
                  disabled={!settled || sharing}
                  onClick={() => void onShare(catalog.text as string)}
                >
                  {SHARE}
                </Boton>
              )}
              <Boton
                variant="secondary"
                icon="copiar"
                disabled={!settled || copying}
                onClick={() => void onCopy(catalog.text as string)}
              >
                {COPY}
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
                <span className="rotulo">{LEFT_OUT_LABEL}</span>
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
              {EDIT_HEADER_AND_FOOTER}
            </BotonLink>
          </>
        )}
        </div>
        </div>
      </div>
    </main>
  )
}
