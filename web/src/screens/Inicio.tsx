/**
 * `Inicio` is the panel (`docs/product/results.md`): Hoy · Semana · Mes, switched
 * in the client with no fetch of their own (plan, "Front"), each figure read
 * straight from `GET /panel` (`PanelAnswer`, `web/src/api/fixtures/panel.json`) —
 * this screen never computes, sorts or sign-tests an amount itself (plan
 * invariant: "No screen does arithmetic, sorting, sign tests or comparisons on an
 * amount from the API"). Ganancia and Caja render through `formatSignedMoney`;
 * ranges through `formatDateShort` only.
 *
 * The panel query is frozen (`gcTime: 0`, `staleTime: Infinity`, no refetch on
 * focus or reconnect, plan invariant): a remount always re-fetches, so the
 * figures shown are always the current mount's own resolved answer, never a
 * stale one left behind by an earlier mount or another business.
 *
 * "Arrancá por las variedades" sits above the panel instead of replacing it (PM,
 * adjustment 5): a business can have history and no price today, and its figures
 * are real.
 *
 * The pinned-catalog notice (plan, "Front"; accounts.md's Inicio rule): a fixed
 * line, never a figure, while `GET /pinned-catalog/status` reads `out_of_date` —
 * before the first Publicar `status` is `null` and nothing shows (PRD, "Before the
 * first Publicar").
 */

import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router'
import { get, NetworkError } from '../api/client'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import {
  getPanel,
  type PanelAnswer,
  type PanelDebts,
  type PanelPeriod,
  type PanelTab,
} from '../api/panel'
import ErrorGenerico from '../components/ErrorGenerico'
import MarcaEstado from '../components/MarcaEstado'
import SinConexion from '../components/SinConexion'
import { salesCount } from '../format/counts'
import { formatDateShort } from '../format/dates'
import { formatGrams, formatMoney, formatSignedMoney } from '../format/money'
import { initialsOf } from '../shell/initials'
import { detailFor, sideNoteFor } from '../stock/detail'
import { CATALOG } from '../routes'

export const EMPTY_TITLE = 'Arrancá por las variedades'
export const EMPTY_DETAIL =
  'Cargá tu primera variedad con su precio. Sin precio no se puede cargar una venta.'
export const PINNED_CATALOG_OUT_OF_DATE = 'Tu catálogo en Telegram está desactualizado'

const PENDING_NOTE = 'incluye costo pendiente'

/** Faltante de stock, then Promoción and Consumo propio, each on its own line and only
 * when the period has one (`null` otherwise), right before Gastos. */
const COST_LINES: Array<{ key: 'shortfall' | 'promotion' | 'own_use'; label: string }> = [
  { key: 'shortfall', label: 'Faltante de stock' },
  { key: 'promotion', label: 'Promoción' },
  { key: 'own_use', label: 'Consumo propio' },
]

const TAB_LABEL: Record<PanelTab, string> = { today: 'Hoy', week: 'Semana', month: 'Mes' }
const TABS: PanelTab[] = ['today', 'week', 'month']
const SALES_HEADING: Record<PanelTab, string> = {
  today: 'Vendiste hoy',
  week: 'Vendiste esta semana',
  month: 'Vendiste este mes',
}

interface VarietySummary {
  current_price: unknown
}

interface PinnedCatalogStatus {
  status: { state: 'up_to_date' | 'out_of_date' } | null
}

function rangeLabel(tab: PanelTab, period: PanelPeriod): string {
  if (tab === 'today') return `Hoy ${formatDateShort(period.start)}`
  return `${formatDateShort(period.start)} – ${formatDateShort(period.end)}`
}

function salesSubtitle(period: PanelPeriod): string {
  const count = salesCount(period.sales_count)
  const grams = formatGrams(period.grams_sold)
  return period.average_sale === null
    ? `${count} · ${grams}`
    : `${count} · promedio ${formatMoney(period.average_sale)} · ${grams}`
}

export default function Inicio() {
  const me = useOutletContext<Me>()
  const [tab, setTab] = useState<PanelTab>('today')

  const varietiesQuery = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<VarietySummary[]>('/varieties'),
  })
  const hasPricedVariety = (varietiesQuery.data ?? []).some(
    (variety) => variety.current_price !== null,
  )

  const panelQuery = useQuery({
    queryKey: keys.panel(),
    queryFn: getPanel,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const pinnedCatalog = useQuery({
    queryKey: keys.pinnedCatalogStatus(),
    queryFn: () => get<PinnedCatalogStatus>('/pinned-catalog/status'),
  })
  const pinOutOfDate = pinnedCatalog.data?.status?.state === 'out_of_date'

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="inicio__cabecera">
          <div className="inicio__cabecera-titulos">
            <span className="encabezado__negocio">{me.business_name}</span>
            <span className="encabezado__titulo">Inicio</span>
          </div>
          <Link
            to="/settings"
            state={{ inApp: true }}
            aria-label={`Configuración de ${me.business_name}`}
            className="inicio__avatar"
          >
            {initialsOf(me.business_name)}
          </Link>
        </div>

        {pinOutOfDate && (
          <Link to={CATALOG} className="aviso-ambar" role="status">
            <span className="aviso-ambar__titulo">{PINNED_CATALOG_OUT_OF_DATE}</span>
          </Link>
        )}
        {varietiesQuery.data !== undefined && !hasPricedVariety && (
          <div className="estado-vacio">
            <span className="estado-vacio__titulo">{EMPTY_TITLE}</span>
            <span className="estado-vacio__detalle">{EMPTY_DETAIL}</span>
          </div>
        )}

        {panelQuery.isError && panelQuery.error instanceof NetworkError && <SinConexion />}
        {panelQuery.isError && !(panelQuery.error instanceof NetworkError) && <ErrorGenerico />}

        {panelQuery.data !== undefined && (
          <Panel panel={panelQuery.data} tab={tab} onTab={setTab} today={me.today} />
        )}
      </div>
    </main>
  )
}

