/**
 * `WithdrawalReasons`, Settings → Business → Withdrawal reasons (`docs/product/stock.md`,
 * "Withdrawal reason"): the business's own list, in the order the API answers it. Nothing here
 * sorts or numbers it. Each row has Rename, Delete and the two move buttons (the first row has
 * no Up, the last no Down). A move renders the list the API answers back; a failed one says
 * so. Add and Rename share one `Sheet`, opened as a history entry (`useSheet`), so the system
 * back closes it like "Close" does; a refusal shows inline and keeps what was typed. Delete
 * asks first; the server's two refusals show as a notice with the Attention icon.
 */

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import { isGone, kindOf, resolveOverride, type RefusalCode } from '../../api/refusals'
import { readWithdrawalReasons } from '../../api/stock'
import {
  type MoveDirection,
  type WithdrawalReasonItem,
  addReason,
  moveReason,
  removeReason,
  renameReason,
} from '../../api/withdrawalReasons'
import Aviso from '../../components/Aviso'
import Boton from '../../components/Boton'
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import GoneNotice from '../../components/GoneNotice'
import Icono from '../../components/Icono'
import Loading from '../../components/Loading'
import Sheet, { SheetActions } from '../../components/Sheet'
import SinConexion from '../../components/SinConexion'
import { SheetStackProvider, useSheet } from '../../components/useSheetStack'
import { COMMON_TEXT, SIN_CONEXION_MENSAJE } from '../../copy/common'
import { GENERIC_REFUSAL_MESSAGE, SETTINGS_TEXT } from '../../copy/settings'
import { useViewport } from '../../shell/useViewport'

/** What the form is for: a new reason, or the one being renamed. */
type Target = 'add' | WithdrawalReasonItem

type ReasonToast = typeof SETTINGS_TEXT.reasonSaved | typeof SETTINGS_TEXT.reasonDeleted

const NAME_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'stock.withdrawal_reason_name_blank': SETTINGS_TEXT.reasonNameBlank,
  'stock.withdrawal_reason_name_too_long': SETTINGS_TEXT.reasonNameTooLong,
  'stock.withdrawal_reason_name_taken': SETTINGS_TEXT.reasonNameDuplicate,
}

const DELETE_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'stock.withdrawal_reason_has_withdrawals': SETTINGS_TEXT.cannotDeleteStillHasWithdrawals,
  'stock.withdrawal_reason_last': SETTINGS_TEXT.cannotDeleteLastReason,
}

function isRefusal(caught: unknown): caught is ApiError {
  return caught instanceof ApiError && caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal'
}

export default function WithdrawalReasons() {
  return (
    <SheetStackProvider>
      <Reasons />
    </SheetStackProvider>
  )
}

