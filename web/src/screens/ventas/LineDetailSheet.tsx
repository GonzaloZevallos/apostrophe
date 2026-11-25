/**
 * `LineDetailSheet`: the detail of one line of the sale in progress, drawn inside the shared `Sheet`
 * (`docs/product/sale-in-progress.md`, "Detalle de línea"). It takes its line, title, Money format and
 * callbacks as props and is mounted by whoever opens it: it reads no draft, no Sheet stack and no router,
 * adds no Escape listener and does no money arithmetic.
 *
 * - The buffer starts from the line once, on mount. Every write goes through `lineBufferWith`, every
 *   refusal comes from `lineEditOf`, and the Sheet is touched while `lineEditChanged` says the buffer
 *   differs from the line.
 * - Done hands the confirmed edit (`null` when nothing changed) and Remove line hands nothing; whichever
 *   comes first settles the Sheet, so a second tap fires nothing.
 */

import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Boton from '../../components/Boton'
import FieldRefusal from '../../components/FieldRefusal'
import MoneyInput from '../../components/MoneyInput'
import OpcionInterruptor from '../../components/OpcionInterruptor'
import Sheet, { SheetActions } from '../../components/Sheet'
import { SALES_TEXT } from '../../copy/sales'
import type { MoneyFormat } from '../../format/money'
import { useMoney } from '../../format/moneyContext'
import {
  type DraftLine,
  type LineBuffer,
  type LineEdit,
  lineBufferOf,
  lineBufferWith,
  lineEditChanged,
  lineEditOf,
} from '../../sales/saleDraft'

export interface LineDetailSheetProps {
  line: DraftLine
  /** The Product's name, or the shared "no longer available" text. */
  title: string
  format: MoneyFormat
  /** The confirmed edit, or `null` when the buffer equals the line. At most once per mount. */
  onDone: (edit: LineEdit | null) => void
  /** At most once per mount. */
  onRemove: () => void
  onClose: () => void
  /** The Sheet frame, passed straight to `Sheet`. */
  computer: boolean
  computerClass: string
  computerDialog: boolean
}

export default function LineDetailSheet({
  line,
  title,
  format,
  onDone,
  onRemove,
  onClose,
  computer,
  computerClass,
  computerDialog,
}: LineDetailSheetProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const titleId = useId()
  const quantityId = useId()
  const specialId = useId()
  const refusalId = useId()
  const [buffer, setBuffer] = useState<LineBuffer>(() => lineBufferOf(line, format))
  const settled = useRef(false)
  const result = lineEditOf(buffer, format)
  const refusalText = result.ok
    ? null
    : result.refusal === 'quantity'
      ? SALES_TEXT.lineQuantityInvalid
      : result.refusal === 'specialZero'
        ? SALES_TEXT.specialPriceAboveZero(money.attached(0))
        : null
  const quantityRefused = !result.ok && result.refusal === 'quantity'
  const specialRefused = !result.ok && result.refusal === 'specialZero'

  function settle(act: () => void): void {
    if (settled.current) return
    settled.current = true
    act()
  }

  function done(): void {
    if (!result.ok) return
    const { edit } = result
    settle(() => onDone(lineEditChanged(line, buffer, format) ? edit : null))
  }

  return (
    <Sheet
      computer={computer}
      computerClass={computerClass}
      computerDialog={computerDialog}
      titleId={titleId}
      touched={lineEditChanged(line, buffer, format)}
      onClose={onClose}
    >
      <div className="encabezado-fila">
        <span id={titleId} className="panel__titulo">
          {title}
        </span>
        <Boton variant="icon" action="close" ariaLabel={t('common:close')} onClick={onClose} />
      </div>
      <div className="campo">
        <label htmlFor={quantityId} className="campo__rotulo">
          {SALES_TEXT.lineQuantityLabel}
        </label>
        <input
          id={quantityId}
          className="campo__input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={quantityRefused ? true : undefined}
          aria-describedby={quantityRefused ? refusalId : undefined}
          value={buffer.quantityText}
          onChange={(event) => setBuffer(lineBufferWith(buffer, { quantityText: event.target.value }))}
        />
        {quantityRefused && refusalText !== null && <FieldRefusal id={refusalId}>{refusalText}</FieldRefusal>}
      </div>
      <OpcionInterruptor
        label={SALES_TEXT.gift}
        checked={buffer.gift}
        disabled={buffer.specialText.trim() !== ''}
        onChange={(gift) => setBuffer(lineBufferWith(buffer, { gift }))}
      />
      <div className="campo">
        <label htmlFor={specialId} className="campo__rotulo">
          {SALES_TEXT.specialPrice}
        </label>
        <MoneyInput
          id={specialId}
          className="campo__input"
          type="text"
          autoComplete="off"
          aria-invalid={specialRefused ? true : undefined}
          aria-describedby={specialRefused ? refusalId : undefined}
          value={buffer.specialText}
          disabled={buffer.gift}
          onChange={(specialText) => setBuffer(lineBufferWith(buffer, { specialText }))}
        />
        {specialRefused && refusalText !== null && <FieldRefusal id={refusalId}>{refusalText}</FieldRefusal>}
      </div>
      <Boton variant="destructive" icon="tacho" onClick={() => settle(onRemove)}>
        {SALES_TEXT.removeLineButton}
      </Boton>
      <SheetActions>
        <Boton textOnly="submit" type="submit" disabled={!result.ok} onClick={done}>
          {SALES_TEXT.lineDetailDone}
        </Boton>
      </SheetActions>
    </Sheet>
  )
}