function Panel({
  panel,
  tab,
  onTab,
  today,
}: {
  panel: PanelAnswer
  tab: PanelTab
  onTab: (tab: PanelTab) => void
  today: string
}) {
  const period = panel.periods[tab]
  const { debts, stock } = panel

  return (
    <>
      <div className="periodos" role="group" aria-label="Período">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? 'periodos__boton periodos__boton--activo' : 'periodos__boton'}
            aria-pressed={tab === item}
            onClick={() => onTab(item)}
          >
            {TAB_LABEL[item]}
          </button>
        ))}
        <span className="pie">{rangeLabel(tab, period)}</span>
      </div>

      <div className="panel-ventas">
        <span className="rotulo">{SALES_HEADING[tab]}</span>
        <span className="cifra-xl">{formatMoney(period.sales)}</span>
        <span className="pie">{salesSubtitle(period)}</span>
      </div>

      <div className="panel-resultados">
        <div className="panel-resultados__celda">
          <span className="rotulo">Ganancia</span>
          <span className="panel-resultados__valor panel-resultados__valor--acento">
            {formatSignedMoney(period.profit)}
          </span>
          {period.profit_pending && <span className="pie">{PENDING_NOTE}</span>}
        </div>
        <div className="panel-resultados__celda">
          <span className="rotulo">Caja</span>
          <span className="panel-resultados__valor">{formatSignedMoney(period.cash)}</span>
        </div>
      </div>

      <div className="panel-lista">
        <div className="panel-lista__fila">
          <span>Costo de lo vendido</span>
          <span className="panel-lista__valor">{formatMoney(period.cost_of_goods)}</span>
        </div>
        {period.pending_cost && <span className="pie">{PENDING_NOTE}</span>}
        {COST_LINES.map(({ key, label }) => {
          // Hoy never shows the withdrawal lines, even when the API answers one for
          // today (results.md): they belong to Semana and Mes.
          if (tab === 'today' && key !== 'shortfall') return null
          const line = period[key]
          if (line === null) return null
          return (
            <Fragment key={key}>
              <div className="panel-lista__fila">
                <span>{label}</span>
                <span className="panel-lista__valor">{formatMoney(line.amount)}</span>
              </div>
              {line.pending && <span className="pie">{PENDING_NOTE}</span>}
            </Fragment>
          )
        })}
        <div className="panel-lista__fila">
          <span>Gastos</span>
          <span className="panel-lista__valor">{formatMoney(period.expenses)}</span>
        </div>
        <div className="panel-lista__fila">
          <span>Regalaste</span>
          <span className="panel-lista__valor">{formatGrams(period.grams_gifted)}</span>
        </div>
        <div className="panel-lista__fila">
          <span>Compras de flores</span>
          <span className="panel-lista__valor">{formatMoney(period.purchases)}</span>
        </div>
      </div>

      {/* Both columns full-width on the phone; side by side on a computer
          (`InicioCompu.dc.html`): CSS alone switches between them, the same way
          `Shell`'s own bar/rail does. */}
      <div className="panel-dos-columnas">
        <TeDebenBlock debts={debts} />

        <div>
          <span className="rotulo">Lo que te queda</span>
          <div className="lista-stock">
            {stock.map((variety) => (
              <div key={variety.variety_id} className="fila-stock">
                <MarcaEstado estado={variety.status} />
                <span className="fila-stock__texto">
                  <span className="fila-stock__nombre">{variety.name}</span>
                  <span className="fila-stock__detalle">{detailFor(variety, today)}</span>
                </span>
                <span className="fila-stock__cifras">
                  <span className="fila-stock__gramos">
                    {variety.status === 'no_entries' ? '—' : formatGrams(variety.grams)}
                  </span>
                  {sideNoteFor(variety) !== null && (
                    <span className="fila-stock__insignia">{sideNoteFor(variety)}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function TeDebenBlock({ debts }: { debts: PanelDebts }) {
  // `oldest` is a date-or-null, never an amount (review finding: deciding this from
  // `total_owed === 0` compared an API amount inside a screen, which the plan
  // invariant forbids) — the contract sets it to `null` exactly when nobody owes.
  if (debts.oldest === null) {
    return (
      <div className="bloque-deben">
        <span className="rotulo">Te deben</span>
        <span className="pie">Nadie te debe</span>
      </div>
    )
  }

  return (
    <div className="bloque-deben">
      <Link to="/clientes/deben" className="bloque-deben__titulo">
        Te deben
      </Link>
      <span className="cifra-xl">{formatMoney(debts.total_owed)}</span>
      <span className="pie">
        {salesCount(debts.sales_owing_count)}
        {debts.oldest !== null && ` · desde ${formatDateShort(debts.oldest)}`}
      </span>
      {debts.teaser.map((row) => (
        <Link key={row.customer_id} to={`/clientes/${row.customer_id}`} className="bloque-deben__fila">
          <span>{row.name}</span>
          <span>{formatMoney(row.balance)}</span>
          <span className="pie">{`desde ${formatDateShort(row.owing_since)}`}</span>
        </Link>
      ))}
    </div>
  )
}
