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
 * Hoy is for acting (`results.md`): sold today, Te deben with a "Cobrar" per debtor
 * (`components/Cobro`, handed only the customer id) and Lo que te queda. Semana and
 * Mes carry the period's results. The checklist, the bot notice and "Arrancá por las
 * variedades" are decided on the server (`panel.setup`, plan invariants 4 and 7): this
 * screen renders them as given and never filters or reorders steps. After a payment
 * or a dismissal it only invalidates `keys.panel()` and renders what the server
 * answers next — never `setQueryData`, never removing a debtor, step or notice from
 * its own cache (plan invariant 10).
 *
 * "Arrancá por las variedades" sits above the panel instead of replacing it (PM,
 * adjustment 5): a business can have history and no price today, and its figures
 * are real. It shows only once the checklist is gone and `setup.priced_today` is false.
 *
 * The pinned-catalog notice (plan, "Front"; accounts.md's Inicio rule): a fixed
 * line, never a figure, while `GET /pinned-catalog/status` reads `out_of_date` —
 * before the first Publicar `status` is `null` and nothing shows (PRD, "Before the
 * first Publicar").
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router'
import { get, NetworkError } from '../api/client'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import {
  getPanel,
  type PanelAnswer,
  type PanelDebts,
  type PanelPeriod,
  type PanelToday,
  type PanelVarietyOut,
  type PanelTab,
} from '../api/panel'
import BotNotice from '../components/BotNotice'
import Boton from '../components/Boton'
import Cobro from '../components/Cobro'
import ErrorGenerico from '../components/ErrorGenerico'
import Icono from '../components/Icono'
import MarcaEstado from '../components/MarcaEstado'
import SetupChecklist from '../components/SetupChecklist'
import SinConexion from '../components/SinConexion'
import type { RecordedPayment } from '../api/payments'
import { salesCount } from '../format/counts'
import { formatDateShort } from '../format/dates'
import { formatGrams, formatMoney, formatSignedMoney } from '../format/money'
import { detailFor, sideNoteFor } from '../stock/detail'

export const EMPTY_TITLE = 'Arrancá por las variedades'
export const EMPTY_DETAIL =
  'Cargá tu primera variedad con su precio. Sin precio no se puede cargar una venta.'
export const PINNED_CATALOG_OUT_OF_DATE = 'Tu catálogo en Telegram está desactualizado'

const PENDING_NOTE = 'incluye costo pendiente'

const TAB_LABEL: Record<PanelTab, string> = { today: 'Hoy', week: 'Semana', month: 'Mes' }
const TABS: PanelTab[] = ['today', 'week', 'month']
const SALES_HEADING: Record<PanelTab, string> = {
  today: 'Vendiste hoy',
  week: 'Vendiste esta semana',
  month: 'Vendiste este mes',
}

interface PinnedCatalogStatus {
  status: { state: 'up_to_date' | 'out_of_date' } | null
}

function rangeLabel(tab: PanelTab, period: { start: string; end: string }): string {
  if (tab === 'today') return `Hoy ${formatDateShort(period.start)}`
  return `${formatDateShort(period.start)} – ${formatDateShort(period.end)}`
}

function salesSubtitle(period: PanelPeriod | PanelToday): string {
  const count = salesCount(period.sales_count)
  const grams = formatGrams(period.grams_sold)
  return !('average_sale' in period) || period.average_sale === null
    ? `${count} · ${grams}`
    : `${count} · promedio ${formatMoney(period.average_sale)} · ${grams}`
}

export default function Inicio() {
  const me = useOutletContext<Me>()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<PanelTab>('today')
  const [cobrandoId, setCobrandoId] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)

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

  function refetchPanel(): void {
    void queryClient.invalidateQueries({ queryKey: keys.panel() })
  }

  function onCobroSaved(recorded: RecordedPayment): void {
    setCobrandoId(null)
    setSavedNotice(
      recorded.after.standing === 'owes'
        ? `Cobro guardado · queda debiendo ${formatMoney(recorded.after.balance)}`
        : 'Cobro guardado',
    )
    refetchPanel()
  }

  const setup = panelQuery.data?.setup
  const onToday = tab === 'today'

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="encabezado-fila">
          <span className="encabezado-fila__texto">
            <span className="encabezado__negocio">{me.business_name}</span>
            <span className="encabezado__titulo">Inicio</span>
          </span>
          <Link to="/negocio" className="avatar" aria-label="Configuración">
            {initialOf(me.business_name)}
          </Link>
        </div>

        {onToday && setup !== undefined && (
          <>
            {setup.checklist !== null ? (
              <SetupChecklist steps={setup.checklist.steps} />
            ) : (
              !setup.priced_today && (
                <div className="estado-vacio">
                  <span className="estado-vacio__titulo">{EMPTY_TITLE}</span>
                  <span className="estado-vacio__detalle">{EMPTY_DETAIL}</span>
                </div>
              )
            )}
            {setup.bot_notice && <BotNotice onDismissed={refetchPanel} />}
          </>
        )}
        {onToday && pinOutOfDate && (
          <Link to="/catalogo" className="aviso-ambar" role="status">
            <span className="aviso-ambar__titulo">{PINNED_CATALOG_OUT_OF_DATE}</span>
          </Link>
        )}

        {savedNotice !== null && (
          <div className="toast" role="status">
            <span className="toast__texto">{savedNotice}</span>
          </div>
        )}

        {panelQuery.isError && panelQuery.error instanceof NetworkError && <SinConexion />}
        {panelQuery.isError && !(panelQuery.error instanceof NetworkError) && <ErrorGenerico />}

        {panelQuery.data !== undefined && (
          <Panel
            panel={panelQuery.data}
            tab={tab}
            onTab={setTab}
            today={me.today}
            onCobrar={(customerId) => {
              setSavedNotice(null)
              setCobrandoId(customerId)
            }}
          />
        )}
      </div>

      {cobrandoId !== null && (
        <Cobro
          customerId={cobrandoId}
          today={me.today}
          onClose={() => setCobrandoId(null)}
          onSaved={onCobroSaved}
          onGone={() => {
            setCobrandoId(null)
            refetchPanel()
          }}
        />
      )}
    </main>
  )
}

