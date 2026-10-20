/**
 * The panel's body (`docs/product/results.md`, "What each tab shows"): the Hoy · Semana ·
 * Mes switch and what each tab draws, each figure straight from `GET /panel`
 * (`PanelAnswer`). Nothing here computes, sorts or sign-tests an amount: ranges go through
 * `formatDateShort` only, Ganancia and Caja through `formatSignedMoney`.
 *
 * Hoy is only what can be acted on, top to bottom: sold today, the Te deben block, Lo que
 * te queda. The result figures (Ganancia, Caja, Costo de lo vendido, Faltante de stock,
 * Promoción, Consumo propio, Gastos, Regalaste, Compras de flores) belong to Semana and
 * Mes, which draw them above the same Te deben block and Lo que te queda.
 *
 * A low variety in Lo que te queda is a link to its page (`InAppLink`, so back returns
 * here); every other row is plain text. Te deben's "Cobrar a <name>" opens Registrar cobro
 * for that customer, and the block refreshes because `Inicio` re-fetches `/panel` on every
 * mount.
 */

import { CUSTOMER, CUSTOMER_PAYMENT, CUSTOMERS, VARIETY, pathTo } from '../../routes'
import InAppLink from '../../components/InAppLink'
import BotonLink from '../../components/BotonLink'
import MarcaEstado from '../../components/MarcaEstado'
import type {
  PanelAnswer,
  PanelDebts,
  PanelPeriod,
  PanelTab,
  PanelVarietyOut,
} from '../../api/panel'
import { salesCount } from '../../format/counts'
import { formatDateShort } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'
import { detailFor, sideNoteFor } from '../../stock/detail'
import { NOBODY_OWES } from '../inicioMessages'
import PeriodPanel from './PeriodFigures'

const TAB_LABEL: Record<PanelTab, string> = { today: 'Hoy', week: 'Semana', month: 'Mes' }
const TABS: PanelTab[] = ['today', 'week', 'month']
function rangeLabel(tab: PanelTab, period: PanelPeriod): string {
  if (tab === 'today') return `Hoy ${formatDateShort(period.start)}`
  return `${formatDateShort(period.start)} – ${formatDateShort(period.end)}`
}

export default function InicioPanel({
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

      <PeriodPanel tab={tab} period={period} />

      {/* Both columns full-width on the phone; side by side on a computer
          (`InicioCompu.dc.html`): CSS alone switches between them, the same way
          `Shell`'s own bar/rail does. */}
      <div className="panel-dos-columnas">
        <TeDebenBlock debts={debts} />

        <div>
          <span className="rotulo">Lo que te queda</span>
          <div className="lista-stock">
            {stock.map((variety) => (
              <StockRow key={variety.variety_id} variety={variety} today={today} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

/** One variety of Lo que te queda. A low one is a link to its page, not an action. */
function StockRow({ variety, today }: { variety: PanelVarietyOut; today: string }) {
  const content = (
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
  if (variety.status !== 'low') return <div className="fila-stock">{content}</div>
  return (
    <InAppLink to={pathTo(VARIETY, { id: variety.variety_id })} className="fila-stock fila-stock--enlace">
      {content}
    </InAppLink>
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
        <span className="pie">{NOBODY_OWES}</span>
      </div>
    )
  }

  return (
    <div className="bloque-deben">
      <InAppLink to={CUSTOMERS} className="bloque-deben__titulo">
        Te deben
      </InAppLink>
      <span className="cifra-xl">{formatMoney(debts.total_owed)}</span>
      <span className="pie">
        {salesCount(debts.sales_owing_count)}
        {` · desde ${formatDateShort(debts.oldest)}`}
      </span>
      {debts.teaser.map((row) => (
        <div key={row.customer_id} className="bloque-deben__fila">
          <InAppLink to={pathTo(CUSTOMER, { id: row.customer_id })} className="bloque-deben__datos">
            <span>{row.name}</span>
            <span>{formatMoney(row.balance)}</span>
            <span className="pie">{`desde ${formatDateShort(row.owing_since)}`}</span>
          </InAppLink>
          <BotonLink
            icon="cobro"
            to={pathTo(CUSTOMER_PAYMENT, { id: row.customer_id })}
            ariaLabel={`Cobrar a ${row.name}`}
          >
            Cobrar
          </BotonLink>
        </div>
      ))}
    </div>
  )
}
