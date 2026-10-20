/**
 * `VarietyPage` (`VariedadDetalle.dc.html`; varieties.md, "A variety's page"): one variety
 * on its own page. It receives its id only as a prop (`VarietyRoute` is the one reader of
 * the route's `:id`). A detail (the shell draws its back: "‹ Variedades", or "‹ Archivadas"), no "+ Nueva venta" (the route declares
 * `chrome: 'card'`). One summary line; "+ Entrada", "Nuevo precio" and "Sacar del stock" (the
 * withdrawal form with this variety chosen); four read-only
 * sections. Forms open over the page by history state (`varietyForms.ts`); the rename form
 * is rendered here, so are the other two (`ThresholdForm`, `CatalogAttributesForm`), and a state that
 * names no form renders nothing.
 *
 * Stock, status and days left are what `GET /stock` answered; whether the variety is shown
 * is the server's own `shown` from `GET /catalog`; nothing here decides a status or a reason.
 *
 * An archived variety (`archived` true) is the same page, read-only: "Archivada"
 * in words, its stock from `GET /stock?archived=true` and its catalog attributes from
 * `GET /catalog/archived`; the four sections are shown (the threshold as its stored setting
 * only), with no "+ Entrada", "Nuevo precio", "Sacar del stock", price delete, switch,
 * "Editar", form or removal; its one action is "Restaurar".
 */

import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useOutletContext } from 'react-router'
import { ApiError, NetworkError, get } from '../../api/client'
import { archivedCatalogQueryOptions, catalogQueryOptions } from '../../api/catalog'
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
import Insignia from '../../components/Insignia'
import LeaveConfirm from '../../components/LeaveConfirm'
import Loading from '../../components/Loading'
import MarcaEstado from '../../components/MarcaEstado'
import SinConexion from '../../components/SinConexion'
import { type LeaveGuard, useLeaveGuard } from '../../components/useLeaveGuard'
import { useFlash } from '../../flash/useFlash'
import { formatGrams, formatMoney } from '../../format/money'
import {
  CATALOG_SECTION_ID,
  STOCK_ENTRY_NEW,
  VARIETIES,
  VARIETY_PRICE_NEW,
  pathTo,
  withdrawalNewFor,
} from '../../routes'
import { daysLeft } from '../../copy/common'
import { TAKE_OUT_OF_STOCK, YES_DISCARD_IT } from '../../copy/stock'
import {
  ARCHIVED,
  DISCARD_CHANGE_QUESTION,
  DISCARD_TYPED_DETAIL,
  EDIT_NAME,
  ENTRY,
  ENTRY_ACCESSIBLE_NAME,
  HIDDEN,
  KEEP_TYPING,
  NEW_PRICE,
  NO_PRICE_TODAY,
  RESTORE,
  pricePerGram,
} from '../../copy/varieties'
import type { Variety } from '../Variedades'
import type { PriceRow } from './PriceRows'
import CatalogAttributesForm from './CatalogAttributesForm'
import RenameForm from './RenameForm'
import ThresholdForm from './ThresholdForm'
import VarietyCatalogSection from './VarietyCatalogSection'
import { readForm, useOpenForm } from './varietyForms'
import VarietyRemoval from './VarietyRemoval'
import VarietyPricesSection from './VarietyPricesSection'
import VarietyStockSection from './VarietyStockSection'
import { TAB_VARIETIES } from '../../copy/shell'
import { useBackParent } from '../../shell/useBackParent'
import VarietyThresholdSection from './VarietyThresholdSection'
import { useRestore } from './useRestore'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="pantalla">
      <div className="cuerpo">{children}</div>
    </main>
  )
}

/** The guard of a page drawn behind the price modal: a router supports one blocker at a
 * time and the modal's host holds it, so this page asks for none. It is inert anyway. */
const UNBLOCKED: LeaveGuard = {
  blocker: { state: 'unblocked' as const, proceed: undefined, reset: undefined, location: undefined },
  disarm: () => undefined,
}
function useNoGuard(): LeaveGuard {
  return UNBLOCKED
}

export default function VarietyPage({ varietyId }: { varietyId: number }) {
  return <VarietyPageView varietyId={varietyId} useGuard={useLeaveGuard} publishRecord />
}

/** The page drawn behind the price modal (`VarietiesLayout`), with no leave guard of its own. */
export function VarietyPageBehind({ varietyId }: { varietyId: number }) {
  return <VarietyPageView varietyId={varietyId} useGuard={useNoGuard} publishRecord={false} />
}

