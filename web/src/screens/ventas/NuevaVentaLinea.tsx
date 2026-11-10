/**
 * One line of Nueva venta's sale (`NuevaVenta.tsx` owns the state, the pricing and
 * the focus logic): the design's closed row (name, grams as a large figure, price
 * per gram, `ReglaInsignia` and the line total — or, with a message and no valid
 * preview, an incomplete row with that message and never figures) and the open
 * editing row (variety, grams, Regalo, Precio especial, the line's message or its
 * price per gram, rule and total, and "Quitar"). It only renders what it is given.
 */

import type { FocusEvent, KeyboardEvent, RefObject } from 'react'
import Boton from '../../components/Boton'
import Loading from '../../components/Loading'
import OpcionInterruptor from '../../components/OpcionInterruptor'
import ReglaInsignia from '../../components/ReglaInsignia'
import Selector from '../../components/Selector'
import { formatGrams } from '../../format/money'
import { useMoney } from '../../format/moneyContext'
import { type priceLine, fromHundredths } from '../../sales/pricing'
import { GRAMS_HELP, SALES_TEXT } from '../../copy/sales'
import { useViewport } from '../../shell/useViewport'
import type { Variety } from '../Variedades'
import { COMMON_TEXT } from '../../copy/common'
import { useTranslation } from 'react-i18next'

export interface LineState {
  key: string
  varietyId: string
  /** The picked Product's name, kept with `varietyId` so a Product no longer offered keeps its name. */
  varietyName: string
  grams: string
  gift: boolean
  specialPrice: string
}

export interface LinePreview {
  rule: ReturnType<typeof priceLine>['rule']
  pricePerGram: number
  lineTotal: number
  gramsHundredths: number
}

/** `scrollIntoView` doesn't exist in the jsdom the component's own tests render
 * under; guarded so an open field's focus handler is a no-op there instead of a
 * thrown error, and still scrolls a real phone's viewport into place (plan,
 * "Phone layout": "Open fields call `scrollIntoView({block: 'nearest'})` on
 * focus"). */
function scrollFieldIntoView(element: HTMLElement): void {
  if (typeof element.scrollIntoView === 'function') element.scrollIntoView({ block: 'nearest' })
}

/** The keyboard's action key ("next" / "done") does what its label says. Enter inside a
 * form would otherwise submit the sale from a half-typed line. */
function onEnter(event: KeyboardEvent<HTMLInputElement>, action: () => void): void {
  if (event.key !== 'Enter') return
  event.preventDefault()
  action()
}

interface NuevaVentaLineaProps {
  /** The line's 1-based position, for its accessible names. */
  n: number
  line: LineState
  isOpen: boolean
  preview: LinePreview | null
  /** `combinedLineError`'s one message for this line, or null. */
  error: string | null
  /** A date change is fetching that day's prices: the line's price per gram, rule and total
   * show a compact loading mark, never a figure of the day before. */
  figuresLoading: boolean
  /** The line's variety, if the fetched prices carry it. */
  variety: Variety | undefined
  varieties: Variety[]
  /** The Products have not loaded successfully: the Product field waits, never reads as empty. */
  varietiesLoading: boolean
  /** "Quitar" is only offered when the sale has more than one line. */
  canRemove: boolean
  varietyRef: RefObject<HTMLButtonElement | null>
  /** Where the phone's Product list is drawn, outside the form it covers. */
  listHost: HTMLElement | null
  gramsRef: RefObject<HTMLInputElement | null>
  specialPriceRef: RefObject<HTMLInputElement | null>
  onOpen: () => void
  onChange: (patch: Partial<LineState>) => void
  onRemove: () => void
}

