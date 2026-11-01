/**
 * The "Units" card of Settings → Products (`docs/product/units.md`): the business's units in
 * creation order, `+ New unit`, and a named Edit and Delete on each row. The form is a `Sheet`
 * drawn over the list (ADR-0062); Delete asks only when the unit can go, and a unit in use or
 * the last one answers with a sentence card instead of a dialog.
 */

import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import { resolveOverride, type RefusalCode } from '../../api/refusals'
import { type Unit, addUnit, editUnit, listUnits, removeUnit } from '../../api/units'
import AvisoAmbar from '../../components/AvisoAmbar'
import Boton from '../../components/Boton'
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneNotice from '../../components/GoneNotice'
import Loading from '../../components/Loading'
import MasInfo from '../../components/MasInfo'
import SegmentedChoice from '../../components/SegmentedChoice'
import Sheet, { SheetActions } from '../../components/Sheet'
import SinConexion from '../../components/SinConexion'
import { useViewport } from '../../shell/useViewport'
import SettingsGroup from './SettingsGroup'

type FormFor = { mode: 'new' } | { mode: 'edit'; unit: Unit }

const FIELD_OVERRIDES: Partial<Record<RefusalCode, 'name' | 'decimals'>> = {
  'unit.name_taken': 'name',
  'unit.decimals_in_use': 'decimals',
}

const DECIMALS = [0, 1, 2] as const

export default function UnitsGroup() {
  const { t } = useTranslation()
  const [dirty, setDirty] = useState(false)
  return (
    <SettingsGroup
      title={t('units:title')}
      dirty={dirty}
      leave={{
        question: t('units:discardTitle'),
        detail: t('units:discardBody'),
        keepLabel: t('units:discardKeep'),
        discardLabel: t('units:discardYes'),
      }}
    >
      <Units onDirtyChange={setDirty} />
    </SettingsGroup>
  )
}

