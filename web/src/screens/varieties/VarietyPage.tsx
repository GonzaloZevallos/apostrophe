/**
 * `VarietyPage` (`VariedadDetalle.dc.html`; varieties.md, "A variety's page"): one variety
 * on its own page. It receives its id only as a prop (`VarietyRoute` is the one reader of
 * the route's `:id`). A detail: "‹ Variedades", no "+ Nueva venta" (the route declares
 * `chrome: 'card'`). One summary line; "+ Entrada", "Nuevo precio" and "Sacar del stock" (the
 * withdrawal form with this variety chosen); four read-only
 * sections. Forms open over the page by history state (`varietyForms.ts`); the rename form
 * is rendered here, so are the other two (`ThresholdForm`, `CatalogAttributesForm`), and a state that
 * names no form renders nothing.
 *
 * Stock, status and days left are what `GET /stock` answered; whether the variety is shown
 * is the server's own `shown` from `GET /catalog`; nothing here decides a status or a reason.
 *
 * An archived variety (`archived` true) is the same page, read-only: "‹ Archivadas", "Archivada"
 * in words, its stock from `GET /stock?archived=true`, no "+ Entrada", "Nuevo precio", "Sacar
 * del stock", price delete, threshold, "Editar", form or removal; its one action is "Restaurar".
 */

import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useOutletContext } from 'react-router'
import { ApiError, NetworkError, get } from '../../api/client'
import { catalogQueryOptions } from '../../api/catalog'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { isGone } from '../../api/refusals'
import { readArchivedStock, readMovements, readStock } from '../../api/stock'
import type { VarietyDetail } from '../../api/varieties'
import type { SuccessToast } from '../../components/AvisoExito'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneScreen from '../../components/GoneScreen'
import BotonLink from '../../components/BotonLink'
import Boton from '../../components/Boton'
import LeaveConfirm from '../../components/LeaveConfirm'
import Loading from '../../components/Loading'
import MarcaEstado from '../../components/MarcaEstado'
import SinConexion from '../../components/SinConexion'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { useFlash } from '../../flash/useFlash'
import { formatGrams, formatMoney } from '../../format/money'
import {
  ARCHIVED_VARIETIES,
  CATALOG_SECTION_ID,
  STOCK_ENTRY_NEW,
  VARIETIES,
  VARIETY_PRICE_NEW,
  pathTo,
  withdrawalNewFor,
} from '../../routes'
import { NO_PRICE_TODAY, type Variety } from '../Variedades'
import type { PriceRow } from './PriceRows'
import CatalogAttributesForm from './CatalogAttributesForm'
import RenameForm from './RenameForm'
import ThresholdForm from './ThresholdForm'
import VarietyCatalogSection from './VarietyCatalogSection'
import { readForm, useOpenForm } from './varietyForms'
import VarietyRemoval from './VarietyRemoval'
import VarietyPricesSection from './VarietyPricesSection'
import VarietyStockSection from './VarietyStockSection'
import VarietyThresholdSection from './VarietyThresholdSection'
import { useRestore } from './useRestore'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="pantalla">
      <div className="cuerpo">{children}</div>
    </main>
  )
}

