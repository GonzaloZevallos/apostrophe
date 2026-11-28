/**
 * `DateShippingNoteRow`: the Collect Sheet's one collapsed row for the date, the shipping and the
 * note (drawing `NuevaVentaCobrar`). Not routed: it is mounted only by `CollectSheet`.
 *
 * Collapsed, it shows its title and, joined with " · " and in this order, only what is not at its
 * default: the date as dd/mm when it is not the Business's today, "Shipping {amount}" when above 0,
 * "Note" when the Note is not blank (never its text). Expanded: the date, Shipping charged, Note.
 *
 * The date's `max` is `draft.today`, the very value `setDate` guards with; a refused value snaps
 * back because the input stays controlled and `dateSet` refuses it in the reducer. While
 * `datesAndShippingLocked` the date and the shipping are disabled and say why; the Note never is.
 * Nothing here adds or multiplies money: the shipping amount shown is the one `parseShipping` read.
 */

import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Boton from '../../components/Boton'
import MoneyInput from '../../components/MoneyInput'
import { SALES_TEXT } from '../../copy/sales'
import { formatDateShort } from '../../format/dates'
import { useMoney } from '../../format/moneyContext'
import { SALE_NOTE_MAX_LENGTH } from '../../sales/saleBody'
import { parseShipping } from '../../sales/shipping'
import type { SaleDraftApi } from '../../sales/useSaleDraft'

export interface DateShippingNoteRowProps {
  draft: SaleDraftApi
  /** True while the Sheet's price is fixed: the date and the shipping are shown, not editable. */
  datesAndShippingLocked: boolean
}

export default function DateShippingNoteRow({ draft, datesAndShippingLocked }: DateShippingNoteRowProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()
  const dateId = useId()
  const shippingId = useId()
  const noteId = useId()
  const lockedId = useId()
  const { state } = draft

  const shipping = parseShipping(state.shipping, money.format)
  const parts: string[] = []
  if (state.date !== draft.today) parts.push(formatDateShort(state.date))
  if (shipping !== null && shipping > 0) parts.push(SALES_TEXT.dateShippingNoteSummaryShipping(money.money(shipping)))
  if (state.note.trim() !== '') parts.push(SALES_TEXT.dateShippingNoteSummaryNote)
  const summary = parts.join(' · ')
  const lockedDescription = datesAndShippingLocked ? lockedId : undefined

  return (
    <div>
      <Boton variant="row" ariaExpanded={expanded} ariaControls={bodyId} onClick={() => setExpanded(!expanded)}>
        <span>{SALES_TEXT.dateShippingNoteTitle}</span>
        {summary !== '' && <span className="campo__ayuda">{summary}</span>}
      </Boton>
      {expanded && (
        <div id={bodyId} className="cobro__fila-extra-cuerpo">
          <div className="campo">
            <label htmlFor={dateId} className="campo__rotulo">
              {t('common:date')}
            </label>
            <input
              id={dateId}
              className="campo__input"
              type="date"
              required
              autoComplete="off"
              max={draft.today}
              value={state.date}
              disabled={datesAndShippingLocked}
              aria-describedby={lockedDescription}
              onChange={(event) => draft.setDate(event.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor={shippingId} className="campo__rotulo">
              {SALES_TEXT.shippingCharged}
            </label>
            <MoneyInput
              id={shippingId}
              className="campo__input"
              autoComplete="off"
              value={state.shipping}
              disabled={datesAndShippingLocked}
              aria-describedby={lockedDescription}
              onChange={draft.setShipping}
            />
          </div>
          {datesAndShippingLocked && (
            <span id={lockedId} className="campo__ayuda" data-copy="help">
              {SALES_TEXT.dateShippingLocked}
            </span>
          )}
          <div className="campo">
            <label htmlFor={noteId} className="campo__rotulo">
              {t('common:note')}
            </label>
            <input
              id={noteId}
              className="campo__input"
              type="text"
              autoComplete="off"
              maxLength={SALE_NOTE_MAX_LENGTH}
              value={state.note}
              onChange={(event) => draft.setNote(event.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
