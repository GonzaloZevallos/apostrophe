/**
 * One line of Nueva venta's sale (`NuevaVenta.tsx` owns the state, the pricing and
 * the focus logic): the design's closed row (name, grams as a large figure, price
 * per gram, `ReglaInsignia` and the line total — or, with a message and no valid
 * preview, an incomplete row with that message and never figures) and the open
 * editing row (variety, grams, Gift, Special price, the line's message or its
 * price per gram, rule and total, and "Remove"). It only renders what it is given.
 */

import type { KeyboardEvent, RefObject } from 'react'
import Boton from '../../components/Boton'
import Loading from '../../components/Loading'
import OpcionInterruptor from '../../components/OpcionInterruptor'
import ReglaInsignia from '../../components/ReglaInsignia'
import { formatGrams, formatMoney } from '../../format/money'
import { type priceLine, fromHundredths } from '../../sales/pricing'
import {
  CHOOSE_VARIETY,
  GIFT,
  GRAMS,
  GRAMS_HELP,
  NO_VARIETY,
  SPECIAL_PRICE,
  VARIETY,
  giftOfLine,
  gramsOfLine,
  lineSummary,
  pricePerGram,
  removeLine,
  specialPriceOfLine,
  varietyOfLine,
} from '../../copy/sales'
import { useViewport } from '../../shell/useViewport'
import type { Variety } from '../Variedades'

export interface LineState {
  key: string
  varietyId: string
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
  /** "Remove" is only offered when the sale has more than one line. */
  canRemove: boolean
  varietyRef: RefObject<HTMLSelectElement | null>
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
  canRemove,
  varietyRef,
  gramsRef,
  specialPriceRef,
  onOpen,
  onChange,
  onRemove,
}: NuevaVentaLineaProps) {
  // A browser without `matchMedia` (jsdom) is the phone, the layout this component's own
  // changes are for.
  const isComputer = useViewport() === 'computer'
  if (!isOpen) {
    const displayName = variety?.name ?? NO_VARIETY
    const messageId = `linea-mensaje-${line.key}`
    return (
      <Boton
        variant="row"
        ariaLabel={lineSummary(n, displayName)}
        ariaDescribedBy={error !== null ? messageId : undefined}
        onClick={onOpen}
      >
        <div className="nueva-venta__linea-encabezado">
          <span className="nueva-venta__linea-nombre">{displayName}</span>
          {preview !== null && (
            <span className="nueva-venta__linea-gramos">
              {formatGrams(fromHundredths(preview.gramsHundredths))}
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
                <span className="nueva-venta__linea-preciogramo">{pricePerGram(formatMoney(preview.pricePerGram))}</span>
              )}
              <ReglaInsignia rule={preview.rule} />
              <span className="nueva-venta__linea-total">{formatMoney(preview.lineTotal)}</span>
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
      <label className="campo">
        <span className="campo__rotulo">{VARIETY}</span>
        <select
          className="campo__input"
          aria-label={varietyOfLine(n)}
          value={line.varietyId}
          ref={varietyRef}
          onFocus={(event) => scrollFieldIntoView(event.currentTarget)}
          onChange={(event) => onChange({ varietyId: event.target.value })}
        >
          <option value="">{CHOOSE_VARIETY}</option>
          {varieties.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        <span className="campo__rotulo">{GRAMS}</span>
        <input
          className="campo__input"
          aria-label={gramsOfLine(n)}
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
              aria-label={giftOfLine(n)}
              checked={line.gift}
              disabled={line.specialPrice.trim() !== ''}
              onFocus={(event) => scrollFieldIntoView(event.currentTarget)}
              onChange={(event) => onChange({ gift: event.target.checked })}
            />
            {GIFT}
          </label>
        ) : (
          <OpcionInterruptor
            label={GIFT}
            ariaLabel={giftOfLine(n)}
            checked={line.gift}
            disabled={line.specialPrice.trim() !== ''}
            onChange={(gift) => onChange({ gift })}
          />
        )}
        <input
          className="campo__input"
          aria-label={specialPriceOfLine(n)}
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          placeholder={SPECIAL_PRICE}
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
            <span className="nueva-venta__linea-preciogramo">{pricePerGram(formatMoney(preview.pricePerGram))}</span>
          )}
          <ReglaInsignia rule={preview.rule} />
          <span className="nueva-venta__linea-total">{formatMoney(preview.lineTotal)}</span>
        </div>
      )}
      {canRemove && (
        <Boton variant="icon" action="delete" ariaLabel={removeLine(n)} onClick={onRemove} />
      )}
    </div>
  )
}
