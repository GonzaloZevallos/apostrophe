/**
 * "Payment methods" (Settings → Payments and expenses → Payment methods; `docs/product/payment-methods.md`):
 * the business's own offered methods, in the order the API answers them (nothing here sorts
 * or numbers the list). Each row has its icon beside the name, Move up and Move down, Edit, and
 * Delete when the method has no Payments or Archive when it has; both ask first. "Add method"
 * and Edit share one Sheet (`PaymentMethodForm`). Every success invalidates
 * `keys.paymentMethods()`; the edit Sheet reads its method from that cache by id, so a Sheet
 * reopened after a save shows the saved name and icon, never a copy kept in local state.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError, NetworkError } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import {
  type MoveDirection,
  type PaymentMethodItem,
  archivePaymentMethod,
  deletePaymentMethod,
  movePaymentMethod,
  paymentMethodsQueryOptions,
} from '../../api/paymentMethods'
import { isGone } from '../../api/refusals'
import AvisoAmbar from '../../components/AvisoAmbar'
import Boton from '../../components/Boton'
import ConfirmDialog from '../../components/ConfirmDialog'
import ContentArea from '../../components/ContentArea'
import GoneNotice from '../../components/GoneNotice'
import Icono from '../../components/Icono'
import InAppLink from '../../components/InAppLink'
import Loading from '../../components/Loading'
import PaymentMethodGlyph from '../../components/PaymentMethodGlyph'
import Sheet from '../../components/Sheet'
import SinConexion from '../../components/SinConexion'
import { SETTINGS_PAYMENT_METHODS_ARCHIVED } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import PaymentMethodForm from './PaymentMethodForm'

/** What the Sheet is for: a new method, or the one with this id (read from the cache). */
type Target = 'new' | number

type Pending = { kind: 'delete' | 'archive'; method: PaymentMethodItem }

