/**
 * Settings → Business → Payment methods (`docs/product/payment-methods.md`): the business's own
 * list over `/api/payment-methods`. A detail screen (the shell draws "‹ Settings"). Each row opens
 * the one in-page Sheet to rename it, change its icon, archive it (when a Payment uses it) or
 * delete it (when none does, after a confirmation). "Move up" / "Move down" reorder with a word,
 * the first row without Move up and the last without Move down. The names are the seller's data,
 * shown as written; nothing here compares one.
 */

import { type FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import {
  type PaymentMethod,
  addPaymentMethod,
  archivePaymentMethod,
  deletePaymentMethod,
  editPaymentMethod,
  movePaymentMethod,
  paymentMethodsQuery,
} from '../../api/paymentMethods'
import Boton from '../../components/Boton'
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorGenerico from '../../components/ErrorGenerico'
import Icono from '../../components/Icono'
import InAppLink from '../../components/InAppLink'
import { iconOfMethod, paymentMethodIcons, type PaymentMethodIcon } from '../../components/paymentMethodIcons'
import Sheet, { SheetActions } from '../../components/Sheet'
import SinConexion from '../../components/SinConexion'
import { useViewport } from '../../shell/useViewport'
import {
  PAYMENT_METHODS_TEXT as T,
  deleteTitle,
  moveDownLabel,
  moveUpLabel,
  rowLabel,
} from '../../copy/paymentMethods'
import { SETTINGS_PAYMENT_METHODS_ARCHIVED } from '../../routes'
import { NOT_FOUND_CODE, refusalMessage } from './paymentMethodErrors'

const ICONS: readonly { key: PaymentMethodIcon; label: string }[] = [
  { key: 'wallet', label: T.iconWallet },
  { key: 'bank', label: T.iconBank },
  { key: 'card', label: T.iconCard },
  { key: 'coins', label: T.iconCoins },
  { key: 'phone', label: T.iconPhone },
  { key: 'generic', label: T.iconGeneric },
]
const NAME_LIMIT = 40

type Editing = { kind: 'new' } | { kind: 'edit'; method: PaymentMethod }

export default function PaymentMethods() {
  const queryClient = useQueryClient()
  const query = useQuery(paymentMethodsQuery())
  const [editing, setEditing] = useState<Editing | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const methods = query.data ?? []

  function reload(): void {
    invalidateResource(queryClient, 'paymentMethods')
  }

  async function move(method: PaymentMethod, direction: 'up' | 'down'): Promise<void> {
    setNotice(null)
    try {
      await movePaymentMethod(method.id, direction)
    } catch (caught) {
      setNotice(caught instanceof ApiError && caught.code === NOT_FOUND_CODE ? T.errorNotFound : T.errorMoveFailed)
    }
    reload()
  }

  function onGone(): void {
    setEditing(null)
    setNotice(T.errorNotFound)
    reload()
  }

  return (
    <main className="pantalla">
      <div className="cuerpo medios-pago">
        <h1 className="encabezado__titulo">{T.title}</h1>
        <p className="pie">{T.subtitle}</p>
        {notice !== null && (
          <span className="campo__error" role="alert">
            {notice}
          </span>
        )}
        {query.isError && (query.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
        {query.isPending && (
          <div className="medios-pago__lista" role="progressbar" aria-label={T.loading} aria-busy="true">
            <span className="selector-pago__esqueleto" />
            <span className="selector-pago__esqueleto" />
          </div>
        )}
        {query.data !== undefined && (
          <ul className="medios-pago__lista">
            {methods.map((method, index) => (
              <li key={method.id} className="medios-pago__fila">
                <Boton variant="row" ariaLabel={rowLabel(method.name)} onClick={() => setEditing({ kind: 'edit', method })}>
                  <span className="medios-pago__nombre">
                    <Icono {...iconOfMethod(method.icon)} />
                    <span className="medios-pago__texto">{method.name}</span>
                  </span>
                </Boton>
                <span className="medios-pago__mover">
                  {index > 0 && (
                    <Boton variant="link" ariaLabel={moveUpLabel(method.name)} onClick={() => void move(method, 'up')}>
                      {T.moveUp}
                    </Boton>
                  )}
                  {index < methods.length - 1 && (
                    <Boton variant="link" ariaLabel={moveDownLabel(method.name)} onClick={() => void move(method, 'down')}>
                      {T.moveDown}
                    </Boton>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Boton variant="link" onClick={() => setEditing({ kind: 'new' })}>
          {T.add}
        </Boton>
        <InAppLink to={SETTINGS_PAYMENT_METHODS_ARCHIVED} className="ajustes__item">
          <span className="ajustes__item-rotulo">{T.archivedRow}</span>
          <span className="ajustes__item-flecha">
            <Icono nombre="chevron" />
          </span>
        </InAppLink>
      </div>
      {editing !== null && (
        <MethodSheet
          key={editing.kind === 'new' ? 'new' : editing.method.id}
          editing={editing}
          onlyActive={methods.length <= 1}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
          onGone={onGone}
        />
      )}
    </main>
  )
}

interface MethodSheetProps {
  editing: Editing
  onlyActive: boolean
  onClose: () => void
  onSaved: () => void
  onGone: () => void
}

function MethodSheet({ editing, onlyActive, onClose, onSaved, onGone }: MethodSheetProps) {
  const computer = useViewport() === 'computer'
  const method = editing.kind === 'edit' ? editing.method : null
  const [name, setName] = useState(method?.name ?? '')
  const [icon, setIcon] = useState<string>(method?.icon ?? 'generic')
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)
  const [asking, setAsking] = useState<'discard' | 'delete' | null>(null)

  const dirty = name !== (method?.name ?? '') || icon !== (method?.icon ?? 'generic')
  const close = (): void => (dirty ? setAsking('discard') : onClose())

  async function run(action: () => Promise<unknown>, fallback: string): Promise<void> {
    setError(null)
    setOffline(false)
    setSending(true)
    try {
      await action()
      onSaved()
    } catch (caught) {
      if (caught instanceof NetworkError) setOffline(true)
      else if (caught instanceof ApiError && caught.code === NOT_FOUND_CODE) onGone()
      else setError(caught instanceof ApiError ? refusalMessage(caught.code, fallback) : fallback)
      setAsking(null)
    } finally {
      setSending(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (method === null) {
      void run(() => addPaymentMethod(name, icon), T.errorSaveFailed)
    } else {
      void run(
        () =>
          editPaymentMethod(method.id, {
            ...(name !== method.name && { name }),
            ...(icon !== method.icon && { icon }),
          }),
        T.errorSaveFailed,
      )
    }
  }

  const dialog =
    asking === 'discard' ? (
      <ConfirmDialog
        title={T.discardTitle}
        detail=""
        confirmText={T.discardConfirm}
        cancelText={T.discardKeep}
        onConfirm={onClose}
        onCancel={() => setAsking(null)}
      />
    ) : asking === 'delete' && method !== null ? (
      <ConfirmDialog
        title={deleteTitle(method.name)}
        detail={T.deleteBody}
        confirmText={T.deleteConfirm}
        cancelText={T.deleteKeep}
        onConfirm={() => void run(() => deletePaymentMethod(method.id), T.errorActionFailed)}
        onCancel={() => setAsking(null)}
      />
    ) : null

  const title = method === null ? T.addTitle : method.name
  return (
    <Sheet
      computer={computer}
      computerClass="capa"
      computerBodyClass="capa__contenido"
      computerDialog={false}
      frameTag="div"
      titleId="medios-pago-hoja"
      touched={dirty}
      onClose={close}
      computerFrameRole="presentation"
      aside={dialog}
    >
      <div className="gasto-form">
        <div className="gasto-form__cabecera">
          <span id="medios-pago-hoja" className="gasto-form__titulo medios-pago__titulo-hoja">
            {title}
          </span>
          <span className="gasto-form__cerrar">
            <Boton variant="icon" action="close" ariaLabel={T.close} onClick={close} />
          </span>
        </div>
        <form className="formulario" onSubmit={onSubmit}>
          <label className="campo">
            <span className="campo__rotulo">{T.nameLabel}</span>
            <input
              className="campo__input"
              type="text"
              autoComplete="off"
              value={name}
              maxLength={NAME_LIMIT + 20}
              onChange={(event) => {
                setName(event.target.value)
                setError(null)
              }}
            />
            {error !== null && (
              <span className="campo__error" role="alert">
                <Icono nombre="atencion" /> {error}
              </span>
            )}
          </label>
          <div className="campo" role="radiogroup" aria-label={T.iconLabel}>
            <span className="campo__rotulo">{T.iconLabel}</span>
            <div className="medios-pago__iconos">
              {ICONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={icon === option.key}
                  className={
                    icon === option.key ? 'selector-pago__opcion selector-pago__opcion--activa' : 'selector-pago__opcion'
                  }
                  onClick={() => setIcon(option.key)}
                >
                  {icon === option.key && <Icono nombre="hecho" />}
                  <Icono {...paymentMethodIcons[option.key]} />
                  <span className="selector-pago__nombre">{option.label}</span>
                  {icon === option.key && <span className="medios-pago__oculto">{T.iconSelected}</span>}
                </button>
              ))}
            </div>
          </div>
          <SheetActions>
            {offline && <SinConexion />}
            <Boton textOnly="submit" type="submit" disabled={sending || name.trim() === ''}>
              {T.save}
            </Boton>
            {method !== null && onlyActive && (
              <span className="campo__error">
                <Icono nombre="atencion" /> {T.errorLastActive}
              </span>
            )}
            {method !== null && !onlyActive && method.is_used && (
              <Boton
                variant="secondary"
                icon="archivar"
                disabled={sending}
                onClick={() => void run(() => archivePaymentMethod(method.id), T.errorActionFailed)}
              >
                {T.archive}
              </Boton>
            )}
            {method !== null && !onlyActive && !method.is_used && (
              <Boton variant="critical" icon="tacho" disabled={sending} onClick={() => setAsking('delete')}>
                {T.delete}
              </Boton>
            )}
          </SheetActions>
        </form>
      </div>
    </Sheet>
  )
}