function Units({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const units = useQuery({ queryKey: keys.units(), queryFn: listUnits })
  const [form, setForm] = useState<FormFor | null>(null)
  const [confirming, setConfirming] = useState<Unit | null>(null)
  const [refusal, setRefusal] = useState<{ unit: Unit; kind: 'in-use' | 'last' } | null>(null)
  const [gone, setGone] = useState(false)
  const [offline, setOffline] = useState(false)
  const [failed, setFailed] = useState(false)

  const remove = useMutation({
    mutationFn: (unit: Unit) => removeUnit(unit.id),
    onSuccess: () => invalidateResource(queryClient, 'units'),
  })

  function closeForm(): void {
    setForm(null)
    onDirtyChange(false)
  }

  async function onDelete(unit: Unit): Promise<void> {
    setConfirming(null)
    setOffline(false)
    setFailed(false)
    try {
      await remove.mutateAsync(unit)
    } catch (caught) {
      if (caught instanceof NetworkError) setOffline(true)
      else if (caught instanceof ApiError && caught.code === 'unit.in_use') setRefusal({ unit, kind: 'in-use' })
      else if (caught instanceof ApiError && caught.code === 'unit.last_unit') setRefusal({ unit, kind: 'last' })
      else if (caught instanceof ApiError && caught.code === 'unit.not_found') setGone(true)
      else setFailed(true)
      invalidateResource(queryClient, 'units')
    }
  }

  function askDelete(unit: Unit, count: number): void {
    setRefusal(null)
    setGone(false)
    if (count <= 1) setRefusal({ unit, kind: 'last' })
    else if (unit.product_count > 0) setRefusal({ unit, kind: 'in-use' })
    else setConfirming(unit)
  }

  if (units.data === undefined) {
    if (units.isError) return units.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />
    return <Loading />
  }
  const list = units.data

  return (
    <>
      <div>
        {list.map((unit) => (
          <div className="fila" key={unit.id}>
            <span className="categoria-fila__nombre">
              <span>{unit.name}</span>
              <span className="campo__rotulo">{detail(t, unit)}</span>
            </span>
            <span className="categoria-fila__accion">
              <Boton
                variant="icon"
                action="edit"
                ariaLabel={t('units:editNamed', { name: unit.name })}
                onClick={() => setForm({ mode: 'edit', unit })}
              />
            </span>
            <Boton
              variant="icon"
              action="delete"
              ariaLabel={t('units:deleteNamed', { name: unit.name })}
              onClick={() => askDelete(unit, list.length)}
            />
          </div>
        ))}
      </div>
      <Boton variant="secondary" icon="agregar" onClick={() => setForm({ mode: 'new' })}>
        {t('units:new')}
      </Boton>

      {refusal !== null && (
        <AvisoAmbar attention role="alert">
          <span className="aviso-ambar__titulo">
            {refusal.kind === 'last'
              ? t('units:deleteLast')
              : t('units:deleteInUse', { count: refusal.unit.product_count })}
          </span>
          {refusal.kind === 'in-use' && <MasInfo line={t('units:moreInfo')} more={t('units:deleteInUseMoreInfo')} />}
        </AvisoAmbar>
      )}
      {gone && <GoneNotice />}
      {offline && <SinConexion />}
      {failed && <ErrorGenerico />}

      {confirming !== null && (
        <ConfirmDialog
          title={t('units:confirmDeleteTitle', { name: confirming.name })}
          detail={t('units:confirmDeleteBody')}
          confirmText={t('units:confirmDeleteYes')}
          cancelText={t('units:confirmDeleteNo')}
          onConfirm={() => void onDelete(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
      {form !== null && <UnitForm form={form} onClose={closeForm} onDirtyChange={onDirtyChange} />}
    </>
  )
}

function detail(t: ReturnType<typeof useTranslation>['t'], unit: Unit): string {
  if (unit.decimals === 0) return t('units:rowDetailWhole', { name: unit.label })
  return t('units:rowDetail', { name: unit.label, count: unit.decimals })
}

function UnitForm({
  form,
  onClose,
  onDirtyChange,
}: {
  form: FormFor
  onClose: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const computer = useViewport() === 'computer'
  const start = form.mode === 'edit' ? form.unit : null
  const [name, setName] = useState(start?.name ?? '')
  const [label, setLabel] = useState(start?.label ?? '')
  const [decimals, setDecimals] = useState<number | null>(start?.decimals ?? null)
  const [errors, setErrors] = useState<{ name?: string; label?: string; decimals?: string; form?: string }>({})
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)
  const [discarding, setDiscarding] = useState(false)

  const dirty = name !== (start?.name ?? '') || label !== (start?.label ?? '') || decimals !== (start?.decimals ?? null)
  function touch(): void {
    onDirtyChange(true)
  }
  function close(): void {
    if (dirty) setDiscarding(true)
    else onClose()
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const next: typeof errors = {}
    if (name.trim() === '') next.name = t('units:errNameRequired')
    if (label.trim() === '') next.label = t('units:errLabelRequired')
    if (decimals === null) next.decimals = t('units:errDecimalsRequired')
    setErrors(next)
    setOffline(false)
    if (decimals === null || next.name !== undefined || next.label !== undefined) return
    const body = { name: name.trim(), label: label.trim(), decimals }
    setSending(true)
    try {
      if (form.mode === 'edit') await editUnit(form.unit.id, body)
      else await addUnit(body)
      invalidateResource(queryClient, 'units')
      onClose()
    } catch (caught) {
      setSending(false)
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && resolveOverride(FIELD_OVERRIDES, caught.code) === 'name') {
        setErrors({ name: t('units:errNameTaken') })
      } else if (caught instanceof ApiError && resolveOverride(FIELD_OVERRIDES, caught.code) === 'decimals') {
        const current = form.mode === 'edit' ? form.unit.decimals : 0
        setErrors({ decimals: t('units:errDecimalsInUse', { count: current }) })
      } else {
        const unknown = !(caught instanceof ApiError) || caught.code === UNKNOWN_CODE
        setErrors({ form: unknown ? t('common:genericError') : t('units:saveError') })
      }
    }
  }

  const title = form.mode === 'new' ? t('units:formTitleNew') : t('units:formTitleEdit')
  return (
    <Sheet
      computer={computer}
      computerClass="capa"
      computerBodyClass="capa__contenido panel"
      computerDialog
      computerFrameRole="presentation"
      frameTag="div"
      label={title}
      touched={dirty}
      onClose={close}
      aside={
        discarding && (
          <ConfirmDialog
            title={t('units:discardTitle')}
            detail={t('units:discardBody')}
            confirmText={t('units:discardYes')}
            cancelText={t('units:discardKeep')}
            onConfirm={onClose}
            onCancel={() => setDiscarding(false)}
          />
        )
      }
    >
      <div className="encabezado-fila">
        <span className="encabezado__titulo">{title}</span>
        <Boton variant="icon" action="close" ariaLabel={t('units:close')} onClick={close} />
      </div>
      <form className="formulario" onSubmit={(event) => void onSubmit(event)} noValidate>
        <label className="campo">
          <span className="campo__rotulo">{t('units:nameLabel')}</span>
          <input
            className="campo__input"
            autoComplete="off"
            placeholder={t('units:namePlaceholder')}
            value={name}
            aria-invalid={errors.name !== undefined || undefined}
            onChange={(event) => {
              setName(event.target.value)
              setErrors((previous) => ({ ...previous, name: undefined }))
              touch()
            }}
          />
        </label>
        {errors.name !== undefined && (
          <span className="campo__error" role="alert">
            {errors.name}
          </span>
        )}
        <label className="campo">
          <span className="campo__rotulo">{t('units:labelLabel')}</span>
          <input
            className="campo__input"
            autoComplete="off"
            placeholder={t('units:labelPlaceholder')}
            value={label}
            aria-invalid={errors.label !== undefined || undefined}
            onChange={(event) => {
              setLabel(event.target.value)
              setErrors((previous) => ({ ...previous, label: undefined }))
              touch()
            }}
          />
        </label>
        <span className="campo__rotulo" data-copy="help">
          {t('units:labelHint')}
        </span>
        {errors.label !== undefined && (
          <span className="campo__error" role="alert">
            {errors.label}
          </span>
        )}
        <div className="campo">
          <span className="campo__rotulo">{t('units:decimalsLabel')}</span>
          <SegmentedChoice
            ariaLabel={t('units:decimalsLabel')}
            value={decimals === null ? null : String(decimals)}
            options={DECIMALS.map((each) => ({ value: String(each), label: String(each) }))}
            onChange={(value) => {
              setDecimals(Number(value))
              setErrors((previous) => ({ ...previous, decimals: undefined }))
              touch()
            }}
          />
          <span className="campo__rotulo" data-copy="help">
            {t('units:decimalsHint')}
          </span>
        </div>
        {errors.decimals !== undefined && (
          <span className="campo__error" role="alert">
            {errors.decimals}
          </span>
        )}
        <SheetActions>
          {errors.form !== undefined && (
            <span className="campo__error" role="alert">
              {errors.form}
            </span>
          )}
          {offline && <SinConexion />}
          <Boton textOnly="submit" type="submit" disabled={sending}>
            {sending ? t('units:saving') : t('units:save')}
          </Boton>
        </SheetActions>
      </form>
    </Sheet>
  )
}