export default function VarietyPage({ varietyId }: { varietyId: number }) {
  const id = String(varietyId)
  const me = useOutletContext<Me>()
  const location = useLocation()
  const navigate = useNavigate()
  const flash = useFlash()
  const openForm = useOpenForm()
  const [dirty, setDirty] = useState(false)
  const [gone, setGone] = useState(false)
  const { blocker, disarm } = useLeaveGuard(dirty)
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), [])

  const varietyQuery = useQuery({ queryKey: keys.variety(id), queryFn: () => get<VarietyDetail & Variety>(`/varieties/${id}`) })
  const pricesQuery = useQuery({
    queryKey: keys.varietyPrices(id),
    queryFn: () => get<PriceRow[]>(`/varieties/${id}/prices`),
  })
  const archived = varietyQuery.data?.archived === true
  const liveStockQuery = useQuery({ queryKey: keys.stock(), queryFn: readStock })
  const archivedStockQuery = useQuery({
    queryKey: keys.archivedStock(),
    queryFn: readArchivedStock,
    enabled: archived,
  })
  const stockQuery = archived ? archivedStockQuery : liveStockQuery
  const movementsQuery = useQuery({ queryKey: keys.stockMovements(id), queryFn: () => readMovements(id) })
  const { restore, sending: restoring, notice: restoreNotice } = useRestore()
  const catalogQuery = useQuery({
    ...catalogQueryOptions(),
    select: (catalog) => catalog.varieties.find((row) => row.id === varietyId) ?? null,
  })

  const catalogRow = catalogQuery.data ?? null
  const ready = varietyQuery.data !== undefined && pricesQuery.data !== undefined && stockQuery.data !== undefined
  const anchored = ready && catalogRow !== null
  useEffect(() => {
    if (!anchored || location.hash !== `#${CATALOG_SECTION_ID}`) return
    document.getElementById(CATALOG_SECTION_ID)?.scrollIntoView()
  }, [anchored, location.hash])

  const failure = varietyQuery.error ?? pricesQuery.error ?? stockQuery.error
  if (gone || (failure instanceof ApiError && isGone(failure.code))) {
    return <GoneScreen label="Variedades" to={VARIETIES} />
  }
  if (failure !== null) {
    return <Card>{failure instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}</Card>
  }
  if (varietyQuery.data === undefined || pricesQuery.data === undefined || stockQuery.data === undefined) {
    return (
      <Card>
        <Loading />
      </Card>
    )
  }

  const variety = varietyQuery.data
  const stock = stockQuery.data
  const row = stock.varieties.find((candidate) => candidate.variety_id === varietyId)
  const form = readForm(location.state)

  function leaveForm(): void {
    void navigate(-1)
  }

  function onFormGone(): void {
    disarm()
    setGone(true)
  }

  function onSaved(saved: SuccessToast): void {
    disarm()
    flash.armAfterLeaving(saved)
    leaveForm()
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="encabezado__fila">
          {archived ? (
            <BotonLink to={ARCHIVED_VARIETIES} variant="back">
              ‹ Archivadas
            </BotonLink>
          ) : (
            <BotonLink to={VARIETIES} variant="back">
              ‹ Variedades
            </BotonLink>
          )}
        </div>
        <div className="encabezado-fila">
          <h1 className="encabezado__titulo">{variety.name}</h1>
          {!archived && (
            <Boton variant="link" ariaLabel="Editar nombre" onClick={() => openForm('rename')}>
              Editar
            </Boton>
          )}
        </div>
        {row !== undefined && (
          <p className="variedad-resumen">
            {formatGrams(row.grams)} · <MarcaEstado estado={row.status} />
            {archived && <> · <span className="variedad-resumen__oculta">Archivada</span></>}
            {!archived && catalogRow !== null && !catalogRow.shown && <> · <span className="variedad-resumen__oculta">Oculta</span></>}
            {row.days_left !== null && <> · {row.days_left} días</>}
            {' · '}
            {variety.current_price === null ? NO_PRICE_TODAY : `${formatMoney(variety.current_price.list_price)} x g`}
          </p>
        )}

        {!archived && form === 'rename' && (
          <RenameForm
            variety={variety}
            onDone={onSaved}
            onCancel={leaveForm}
            onDirtyChange={onDirtyChange}
            onGone={onFormGone}
          />
        )}

        {!archived && form === 'threshold' && row !== undefined && (
          <ThresholdForm
            varietyId={varietyId}
            threshold={row.threshold}
            onDone={onSaved}
            onCancel={leaveForm}
            onDirtyChange={onDirtyChange}
            onGone={onFormGone}
          />
        )}

        {!archived && form === 'catalog' && catalogRow !== null && (
          <CatalogAttributesForm
            row={catalogRow}
            onDone={onSaved}
            onCancel={leaveForm}
            onDirtyChange={onDirtyChange}
            onGone={onFormGone}
          />
        )}

        {archived ? (
          <>
            {restoreNotice}
            <div className="variedad-acciones">
              <button
                type="button"
                className="boton boton--suave"
                disabled={restoring}
                onClick={() => void restore(varietyId)}
              >
                Restaurar
              </button>
            </div>
          </>
        ) : (
          <div className="variedad-acciones">
            <BotonLink variant="secondary" icon="agregar" ariaLabel="+ Entrada" to={`${STOCK_ENTRY_NEW}?variety=${varietyId}`}>
              Entrada
            </BotonLink>
            <BotonLink variant="secondary" icon="agregar" to={pathTo(VARIETY_PRICE_NEW, { id: varietyId })}>
              Nuevo precio
            </BotonLink>
            <BotonLink variant="secondary" icon="stock" to={withdrawalNewFor(varietyId)}>
              Sacar del stock
            </BotonLink>
          </div>
        )}

        <VarietyStockSection stock={stock} movements={movementsQuery.data} varietyId={varietyId} today={me.today} />
        <VarietyPricesSection
          varietyId={varietyId}
          history={pricesQuery.data}
          currentPriceId={variety.current_price?.id ?? null}
          readOnly={archived}
        />
        {!archived && row !== undefined && <VarietyThresholdSection varietyId={varietyId} row={row} refreshing={stockQuery.isFetching} onGone={() => setGone(true)} />}
        {!archived && catalogRow !== null && <VarietyCatalogSection row={catalogRow} />}
        {catalogQuery.isError && (catalogQuery.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
        {!archived && <VarietyRemoval varietyId={varietyId} removal={variety.removal} grams={row?.grams ?? null} />}
      </div>
      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question="¿Descartás el cambio?"
          detail="Se pierde lo que escribiste: todavía no se guardó nada."
          keepLabel="No, seguí escribiendo"
          discardLabel="Sí, descartalo"
        />
      )}
    </main>
  )
}
