/**
 * `VarietyPage` (`VariedadDetalle.dc.html`; varieties.md, "A variety's page"): one variety
 * on its own page. It receives its id only as a prop (`VarietyRoute` is the one reader of
 * the route's `:id`). A detail: "‹ Variedades", no "+ Nueva venta" (the route declares
 * `chrome: 'card'`). One summary line; "+ Entrada" and "Nuevo precio"; four read-only
 * sections. Forms open over the page by history state (`varietyForms.ts`); the rename form
 * is rendered here, so are the other two (`ThresholdForm`, `CatalogAttributesForm`), and a state that
 * names no form renders nothing.
 *
 * Stock, status and days left are what `GET /stock` answered; whether the variety is shown
 * is the server's own `shown` from `GET /catalog`; nothing here decides a status or a reason.
 */

import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router'
import { ApiError, NetworkError, get } from '../../api/client'
import { catalogQueryOptions } from '../../api/catalog'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { isGone } from '../../api/refusals'
import { readStock } from '../../api/stock'
import type { SuccessToast } from '../../components/AvisoExito'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneScreen from '../../components/GoneScreen'
import LeaveConfirm from '../../components/LeaveConfirm'
import Loading from '../../components/Loading'
import MarcaEstado from '../../components/MarcaEstado'
import SinConexion from '../../components/SinConexion'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { useFlash } from '../../flash/useFlash'
import { formatGrams, formatMoney } from '../../format/money'
import { CATALOG_SECTION_ID, ENTRY_NEW, VARIETIES, VARIETY_PRICE_NEW } from '../../routes'
import { NO_PRICE_TODAY, type Variety } from '../Variedades'
import type { PriceRow } from './PriceRows'
import CatalogAttributesForm from './CatalogAttributesForm'
import RenameForm from './RenameForm'
import ThresholdForm from './ThresholdForm'
import VarietyCatalogSection from './VarietyCatalogSection'
import { readForm, useOpenForm } from './varietyForms'
import VarietyPricesSection from './VarietyPricesSection'
import VarietyStockSection from './VarietyStockSection'
import VarietyThresholdSection from './VarietyThresholdSection'

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

  const varietyQuery = useQuery({ queryKey: keys.variety(id), queryFn: () => get<Variety>(`/varieties/${id}`) })
  const pricesQuery = useQuery({
    queryKey: keys.varietyPrices(id),
    queryFn: () => get<PriceRow[]>(`/varieties/${id}/prices`),
  })
  const stockQuery = useQuery({ queryKey: keys.stock(), queryFn: readStock })
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
          <Link to={VARIETIES} className="boton--enlace">
            ‹ Variedades
          </Link>
        </div>
        <div className="encabezado-fila">
          <h1 className="encabezado__titulo">{variety.name}</h1>
          <button type="button" className="boton-enlace" aria-label="Editar nombre" onClick={() => openForm('rename')}>
            Editar
          </button>
        </div>
        {row !== undefined && (
          <p className="variedad-resumen">
            {formatGrams(row.grams)} · <MarcaEstado estado={row.status} />
            {catalogRow !== null && !catalogRow.shown && <> · <span className="variedad-resumen__oculta">Oculta</span></>}
            {row.days_left !== null && <> · {row.days_left} días</>}
            {' · '}
            {variety.current_price === null ? NO_PRICE_TODAY : `${formatMoney(variety.current_price.list_price)} x g`}
          </p>
        )}

        {form === 'rename' && (
          <RenameForm
            variety={variety}
            onDone={onSaved}
            onCancel={leaveForm}
            onDirtyChange={onDirtyChange}
            onGone={onFormGone}
          />
        )}

        {form === 'threshold' && row !== undefined && (
          <ThresholdForm
            varietyId={varietyId}
            threshold={row.threshold}
            onDone={onSaved}
            onCancel={leaveForm}
            onDirtyChange={onDirtyChange}
            onGone={onFormGone}
          />
        )}

        {form === 'catalog' && catalogRow !== null && (
          <CatalogAttributesForm
            row={catalogRow}
            onDone={onSaved}
            onCancel={leaveForm}
            onDirtyChange={onDirtyChange}
            onGone={onFormGone}
          />
        )}

        <div className="variedad-acciones">
          <Link className="boton boton--suave" to={`${ENTRY_NEW}?variety=${varietyId}`}>
            + Entrada
          </Link>
          <Link className="boton boton--suave" to={VARIETY_PRICE_NEW(varietyId)}>
            Nuevo precio
          </Link>
        </div>

        <VarietyStockSection stock={stock} varietyId={varietyId} today={me.today} />
        <VarietyPricesSection
          varietyId={varietyId}
          history={pricesQuery.data}
          currentPriceId={variety.current_price?.id ?? null}
        />
        {row !== undefined && <VarietyThresholdSection varietyId={varietyId} row={row} refreshing={stockQuery.isFetching} onGone={() => setGone(true)} />}
        {catalogRow !== null && <VarietyCatalogSection row={catalogRow} />}
        {catalogQuery.isError && (catalogQuery.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
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