function Reasons() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, error } = useQuery({
    queryKey: keys.withdrawalReasons(),
    queryFn: readWithdrawalReasons,
  })
  const sheet = useSheet(1)
  const [target, setTarget] = useState<Target | null>(null)
  const [deleting, setDeleting] = useState<WithdrawalReasonItem | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [moveFailed, setMoveFailed] = useState(false)
  const [toast, setToast] = useState<ReasonToast | null>(null)
  const [goneNotice, setGoneNotice] = useState(false)
  const [busy, setBusy] = useState(false)

  // A toast and the gone notice clear themselves after 2.5 s; a pending timer must not outlive the screen.
  const timers = useRef<number[]>([])
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((id) => window.clearTimeout(id))
  }, [])
  function flash(message: ReasonToast): void {
    setToast(message)
    timers.current.push(window.setTimeout(() => setToast(null), 2500))
  }
  function flashGone(): void {
    setGoneNotice(true)
    timers.current.push(window.setTimeout(() => setGoneNotice(false), 2500))
  }

  // Escape closes the sheet, as "Close" and the system back do.
  const closeSheet = sheet.close
  const shownTarget = sheet.isOpen ? target : null
  useEffect(() => {
    if (shownTarget === null) return
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') closeSheet()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shownTarget, closeSheet])

  function refresh(): void {
    invalidateResource(queryClient, 'withdrawalReasons')
  }

  function open(next: Target): void {
    setNotice(null)
    setMoveFailed(false)
    setTarget(next)
    sheet.open()
  }

  async function move(reason: WithdrawalReasonItem, direction: MoveDirection): Promise<void> {
    setNotice(null)
    setMoveFailed(false)
    setBusy(true)
    try {
      queryClient.setQueryData(keys.withdrawalReasons(), await moveReason(reason.id, direction))
      refresh()
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) refresh()
      else setMoveFailed(true)
    } finally {
      setBusy(false)
    }
  }

  async function remove(reason: WithdrawalReasonItem): Promise<void> {
    setBusy(true)
    try {
      await removeReason(reason.id)
      setDeleting(null)
      refresh()
      flash(SETTINGS_TEXT.reasonDeleted)
    } catch (caught) {
      setDeleting(null)
      if (caught instanceof ApiError && isGone(caught.code)) {
        refresh()
        flashGone()
      } else if (caught instanceof ApiError) {
        setNotice(resolveOverride(DELETE_OVERRIDES, caught.code) ?? ERROR_GENERICO_MENSAJE)
      } else {
        setNotice(caught instanceof NetworkError ? SIN_CONEXION_MENSAJE : ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setBusy(false)
    }
  }

  const reasons = data ?? []
  return (
    <main className="pantalla">
      <div className="cuerpo">
        <h1 className="ajustes__titulo">{COMMON_TEXT.withdrawalReasons}</h1>
        <span className="campo__rotulo" data-copy="help">
          {SETTINGS_TEXT.withdrawalReasonsHint}
        </span>
        {isPending && <Loading />}
        {isError && (error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
        {data !== undefined && (
          <>
            <ul className="motivos">
              {reasons.map((reason, index) => (
                <li key={reason.id} className="motivo-fila">
                  <span className="motivo-fila__nombre">{reason.name}</span>
                  <div className="motivo-fila__acciones">
                    {index > 0 && (
                      <Boton
                        variant="link"
                        ariaLabel={SETTINGS_TEXT.moveReasonUp(reason.name)}
                        disabled={busy}
                        onClick={() => void move(reason, 'up')}
                      >
                        {SETTINGS_TEXT.moveUp}
                      </Boton>
                    )}
                    {index < reasons.length - 1 && (
                      <Boton
                        variant="link"
                        ariaLabel={SETTINGS_TEXT.moveReasonDown(reason.name)}
                        disabled={busy}
                        onClick={() => void move(reason, 'down')}
                      >
                        {SETTINGS_TEXT.moveDown}
                      </Boton>
                    )}
                    <Boton variant="secondary" icon="lapiz" onClick={() => open(reason)}>
                      {SETTINGS_TEXT.rename}
                    </Boton>
                    <Boton variant="critical" icon="tacho" onClick={() => setDeleting(reason)}>
                      {SETTINGS_TEXT.delete}
                    </Boton>
                  </div>
                </li>
              ))}
            </ul>
            {moveFailed && (
              <span className="campo__error" role="alert">
                {SETTINGS_TEXT.reasonMoveFailed}
              </span>
            )}
            {notice !== null && (
              <div className="motivos__aviso" role="alert">
                <Icono nombre="atencion" />
                <span>{notice}</span>
              </div>
            )}
            <Boton variant="secondary" icon="agregar" onClick={() => open('add')}>
              {SETTINGS_TEXT.addWithdrawalReason}
            </Boton>
          </>
        )}
      </div>

      {shownTarget !== null && (
        <ReasonSheet
          target={shownTarget}
          onClose={closeSheet}
          onSaved={() => {
            refresh()
            closeSheet()
            flash(SETTINGS_TEXT.reasonSaved)
          }}
          onGone={() => {
            refresh()
            closeSheet()
            flashGone()
          }}
        />
      )}
      {deleting !== null && (
        <ConfirmDialog
          title={SETTINGS_TEXT.deleteReasonConfirm(deleting.name)}
          detail=""
          confirmText={SETTINGS_TEXT.delete}
          cancelText={COMMON_TEXT.cancel}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove(deleting)}
        />
      )}
      {toast !== null && <Aviso texto={toast} />}
      {goneNotice && (
        <div className="aviso-flotante">
          <GoneNotice />
        </div>
      )}
    </main>
  )
}

function ReasonSheet({
  target,
  onClose,
  onSaved,
  onGone,
}: {
  target: Target
  onClose: () => void
  onSaved: () => void
  onGone: () => void
}) {
  const computer = useViewport() === 'computer'
  const title = target === 'add' ? SETTINGS_TEXT.addReasonTitle : SETTINGS_TEXT.renameReasonTitle
  const [name, setName] = useState(target === 'add' ? '' : target.name)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setOffline(false)
    setSending(true)
    try {
      if (target === 'add') await addReason(name)
      else await renameReason(target.id, name)
      onSaved()
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && isGone(caught.code)) {
        onGone()
      } else if (caught instanceof ApiError) {
        setError(
          resolveOverride(NAME_OVERRIDES, caught.code) ??
            (isRefusal(caught) ? GENERIC_REFUSAL_MESSAGE : ERROR_GENERICO_MENSAJE),
        )
      } else {
        setError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet
      computer={computer}
      computerClass="capa"
      computerBodyClass="capa__contenido"
      computerDialog={false}
      frameTag="div"
      label={title}
      touched={name !== ''}
      onClose={onClose}
      computerFrameRole="presentation"
    >
      <div className="ajustes-grupo__encabezado">
        <span className="ajustes-grupo__titulo">{title}</span>
        <Boton variant="icon" action="close" ariaLabel={COMMON_TEXT.close} onClick={onClose} />
      </div>
      <form className="formulario" onSubmit={save}>
        <label className="campo">
          <span className="campo__rotulo">{SETTINGS_TEXT.reasonNameLabel}</span>
          <input
            className="campo__input"
            type="text"
            autoComplete="off"
            enterKeyHint="done"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <SheetActions>
          {error !== null && (
            <span className="campo__error" role="alert">
              {error}
            </span>
          )}
          {offline && <SinConexion />}
          <Boton textOnly="submit" type="submit" disabled={sending}>
            {COMMON_TEXT.save}
          </Boton>
        </SheetActions>
      </form>
    </Sheet>
  )
}