/** The first character of the business's name, upper-cased; a non-letter shows as it is. */
function initialOf(name: string): string {
  const [first] = Array.from(name)
  return first === undefined ? '' : first.toLocaleUpperCase('es')
}

function Panel({
  panel,
  tab,
  onTab,
  today,
  onCobrar,
}: {
  panel: PanelAnswer
  tab: PanelTab
  onTab: (tab: PanelTab) => void
  today: string
  onCobrar: (customerId: string) => void
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

      {'profit' in period && <PeriodResults period={period} />}

      {tab === 'today' && (
        /* Both columns full-width on the phone; side by side on a computer
           (`InicioCompu.dc.html`): CSS alone switches between them, the same way
           `Shell`'s own bar/rail does. */
        <div className="panel-dos-columnas">
          <TeDebenBlock debts={debts} onCobrar={onCobrar} />
          <StockBlock stock={stock} today={today} />
        </div>
      )}
    </>
  )
}

function StockBlock({ stock, today }: { stock: PanelVarietyOut[]; today: string }) {
  return (
    <div>
      <span className="rotulo">Lo que te queda</span>
      <div className="lista-stock">
        {stock.map((variety) => {
          const row = (
            <>
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
            </>
          )
          // Only a low or sold-out variety has something to open: its detail. The
          // chevron says so by shape, never by color alone.
          return variety.status === 'low' || variety.status === 'sold_out' ? (
            <Link
              key={variety.variety_id}
              to={`/variedades/${variety.variety_id}`}
              className="fila-stock fila-stock--enlace"
            >
              {row}
              <Icono nombre="chevron" size={18} />
            </Link>
          ) : (
            <div key={variety.variety_id} className="fila-stock">
              {row}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PeriodResults({ period }: { period: PanelPeriod }) {
  return (
    <>
      <div className="panel-resultados">
        <div className="panel-resultados__celda">
          <span className="rotulo">Ganancia</span>
          <span className="panel-resultados__valor panel-resultados__valor--acento">
            {formatSignedMoney(period.profit)}
          </span>
          {period.pending_cost && <span className="pie">{PENDING_NOTE}</span>}
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
    </>
  )
}

function TeDebenBlock({
  debts,
  onCobrar,
}: {
  debts: PanelDebts
  onCobrar: (customerId: string) => void
}) {
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
        <div key={row.customer_id} className="bloque-deben__fila">
          <Link to={`/clientes/${row.customer_id}`} className="bloque-deben__enlace">
            <span>{row.name}</span>
            <span>{formatMoney(row.balance)}</span>
            <span className="pie">{`desde ${formatDateShort(row.owing_since)}`}</span>
          </Link>
          <Boton
            variant="secondary"
            ariaLabel={`Cobrar a ${row.name}`}
            onClick={() => onCobrar(String(row.customer_id))}
          >
            Cobrar
          </Boton>
        </div>
      ))}
    </div>
  )
}