function VarietyPageView({
  varietyId,
  useGuard,
  publishRecord,
}: {
  varietyId: number
  useGuard: (dirty: boolean) => LeaveGuard
  /** The routed page tells the shell's arrow about its variety; the copy behind the modal has no arrow. */
  publishRecord: boolean
}) {
  const id = String(varietyId)
  const me = useOutletContext<Me>()
  const location = useLocation()
  const navigate = useNavigate()
  const flash = useFlash()
  const openForm = useOpenForm()
  const [dirty, setDirty] = useState(false)
  const [gone, setGone] = useState(false)
  const { blocker, disarm } = useGuard(dirty)
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), [])

  const varietyQuery = useQuery({ queryKey: keys.variety(id), queryFn: () => get<VarietyDetail & Variety>(`/varieties/${id}`) })
  const pricesQuery = useQuery({
    queryKey: keys.varietyPrices(id),
    queryFn: () => get<PriceRow[]>(`/varieties/${id}/prices`),
  })
  const archived = varietyQuery.data?.archived === true
  useBackParent('variety' as const, !publishRecord || varietyQuery.data === undefined ? undefined : archived ? { parent: 'varieties-archived' as const } : { title: TAB_VARIETIES })
  const liveStockQuery = useQuery({ queryKey: keys.stock(), queryFn: readStock })
  const archivedStockQuery = useQuery({
    queryKey: keys.archivedStock(),
    queryFn: readArchivedStock,
    enabled: archived,
  })
  const stockQuery = archived ? archivedStockQuery : liveStockQuery
  const movementsQuery = useQuery({ queryKey: keys.stockMovements(id), queryFn: () => readMovements(id) })
  const { restoreFromPage, sending: restoring, notice: restoreNotice } = useRestore()
  const catalogQuery = useQuery({
    ...catalogQueryOptions(),
    select: (catalog) => catalog.varieties.find((row) => row.id === varietyId) ?? null,
  })

  const archivedCatalogQuery = useQuery({ ...archivedCatalogQueryOptions(), enabled: archived })
  const archivedAttributes = archivedCatalogQuery.data?.find((attributes) => attributes.variety_id === varietyId) ?? null

  const catalogRow = catalogQuery.data ?? null
  const ready = varietyQuery.data !== undefined && pricesQuery.data !== undefined && stockQuery.data !== undefined
  const anchored = ready && catalogRow !== null
  useEffect(() => {
    if (!anchored || location.hash !== `#${CATALOG_SECTION_ID}`) return
    document.getElementById(CATALOG_SECTION_ID)?.scrollIntoView()
  }, [anchored, location.hash])

  const failure = varietyQuery.error ?? pricesQuery.error ?? stockQuery.error ?? archivedCatalogQuery.error
  if (gone || (failure instanceof ApiError && isGone(failure.code))) {
    return <GoneScreen label={TAB_VARIETIES} to={VARIETIES} />
  }
  if (failure !== null) {
    return <Card>{failure instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}</Card>
  }
  if (
    varietyQuery.data === undefined ||
    pricesQuery.data === undefined ||
    stockQuery.data === undefined ||
    (archived && archivedCatalogQuery.data === undefined)
  ) {
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
        <div className="encabezado-fila">
          <h1 className="encabezado__titulo">{variety.name}</h1>
          {!archived && (
            <Boton variant="icon" action="edit" ariaLabel={EDIT_NAME} onClick={() => openForm('rename' as const)} />
          )}
        </div>
        {row !== undefined && archived && (
          <>
            <p className="variedad-resumen variedad-resumen--archivada">
              {formatGrams(row.grams)}
              {' · '}
              {variety.current_price === null ? NO_PRICE_TODAY : pricePerGram(formatMoney(variety.current_price.list_price))}
            </p>
            <div className="variedad-marcas">
              <Insignia>{ARCHIVED}</Insignia>
              {archivedAttributes !== null && !archivedAttributes.shown && <span className="variedad-resumen__oculta">{HIDDEN}</span>}
            </div>
          </>
        )}
        {row !== undefined && !archived && (
          <p className="variedad-resumen">
            {formatGrams(row.grams)} · <MarcaEstado estado={row.status} />
            {catalogRow !== null && !catalogRow.shown && <> · <span className="variedad-resumen__oculta">{HIDDEN}</span></>}
            {row.days_left !== null && <> · {daysLeft(row.days_left)}</>}
            {' · '}
            {variety.current_price === null ? NO_PRICE_TODAY : pricePerGram(formatMoney(variety.current_price.list_price))}
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
              <Boton variant="primary" icon="restaurar" disabled={restoring} onClick={() => void restoreFromPage(varietyId)}>
                {RESTORE}
              </Boton>
            </div>
          </>
        ) : (
          <div className="variedad-acciones">
            <BotonLink variant="secondary" icon="agregar" ariaLabel={ENTRY_ACCESSIBLE_NAME} to={`${STOCK_ENTRY_NEW}?variety=${varietyId}`}>
              {ENTRY}
            </BotonLink>
            <BotonLink variant="secondary" icon="precio" to={pathTo(VARIETY_PRICE_NEW, { id: varietyId })}>
              {NEW_PRICE}
            </BotonLink>
            <BotonLink variant="secondary" icon="salidaStock" to={withdrawalNewFor(varietyId)}>
              {TAKE_OUT_OF_STOCK}
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
        {row !== undefined && (
          <VarietyThresholdSection
            varietyId={varietyId}
            row={row}
            refreshing={stockQuery.isFetching}
            onGone={() => setGone(true)}
            readOnly={archived}
          />
        )}
        {archived ? (
          archivedAttributes !== null && <VarietyCatalogSection row={archivedAttributes} readOnly />
        ) : (
          catalogRow !== null && <VarietyCatalogSection row={catalogRow} />
        )}
        {catalogQuery.isError && (catalogQuery.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
        {!archived && <VarietyRemoval varietyId={varietyId} removal={variety.removal} grams={row?.grams ?? null} />}
      </div>
      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question={DISCARD_CHANGE_QUESTION}
          detail={DISCARD_TYPED_DETAIL}
          keepLabel={KEEP_TYPING}
          discardLabel={YES_DISCARD_IT}
        />
      )}
    </main>
  )
}
