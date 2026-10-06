/**
 * One line of Nueva venta's sale (`NuevaVenta.tsx` owns the state, the pricing and
 * the focus logic): the design's closed row (name, grams as a large figure, price
 * per gram, `ReglaInsignia` and the line total — or, with a message and no valid
 * preview, an incomplete row with that message and never figures) and the open
 * editing row (variety, grams, Regalo, Precio especial, the line's message or its
 * price per gram, rule and total, and "Quitar"). It only renders what it is given.
 */

import type { KeyboardEvent, RefObject } from 'react'
import Boton from '../../components/Boton'
import OpcionInterruptor from '../../components/OpcionInterruptor'
import ReglaInsignia from '../../components/ReglaInsignia'
import { formatGrams, formatMoney } from '../../format/money'
import { type priceLine, fromHundredths } from '../../sales/pricing'
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
  /** The line's variety, if the fetched prices carry it. */
  variety: Variety | undefined
  varieties: Variety[]
  /** "Quitar" is only offered when the sale has more than one line. */
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
  if (!isOpen) {
    const displayName = variety?.name ?? 'Sin variedad'
    const messageId = `linea-mensaje-${line.key}`
    return (
      <Boton
        variant="row"
        ariaLabel={`Línea ${n}: ${displayName}`}
        ariaDescribedBy={error !== null ? messageId : undefined}
        onClick={onOpen}
      >
        <div className="nueva-venta__linea-encabezado">
          <span className="nueva-venta__linea-nombre">{displayName}</span>
          {preview !== null && (
            <span className="nueva-venta__linea-gramos">
              {formatGrams(fromHundredths(preview.gramsHundredths))} g
            </span>
          )}
        </div>
        {preview !== null && (
          <div className="nueva-venta__linea-detalle">
            {preview.rule !== 'gift' && (
              <span className="nueva-venta__linea-preciogramo">{formatMoney(preview.pricePerGram)} x g</span>
            )}
            <ReglaInsignia rule={preview.rule} />
            <span className="nueva-venta__linea-total">{formatMoney(preview.lineTotal)}</span>
          </div>
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
        <span className="campo__rotulo">Variedad</span>
        <select
          className="campo__input"
          aria-label={`Variedad línea ${n}`}
          value={line.varietyId}
          ref={varietyRef}
          onFocus={(event) => scrollFieldIntoView(event.currentTarget)}
          onChange={(event) => onChange({ varietyId: event.target.value })}
        >
          <option value="">Elegí una variedad</option>
          {varieties.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        <span className="campo__rotulo">Gramos</span>
        <input
          className="campo__input"
          aria-label={`Gramos línea ${n}`}
          type="text"
          inputMode="decimal"
          enterKeyHint="next"
          value={line.grams}
          ref={gramsRef}
          onKeyDown={(event) => onEnter(event, () => specialPriceRef.current?.focus())}
          onFocus={(event) => scrollFieldIntoView(event.currentTarget)}
          onChange={(event) => onChange({ grams: event.target.value })}
        />
        <span className="campo__ayuda">Coma, hasta dos decimales</span>
      </label>
      <div className="nueva-venta__linea-opciones">
        <OpcionInterruptor
          label="Regalo"
          ariaLabel={`Regalo línea ${n}`}
          checked={line.gift}
          disabled={line.specialPrice.trim() !== ''}
          onChange={(gift) => onChange({ gift })}
        />
        <input
          className="campo__input"
          aria-label={`Precio especial línea ${n}`}
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          placeholder="Precio especial"
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
      {error === null && preview !== null && (
        <div className="nueva-venta__linea-detalle">
          {preview.rule !== 'gift' && (
            <span className="nueva-venta__linea-preciogramo">{formatMoney(preview.pricePerGram)} x g</span>
          )}
          <ReglaInsignia rule={preview.rule} />
          <span className="nueva-venta__linea-total">{formatMoney(preview.lineTotal)}</span>
        </div>
      )}
      {canRemove && (
        <Boton variant="link" ariaLabel={`Quitar línea ${n}`} onClick={onRemove}>
          Quitar
        </Boton>
      )}
    </div>
  )
}
