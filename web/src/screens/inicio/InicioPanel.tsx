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

import { CUSTOMER, CUSTOMERS, VARIETY, paymentLink, pathTo } from '../../routes'
import { OWED_PLACE } from '../../components/useReturnToPlace'
import InAppLink from '../../components/InAppLink'
import BotonLink from '../../components/BotonLink'
import MarcaEstado from '../../components/MarcaEstado'
import Pestanas from '../../components/Pestanas'
import type {
  PanelAnswer,
  PanelDebts,
  PanelPeriod,
  PanelTab,
  PanelVarietyOut,
} from '../../api/panel'
import { salesOwingCount } from '../../format/counts'
import { formatDateShort } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'
import { detailFor, sideNoteFor } from '../../stock/detail'
import { INICIO_TEXT } from '../../copy/inicio'
import { useTranslation } from 'react-i18next'
import { EMPTY_STATE_KEYS } from '../../copy/emptyStates'
import PeriodPanel from './PeriodFigures'
import { COMMON_TEXT } from '../../copy/common'

const TAB_LABEL: Record<PanelTab, string> = { today: COMMON_TEXT.today, week: COMMON_TEXT.week, month: COMMON_TEXT.month }
const TAB_ITEMS = (['today', 'week', 'month'] as const).map((value) => ({
  value,
  label: TAB_LABEL[value],
}))

function rangeLabel(tab: PanelTab, period: PanelPeriod): string {
  if (tab === 'today') return COMMON_TEXT.todayWith(formatDateShort(period.start))
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
      <div className="inicio__periodos">
        <Pestanas items={TAB_ITEMS} value={tab} onChange={onTab} ariaLabel={COMMON_TEXT.period} />
        <span className="pie">{rangeLabel(tab, period)}</span>
      </div>

      <PeriodPanel tab={tab} period={period} />

      {/* Both columns full-width on the phone; side by side on a computer
          (`InicioCompu.dc.html`): CSS alone switches between them, the same way
          `Shell`'s own bar/rail does. */}
      <div className="panel-dos-columnas">
        <TeDebenBlock debts={debts} />

        <div>
          <span className="rotulo">{INICIO_TEXT.loQueTeQueda}</span>
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
  const sideNote = sideNoteFor(variety)
  const content = (
    <>
      <span className="fila-stock__encabezado">
        <span className="fila-stock__nombre">{variety.name}</span>
        <span className="fila-stock__cifras">
          <span className="fila-stock__gramos">
            {variety.status === 'no_entries' ? '—' : formatGrams(variety.quantity)}
          </span>
          {sideNote !== null && <span className="fila-stock__insignia">{sideNote}</span>}
        </span>
      </span>
      <span className="fila-stock__pie">
        <MarcaEstado estado={variety.status} />
        <span className="fila-stock__detalle">{detailFor(variety, today)}</span>
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
  const { t } = useTranslation()
  // `oldest` is a date-or-null, never an amount (review finding: deciding this from
  // `total_owed === 0` compared an API amount inside a screen, which the plan
  // invariant forbids) — the contract sets it to `null` exactly when nobody owes.
  if (debts.oldest === null) {
    return (
      <div className="bloque-deben">
        <span className="rotulo">{COMMON_TEXT.owedToYou}</span>
        <span className="pie" tabIndex={-1} data-place={OWED_PLACE}>{t(EMPTY_STATE_KEYS.nobodyOwes)}</span>
      </div>
    )
  }

  return (
    <div className="bloque-deben">
      <InAppLink to={CUSTOMERS} className="bloque-deben__titulo" data-place={OWED_PLACE}>
        {COMMON_TEXT.owedToYou}
      </InAppLink>
      <span className="cifra-xl">{formatMoney(debts.total_owed)}</span>
      <span className="pie bloque-deben__cuenta">{salesOwingCount(debts.sales_owing_count)}</span>
      <span className="pie bloque-deben__desde">{INICIO_TEXT.desde0(formatDateShort(debts.oldest))}</span>
      {debts.teaser.map((row) => (
        <div key={row.customer_id} className="bloque-deben__fila">
          <InAppLink to={pathTo(CUSTOMER, { id: row.customer_id })} className="bloque-deben__datos">
            <span className="bloque-deben__nombre">{row.name}</span>
            <span className="pie">
              <span className="monto-deuda">{formatMoney(row.balance)}</span>
              {INICIO_TEXT.sinceDate(formatDateShort(row.owing_since))}
            </span>
          </InAppLink>
          <BotonLink
            icon="cobro"
            {...paymentLink(row.customer_id, 'home')}
            ariaLabel={COMMON_TEXT.collectFrom(row.name)}
          >
            {COMMON_TEXT.collect}
          </BotonLink>
        </div>
      ))}
    </div>
  )
}