export default function PaymentMethods() {
  const { t } = useTranslation()
  const computer = useViewport() === 'computer'
  const queryClient = useQueryClient()
  const list = useQuery(paymentMethodsQueryOptions())
  const [target, setTarget] = useState<Target | null>(null)
  const [formDirty, setFormDirty] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [gone, setGone] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [busy, setBusy] = useState(false)

  const methods = list.data ?? []
  const editing = target === null || target === 'new' ? null : methods.find((m) => m.id === target)

  function refresh(): void {
    invalidateResource(queryClient, 'paymentMethods')
  }

  function clearFeedback(): void {
    setNotice(null)
    setGone(false)
    setFailure(null)
    setOffline(false)
  }

  function closeForm(): void {
    setTarget(null)
    setFormDirty(false)
    setConfirmingDiscard(false)
  }

  function askClose(): void {
    if (formDirty) setConfirmingDiscard(true)
    else closeForm()
  }

  function open(next: Target): void {
    clearFeedback()
    setTarget(next)
  }

  function fail(caught: unknown): void {
    if (caught instanceof NetworkError) setOffline(true)
    else if (caught instanceof ApiError && caught.code === 'payment_method.last_offered')
      setNotice(t('paymentMethods:list.lastOffered'))
    else if (caught instanceof ApiError && isGone(caught.code)) {
      refresh()
      setGone(true)
    } else if (caught instanceof ApiError && caught.code === 'payment_method.in_use') refresh()
    else setFailure(t('common:genericError'))
  }

  async function move(method: PaymentMethodItem, direction: MoveDirection): Promise<void> {
    clearFeedback()
    setBusy(true)
    try {
      queryClient.setQueryData(paymentMethodsQueryOptions().queryKey, await movePaymentMethod(method.id, direction))
      refresh()
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) fail(caught)
      else setFailure(t('paymentMethods:list.moveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function confirm(action: Pending): Promise<void> {
    clearFeedback()
    setPending(null)
    setBusy(true)
    try {
      if (action.kind === 'delete') await deletePaymentMethod(action.method.id)
      else await archivePaymentMethod(action.method.id)
      refresh()
    } catch (caught) {
      fail(caught)
    } finally {
      setBusy(false)
    }
  }

  const discardDialog = confirmingDiscard && (
    <ConfirmDialog
      title={t('paymentMethods:form.discardTitle')}
      detail={t('common:losesWhatYouEntered')}
      confirmText={t('paymentMethods:form.discardConfirm')}
      cancelText={t('paymentMethods:form.discardKeep')}
      onConfirm={closeForm}
      onCancel={() => setConfirmingDiscard(false)}
    />
  )

  const sheetTarget = target === 'new' ? 'new' : editing
  return (
    <ContentArea as="main" className="pantalla">
      <div className="cuerpo ajustes">
        <div className="ajustes__titulos">
          <h1 className="ajustes__titulo">{t('paymentMethods:title')}</h1>
        </div>
        {list.isPending && <Loading />}
        {list.isError &&
          (list.error instanceof NetworkError ? (
            <SinConexion />
          ) : (
            <>
              <span className="campo__error" role="alert">
                {t('paymentMethods:list.loadError')}
              </span>
              <Boton variant="link" onClick={() => void list.refetch()}>
                {t('paymentMethods:list.retry')}
              </Boton>
            </>
          ))}
        {list.data !== undefined && (
          <ul className="ajustes__lista">
            {methods.map((method, index) => (
              <li key={method.id} className="medio-pago-fila">
                <span className="medio-pago-fila__nombre">
                  <PaymentMethodGlyph icon={method.icon} />
                  {method.name}
                </span>
                <span className="medio-pago-fila__acciones">
                  <Boton
                    variant="link"
                    ariaLabel={t('paymentMethods:list.moveUp', { name: method.name })}
                    disabled={busy || index === 0}
                    onClick={() => void move(method, 'up')}
                  >
                    {t('paymentMethods:list.moveUpShort')}
                  </Boton>
                  <Boton
                    variant="link"
                    ariaLabel={t('paymentMethods:list.moveDown', { name: method.name })}
                    disabled={busy || index === methods.length - 1}
                    onClick={() => void move(method, 'down')}
                  >
                    {t('paymentMethods:list.moveDownShort')}
                  </Boton>
                  <Boton
                    variant="icon"
                    action="edit"
                    ariaLabel={t('paymentMethods:list.editNamed', { name: method.name })}
                    onClick={() => open(method.id)}
                  />
                  {method.in_use ? (
                    <Boton
                      variant="secondary"
                      icon="archivar"
                      ariaLabel={`${t('paymentMethods:list.archive')} ${method.name}`}
                      onClick={() => setPending({ kind: 'archive', method })}
                    >
                      {t('paymentMethods:list.archive')}
                    </Boton>
                  ) : (
                    <Boton
                      variant="icon"
                      action="delete"
                      ariaLabel={`${t('paymentMethods:list.delete')} ${method.name}`}
                      onClick={() => setPending({ kind: 'delete', method })}
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {notice !== null && (
          <AvisoAmbar attention role="alert">
            {notice}
          </AvisoAmbar>
        )}
        {failure !== null && (
          <span className="campo__error" role="alert">
            {failure}
          </span>
        )}
        {offline && <SinConexion />}
        {gone && <GoneNotice />}
        {list.data !== undefined && (
          <>
            <Boton variant="secondary" icon="agregar" onClick={() => open('new')}>
              {t('paymentMethods:list.add')}
            </Boton>
            <nav className="ajustes__lista" aria-label={t('paymentMethods:title')}>
              <InAppLink to={SETTINGS_PAYMENT_METHODS_ARCHIVED} className="ajustes__item">
                <span className="ajustes__item-rotulo">{t('paymentMethods:list.archivedEntry')}</span>
                <span className="ajustes__item-flecha">
                  <Icono nombre="chevron" />
                </span>
              </InAppLink>
            </nav>
          </>
        )}
      </div>

      {pending !== null && (
        <ConfirmDialog
          title={
            pending.kind === 'delete'
              ? t('paymentMethods:list.deleteConfirm', { name: pending.method.name })
              : t('paymentMethods:list.archiveConfirm', { name: pending.method.name })
          }
          detail=""
          confirmText={pending.kind === 'delete' ? t('paymentMethods:list.delete') : t('paymentMethods:list.archive')}
          cancelText={t('paymentMethods:list.keepIt')}
          onCancel={() => setPending(null)}
          onConfirm={() => void confirm(pending)}
        />
      )}
      {sheetTarget !== null && sheetTarget !== undefined && (
        <Sheet
          computer={computer}
          computerClass="capa"
          computerBodyClass="capa__contenido"
          computerDialog={false}
          frameTag="div"
          label={t(sheetTarget === 'new' ? 'paymentMethods:form.titleNew' : 'paymentMethods:form.titleEdit')}
          touched={formDirty}
          onClose={askClose}
          computerFrameRole="presentation"
          aside={!computer && discardDialog}
        >
          <PaymentMethodForm
            key={sheetTarget === 'new' ? 'new' : `${sheetTarget.id}:${sheetTarget.name}:${sheetTarget.icon}`}
            target={sheetTarget}
            onDirtyChange={setFormDirty}
            onCancel={askClose}
            onDone={() => {
              refresh()
              closeForm()
            }}
            onGone={() => {
              refresh()
              closeForm()
              setGone(true)
            }}
          />
          {computer && discardDialog}
        </Sheet>
      )}
    </ContentArea>
  )
}
