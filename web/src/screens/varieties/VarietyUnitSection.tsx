/**
 * The unit of a product, on its own page (`units.md`): the one place a product's unit is chosen.
 * It is a choice while the product has no history; with history (`removal` is `archive`, the
 * same query that decides Delete versus Archive) it is read-only with the reason line, and an
 * archived product shows it read-only with no reason. A refusal from the server maps to the
 * field: `product.unit_locked`, `product.unit_decimals_in_use` and `product.unit_required`.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import { changeProductUnit, listUnits } from '../../api/units'
import type { ProductUnit, Removal } from '../../api/varieties'
import SinConexion from '../../components/SinConexion'

export interface VarietyUnitSectionProps {
  varietyId: number
  /** Absent only in a payload without it; the section then draws nothing. */
  unit: ProductUnit | undefined
  removal: Removal | null
  archived: boolean
}

export default function VarietyUnitSection({ varietyId, unit, removal, archived }: VarietyUnitSectionProps) {
  const { t } = useTranslation()
  const locked = removal === 'archive'
  const readOnly = archived || locked
  if (unit === undefined) return null
  return (
    <section className="variedad-seccion" aria-label={t('units:unitLabel')}>
      {readOnly ? (
        <>
          <span className="campo__rotulo">{t('units:unitLabel')}</span>
          <p>{unit.name}</p>
          {locked && !archived && (
            <span className="campo__rotulo" data-copy="help">
              {t('units:unitLockedReason')}
            </span>
          )}
        </>
      ) : (
        <UnitChoice varietyId={varietyId} unit={unit} />
      )}
    </section>
  )
}

function UnitChoice({ varietyId, unit }: { varietyId: number; unit: ProductUnit }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const units = useQuery({ queryKey: keys.units(), queryFn: listUnits })
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const change = useMutation({
    mutationFn: (unitId: number) => changeProductUnit(varietyId, unitId),
    onSuccess: () => {
      invalidateResource(queryClient, 'varieties')
      invalidateResource(queryClient, 'stock')
    },
  })

  async function onPick(unitId: number): Promise<void> {
    setError(null)
    setOffline(false)
    try {
      await change.mutateAsync(unitId)
    } catch (caught) {
      if (caught instanceof NetworkError) setOffline(true)
      else if (caught instanceof ApiError && caught.code === 'product.unit_decimals_in_use') setError(t('units:errUnitDecimals'))
      else if (caught instanceof ApiError && caught.code === 'product.unit_locked') setError(t('units:unitLockedReason'))
      else if (caught instanceof ApiError && caught.code === 'product.unit_required') setError(t('units:errUnitRequired'))
      else if (caught instanceof ApiError && caught.code !== UNKNOWN_CODE) setError(t('units:unitSaveError'))
      else setError(t('common:genericError'))
      invalidateResource(queryClient, 'varieties')
    }
  }

  return (
    <label className="campo">
      <span className="campo__rotulo">{t('units:unitLabel')}</span>
      <select
        className="campo__input"
        value={unit.id}
        disabled={change.isPending}
        aria-invalid={error !== null || undefined}
        onChange={(event) => void onPick(Number(event.target.value))}
      >
        {(units.data ?? [unit]).map((each) => (
          <option key={each.id} value={each.id}>
            {each.name}
          </option>
        ))}
      </select>
      {error !== null && (
        <span className="campo__error" role="alert">
          {error}
        </span>
      )}
      {offline && <SinConexion />}
    </label>
  )
}