export default function NuevaVentaLinea({
  n,
  line,
  isOpen,
  preview,
  error,
  figuresLoading,
  variety,
  varieties,
  varietiesLoading,
  canRemove,
  varietyRef,
  listHost,
  gramsRef,
  specialPriceRef,
  onOpen,
  onChange,
  onRemove,
}: NuevaVentaLineaProps) {
  const money = useMoney()
  // A browser without `matchMedia` (jsdom) is the phone, the layout this component's own
  // changes are for.
  const isComputer = useViewport() === 'computer'
  const { t } = useTranslation()
  const gone = line.varietyId !== '' && variety === undefined
  // Focus bubbles out of the Selector's list (a portal) too: only the field itself scrolls the form.
  function onVarietyFocus(event: FocusEvent<HTMLElement>): void {
    if (event.target === varietyRef.current) scrollFieldIntoView(event.target)
  }
  if (!isOpen) {
    const displayName = variety?.name ?? (line.varietyName || SALES_TEXT.noVariety)
    const messageId = `linea-mensaje-${line.key}`
    return (
      <Boton
        variant="row"
        ariaLabel={SALES_TEXT.lineLabel(n, displayName)}
        ariaDescribedBy={error !== null ? messageId : undefined}
        onClick={onOpen}
      >
        <div className="nueva-venta__linea-encabezado">
          <span className="nueva-venta__linea-nombre">{displayName}</span>
          {preview !== null && (
            <span className="nueva-venta__linea-gramos">
              {SALES_TEXT.withUnit(formatGrams(fromHundredths(preview.gramsHundredths)))}
            </span>
          )}
        </div>
        {figuresLoading ? (
          <div className="nueva-venta__linea-detalle">
            <Loading compacto />
          </div>
        ) : (
          preview !== null && (
            <div className="nueva-venta__linea-detalle">
              {preview.rule !== 'gift' && (
                <span className="nueva-venta__linea-preciogramo cifra-n">{money.money(preview.pricePerGram)}{COMMON_TEXT.perGram}</span>
              )}
              <ReglaInsignia rule={preview.rule} />
              <span className="nueva-venta__linea-total cifra-s">{money.money(preview.lineTotal)}</span>
            </div>
          )
        )}
        {error !== null && (
          <span id={messageId} className="campo__error" role="alert">
            {error}
          </span>
        )}
      </Boton>
    )
  }

  return (
    <div className="nueva-venta__linea nueva-venta__linea--abierta">
      <div className="campo" onFocus={onVarietyFocus}>
        <Selector
          required
          label={COMMON_TEXT.variety}
          accessibleName={SALES_TEXT.lineVariety(n)}
          placeholder={COMMON_TEXT.pickAVariety}
          options={varieties.map((item) => ({ value: String(item.id), label: item.name }))}
          value={line.varietyId === '' ? null : line.varietyId}
          selected={gone ? { value: line.varietyId, label: line.varietyName } : undefined}
          loading={varietiesLoading}
          emptySetMessage={t('emptyStates:selectorNoVarieties')}
          fieldRef={varietyRef}
          listHost={listHost}
          onChange={(picked) => {
            const name = varieties.find((item) => String(item.id) === picked)?.name ?? ''
            onChange({ varietyId: picked ?? '', varietyName: name })
          }}
        />
      </div>
      <label className="campo">
        <span className="campo__rotulo">{COMMON_TEXT.grams}</span>
        <input
          className="campo__input"
          aria-label={SALES_TEXT.lineGrams(n)}
          type="text"
          inputMode="decimal"
          enterKeyHint="next"
          value={line.grams}
          ref={gramsRef}
          onKeyDown={(event) => onEnter(event, () => {
              const next = specialPriceRef.current
              if (next !== null && !next.disabled) next.focus()
              else event.currentTarget.blur()
            })}
          onFocus={(event) => scrollFieldIntoView(event.currentTarget)}
          onChange={(event) => onChange({ grams: event.target.value })}
        />
        <span className="campo__ayuda" data-copy="help">
          {GRAMS_HELP}
        </span>
      </label>
      <div className="nueva-venta__linea-opciones">
        {isComputer ? (
          <label>
            <input
              type="checkbox"
              aria-label={SALES_TEXT.lineGift(n)}
              checked={line.gift}
              disabled={line.specialPrice.trim() !== ''}
              onFocus={(event) => scrollFieldIntoView(event.currentTarget)}
              onChange={(event) => onChange({ gift: event.target.checked })}
            />
            {SALES_TEXT.gift}
          </label>
        ) : (
          <OpcionInterruptor
            label={SALES_TEXT.gift}
            ariaLabel={SALES_TEXT.lineGift(n)}
            checked={line.gift}
            disabled={line.specialPrice.trim() !== ''}
            onChange={(gift) => onChange({ gift })}
          />
        )}
        <input
          className="campo__input"
          aria-label={SALES_TEXT.lineSpecialPrice(n)}
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          placeholder={SALES_TEXT.specialPrice}
          value={line.specialPrice}
          disabled={line.gift}
          ref={specialPriceRef}
          onKeyDown={(event) => onEnter(event, () => specialPriceRef.current?.blur())}
          onFocus={(event) => scrollFieldIntoView(event.currentTarget)}
          onChange={(event) => onChange({ specialPrice: event.target.value })}
        />
      </div>
      {error !== null && (
        <span className="campo__error" role="alert">
          {error}
        </span>
      )}
      {error === null && figuresLoading && (
        <div className="nueva-venta__linea-detalle">
          <Loading compacto />
        </div>
      )}
      {error === null && !figuresLoading && preview !== null && (
        <div className="nueva-venta__linea-detalle">
          {preview.rule !== 'gift' && (
            <span className="nueva-venta__linea-preciogramo cifra-n">{money.money(preview.pricePerGram)}{COMMON_TEXT.perGram}</span>
          )}
          <ReglaInsignia rule={preview.rule} />
          <span className="nueva-venta__linea-total cifra-s">{money.money(preview.lineTotal)}</span>
        </div>
      )}
      {canRemove && (
        <Boton variant="icon" action="delete" ariaLabel={SALES_TEXT.removeLine(n)} onClick={onRemove} />
      )}
    </div>
  )
}
