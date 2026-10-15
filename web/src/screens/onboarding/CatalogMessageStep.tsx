/**
 * Step 3, "Cómo sale tu catálogo": the owner's header and footer form, shown with their
 * defaults. Saving through the owner's route and then "Dejar así" (the defaults kept) both
 * pass the step as `done`; the pass is sent only after the save answered. "Dejar así" is
 * offered only while nothing typed is unsaved, so it never passes over an edit that was not
 * saved. "Saltar" belongs to the frame.
 */

import { useCallback, useState } from 'react'
import { sendPass } from '../../api/onboarding'
import CatalogMessageForm from '../settings/CatalogMessageForm'
import { useOnboardingWrite } from './useOnboardingWrite'
import type { StepBodyProps } from './stepBodies'

export default function CatalogMessageStep({ onDirtyChange, onProgress }: StepBodyProps) {
  const [dirty, setDirty] = useState(false)
  const { run, sending, notice } = useOnboardingWrite(onProgress)

  // Stable: the form reports from an effect keyed on this callback.
  const onDirty = useCallback(
    (value: boolean): void => {
      setDirty(value)
      onDirtyChange(value)
    },
    [onDirtyChange],
  )

  return (
    <>
      <CatalogMessageForm
        submitLabel="Guardar"
        onDirtyChange={onDirty}
        onSaved={() => void run(() => sendPass('header_footer', 'done'))}
      />
      {!dirty && (
        <button
          type="button"
          className="boton boton--suave"
          disabled={sending}
          onClick={() => void run(() => sendPass('header_footer', 'done'))}
        >
          Dejar así
        </button>
      )}
      {notice}
    </>
  )
}
