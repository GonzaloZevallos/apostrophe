/**
 * "Customer types" (Settings → Prices → Customer types; `docs/product/customers.md`): the
 * seller's own groups of customers, each a name and an icon. A list with "+ Customer type", and
 * Rename and Delete on each row; the new/edit form is an in-page Sheet (`CustomerTypeForm`).
 * Deleting a type that still has customers is refused by the server with their count, and the
 * row shows it in the amber notice; nothing is ever left without a type silently.
 *
 * The screen is reached from the Prices group's entry row, which shows only while the switch is
 * on; the screen itself does not read the switch (the server's routes do not either).
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError, NetworkError } from '../../api/client'
import { type CustomerType, customerTypesQueryOptions, deleteCustomerType } from '../../api/customerTypes'
import { invalidateResource } from '../../api/keys'
import AvisoAmbar from '../../components/AvisoAmbar'
import Boton from '../../components/Boton'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icono from '../../components/Icono'
import Loading from '../../components/Loading'
import Sheet from '../../components/Sheet'
import SinConexion from '../../components/SinConexion'
import { EMPTY_STATE_KEYS } from '../../copy/emptyStates'
import { useViewport } from '../../shell/useViewport'
import CustomerTypeForm, { type CustomerTypeTarget } from './CustomerTypeForm'
import { CUSTOMER_TYPE_ICONS } from './customerTypeIcons'
import SettingsGroup from './SettingsGroup'

export default function CustomerTypes() {
  const { t } = useTranslation()
  const computer = useViewport() === 'computer'
  const queryClient = useQueryClient()
  const list = useQuery(customerTypesQueryOptions())
  const [target, setTarget] = useState<CustomerTypeTarget | null>(null)
  const [formDirty, setFormDirty] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [inUse, setInUse] = useState<{ id: number; count: number } | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  function closeForm(): void {
    setTarget(null)
    setFormDirty(false)
    setConfirmingDiscard(false)
  }

  function askClose(): void {
    if (formDirty) setConfirmingDiscard(true)
    else closeForm()
  }

  async function remove(type: CustomerType): Promise<void> {
    setInUse(null)
    setFailure(null)
    setOffline(false)
    try {
      await deleteCustomerType(type.id)
      invalidateResource(queryClient, 'customerTypes')
    } catch (caught) {
      if (caught instanceof NetworkError) setOffline(true)
      else if (caught instanceof ApiError && caught.code === 'customer_type.in_use') {
        const count = caught.fields['count']
        setInUse({ id: type.id, count: typeof count === 'number' ? count : 0 })
      } else if (caught instanceof ApiError && caught.code === 'customer_type.not_found') {
        invalidateResource(queryClient, 'customerTypes')
      } else setFailure(t('common:genericError'))
    }
  }

  const discardDialog = confirmingDiscard && (
    <ConfirmDialog
      title={t('customerTypes:form.discardTitle')}
      detail={t('common:losesWhatYouEntered')}
      confirmText={t('customerTypes:form.discardConfirm')}
      cancelText={t('customerTypes:form.discardKeep')}
      onConfirm={closeForm}
      onCancel={() => setConfirmingDiscard(false)}
    />
  )

  return (
    <SettingsGroup title={t('customerTypes:title')} dirty={false}>
      <div className="tipos-cliente">
      {list.isPending && <Loading />}
      {list.isError &&
        (list.error instanceof NetworkError ? (
          <SinConexion />
        ) : (
          <Boton variant="notice" onClick={() => void list.refetch()}>
            {t('customerTypes:list.loadError')}
          </Boton>
        ))}
      {list.data !== undefined && list.data.length === 0 && (
        <span className="campo__rotulo">{t(EMPTY_STATE_KEYS.customerTypesList)}</span>
      )}
      {list.data !== undefined && (
        <div>
          {list.data.map((type) => (
            <div key={type.id} className="fila">
              <span className="categoria-fila__nombre">
                <span className="tipo-cliente-fila__icono">
                  <Icono nombre={CUSTOMER_TYPE_ICONS[type.icon]} />
                </span>
                {type.name}
              </span>
              <span className="categoria-fila__accion">
                <Boton
                  variant="icon"
                  action="edit"
                  ariaLabel={t('customerTypes:list.renameLabel', { name: type.name })}
                  onClick={() => setTarget(type)}
                />
              </span>
              <Boton
                variant="icon"
                action="delete"
                ariaLabel={t('customerTypes:list.deleteLabel', { name: type.name })}
                onClick={() => void remove(type)}
              />
              {inUse !== null && inUse.id === type.id && (
                <AvisoAmbar attention role="alert">
                  {t('customerTypes:list.inUse', { count: inUse.count })}
                </AvisoAmbar>
              )}
            </div>
          ))}
        </div>
      )}
      {failure !== null && (
        <span className="campo__error" role="alert">
          {failure}
        </span>
      )}
      {offline && <SinConexion />}
      <Boton variant="link" onClick={() => setTarget('new')}>
        {t('customerTypes:list.add')}
      </Boton>

      {target !== null && (
        <Sheet
          computer={computer}
          computerClass="capa"
          computerBodyClass="capa__contenido"
          computerDialog={false}
          frameTag="div"
          label={t(target === 'new' ? 'customerTypes:form.titleNew' : 'customerTypes:form.titleEdit')}
          touched={formDirty}
          onClose={askClose}
          computerFrameRole="presentation"
          aside={!computer && discardDialog}
        >
          <CustomerTypeForm
            key={target === 'new' ? 'new' : target.id}
            target={target}
            onDirtyChange={setFormDirty}
            onCancel={askClose}
            onDone={() => {
              invalidateResource(queryClient, 'customerTypes')
              closeForm()
            }}
            onGone={() => invalidateResource(queryClient, 'customerTypes')}
          />
          {computer && discardDialog}
        </Sheet>
      )}
      </div>
    </SettingsGroup>
  )
}
