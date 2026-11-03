/**
 * The Form Sheet of a customer type, new or edit (`docs/product/customers.md`, "Customer type"):
 * a name and an icon picked from the closed set (`customerTypeIcons.ts`, `circle` by default).
 * It knows nothing about where it is shown: its host supplies the exits and learns whether
 * something changed through `onDirtyChange`, so the host alone asks before discarding.
 *
 * The server judges the name (blank, over 40 characters, taken) and the form shows each refusal
 * inline under the field, keeping what was typed. `customer_type.not_found` (the type was
 * deleted meanwhile) shows its own line and tells the host to refresh the list.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../../api/client'
import {
  type CustomerType,
  type CustomerTypeIconKey,
  createCustomerType,
  editCustomerType,
} from '../../api/customerTypes'
import { kindOf } from '../../api/refusals'
import Boton from '../../components/Boton'
import Icono from '../../components/Icono'
import { SheetActions } from '../../components/Sheet'
import SinConexion from '../../components/SinConexion'
import { GENERIC_REFUSAL_MESSAGE } from '../../copy/settings'
import {
  CUSTOMER_TYPE_ICONS,
  CUSTOMER_TYPE_ICON_ORDER,
  DEFAULT_CUSTOMER_TYPE_ICON,
} from './customerTypeIcons'

export type CustomerTypeTarget = 'new' | CustomerType

type NameError = 'blank' | 'tooLong' | 'duplicate' | 'notFound'

const NAME_ERRORS: Readonly<Record<string, NameError>> = {
  'customer_type.name_blank': 'blank',
  'customer_type.name_too_long': 'tooLong',
  'customer_type.name_taken': 'duplicate',
  'customer_type.not_found': 'notFound',
}

export interface CustomerTypeFormProps {
  target: CustomerTypeTarget
  onDone: (saved: CustomerType) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  /** The type was deleted meanwhile: the host refreshes its list. */
  onGone: () => void
}

export default function CustomerTypeForm({
  target,
  onDone,
  onCancel,
  onDirtyChange,
  onGone,
}: CustomerTypeFormProps) {
  const { t } = useTranslation()
  const initialName = target === 'new' ? '' : target.name
  const initialIcon: CustomerTypeIconKey = target === 'new' ? DEFAULT_CUSTOMER_TYPE_ICON : target.icon
  const [name, setName] = useState(initialName)
  const [icon, setIcon] = useState<CustomerTypeIconKey>(initialIcon)
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
          ? await createCustomerType({ name, icon })
          : await editCustomerType(target.id, { name, icon })
      onDone(saved)
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && NAME_ERRORS[caught.code] !== undefined) {
        const reason = NAME_ERRORS[caught.code]
        setNameError(reason ?? null)
        if (reason === 'notFound') onGone()
      } else if (
        caught instanceof ApiError &&
        caught.code !== UNKNOWN_CODE &&
        kindOf(caught.code) === 'refusal'
      ) {
        setFormError(GENERIC_REFUSAL_MESSAGE)
      } else {
        setFormError(t('common:genericError'))
      }
    } finally {
      setSending(false)
    }
  }

  const title = t(target === 'new' ? 'customerTypes:form.titleNew' : 'customerTypes:form.titleEdit')
  const errorText =
    nameError === null
      ? null
      : {
          blank: t('customerTypes:form.errorBlank'),
          tooLong: t('customerTypes:form.errorTooLong'),
          duplicate: t('customerTypes:form.errorDuplicate'),
          notFound: t('customerTypes:form.errorNotFound'),
        }[nameError]

  return (
    <form className="formulario" onSubmit={onSubmit} aria-label={title}>
      <div className="ajustes-grupo__encabezado">
        <span className="panel__titulo">{title}</span>
        <Boton variant="icon" action="close" ariaLabel={t('common:close')} onClick={onCancel} />
      </div>
      <label className="campo">
        <span className="campo__rotulo">{t('customerTypes:form.nameLabel')}</span>
        <input
          className="campo__input"
          autoComplete="off"
          value={name}
          aria-invalid={nameError !== null && nameError !== 'notFound' ? true : undefined}
          onChange={(event) => {
            setName(event.target.value)
            setNameError(null)
          }}
        />
      </label>
      <div className="campo">
        <span className="campo__rotulo">{t('customerTypes:form.iconLabel')}</span>
        <div className="selector-pago" role="radiogroup" aria-label={t('customerTypes:form.iconLabel')}>
          {CUSTOMER_TYPE_ICON_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={icon === key}
              aria-label={t(`customerTypes:icon.${key}`)}
              className={
                icon === key ? 'selector-pago__opcion selector-pago__opcion--activa' : 'selector-pago__opcion'
              }
              onClick={() => setIcon(key)}
            >
              <Icono nombre={CUSTOMER_TYPE_ICONS[key]} />
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
          {t('customerTypes:form.save')}
        </Boton>
      </SheetActions>
    </form>
  )
}
