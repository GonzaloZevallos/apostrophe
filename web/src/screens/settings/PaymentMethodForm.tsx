/**
 * The Form Sheet of a payment method, new or edit (`docs/product/payment-methods.md`): a name and
 * an icon picked from the closed set (`components/paymentMethodIcons.ts`, `other` by default).
 * It knows nothing about where it is shown: the host supplies the exits and learns whether
 * something changed through `onDirtyChange`.
 *
 * The server judges the name (blank, over 60 characters, taken, taken by an archived method) and
 * the form shows each refusal beside the field, keeping what was typed. Editing never keeps a
 * copy of the method: the host passes the method it read from the cache, and a Sheet reopened
 * after a save reads the saved one.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../../api/client'
import {
  type PaymentMethodItem,
  addPaymentMethod,
  editPaymentMethod,
} from '../../api/paymentMethods'
import { isGone, kindOf } from '../../api/refusals'
import Boton from '../../components/Boton'
import PaymentMethodGlyph from '../../components/PaymentMethodGlyph'
import {
  DEFAULT_PAYMENT_METHOD_ICON,
  PAYMENT_METHOD_ICON_ORDER,
  type PaymentMethodIcon,
  paymentMethodIconName,
  paymentMethodIconKey,
} from '../../components/paymentMethodIcons'
import { SheetActions } from '../../components/Sheet'
import SinConexion from '../../components/SinConexion'

export type PaymentMethodTarget = 'new' | PaymentMethodItem

type NameError = 'required' | 'tooLong' | 'taken' | 'takenArchived'

const NAME_ERRORS: Readonly<Record<string, NameError>> = {
  'payment_method.name_required': 'required',
  'payment_method.name_too_long': 'tooLong',
  'payment_method.name_taken': 'taken',
  'payment_method.name_taken_archived': 'takenArchived',
}

export interface PaymentMethodFormProps {
  target: PaymentMethodTarget
  onDone: (saved: PaymentMethodItem) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  /** The method was archived or deleted meanwhile: the host refreshes its list. */
  onGone: () => void
}

export default function PaymentMethodForm({
  target,
  onDone,
  onCancel,
  onDirtyChange,
  onGone,
}: PaymentMethodFormProps) {
  const { t } = useTranslation()
  const initialName = target === 'new' ? '' : target.name
  const initialIcon: PaymentMethodIcon =
    target === 'new' ? DEFAULT_PAYMENT_METHOD_ICON : paymentMethodIconKey(target.icon)
  const [name, setName] = useState(initialName)
  const [icon, setIcon] = useState<PaymentMethodIcon>(initialIcon)
  const [nameError, setNameError] = useState<NameError | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)

  const dirty = name !== initialName || icon !== initialIcon
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setNameError(null)
    setFormError(null)
    setOffline(false)
    setSending(true)
    try {
      const saved =
        target === 'new'
          ? await addPaymentMethod({ name, icon })
          : await editPaymentMethod(target.id, { name, icon })
      onDone(saved)
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && NAME_ERRORS[caught.code] !== undefined) {
        setNameError(NAME_ERRORS[caught.code] ?? null)
      } else if (caught instanceof ApiError && isGone(caught.code)) {
        onGone()
      } else if (
        caught instanceof ApiError &&
        caught.code !== UNKNOWN_CODE &&
        kindOf(caught.code) === 'refusal'
      ) {
        setFormError(t('paymentMethods:form.errorRefused'))
      } else {
        setFormError(t('common:genericError'))
      }
    } finally {
      setSending(false)
    }
  }

  const title = t(target === 'new' ? 'paymentMethods:form.titleNew' : 'paymentMethods:form.titleEdit')
  const errorText =
    nameError === null
      ? null
      : {
          required: t('paymentMethods:form.errorRequired'),
          tooLong: t('paymentMethods:form.errorTooLong'),
          taken: t('paymentMethods:form.errorTaken'),
          takenArchived: t('paymentMethods:form.errorTakenArchived'),
        }[nameError]

  return (
    <form className="formulario" onSubmit={onSubmit} aria-label={title}>
      <div className="ajustes-grupo__encabezado">
        <span className="panel__titulo">{title}</span>
        <Boton variant="icon" action="close" ariaLabel={t('common:close')} onClick={onCancel} />
      </div>
      <label className="campo">
        <span className="campo__rotulo">{t('paymentMethods:form.nameLabel')}</span>
        <input
          className="campo__input"
          autoComplete="off"
          value={name}
          aria-invalid={nameError !== null ? true : undefined}
          onChange={(event) => {
            setName(event.target.value)
            setNameError(null)
          }}
        />
        {target !== 'new' && (
          <span className="campo__ayuda">{t('paymentMethods:form.renameNotice')}</span>
        )}
      </label>
      <div className="campo">
        <span className="campo__rotulo">{t('paymentMethods:form.iconLabel')}</span>
        <div
          className="selector-pago medio-pago-iconos"
          role="radiogroup"
          aria-label={t('paymentMethods:form.iconLabel')}
        >
          {PAYMENT_METHOD_ICON_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={icon === key}
              aria-label={paymentMethodIconName(key)}
              className={
                icon === key ? 'selector-pago__opcion selector-pago__opcion--activa' : 'selector-pago__opcion'
              }
              onClick={() => setIcon(key)}
            >
              <PaymentMethodGlyph icon={key} />
            </button>
          ))}
        </div>
      </div>
      <SheetActions>
        {errorText !== null && (
          <span className="campo__error" role="alert">
            {errorText}
          </span>
        )}
        {formError !== null && (
          <span className="campo__error" role="alert">
            {formError}
          </span>
        )}
        {offline && <SinConexion />}
        <Boton textOnly="submit" type="submit" disabled={sending}>
          {t('paymentMethods:form.save')}
        </Boton>
      </SheetActions>
    </form>
  )
}
