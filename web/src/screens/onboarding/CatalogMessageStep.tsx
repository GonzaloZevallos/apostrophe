/**
 * Step 3, "How your catalog looks": the owner's header and footer form, shown with their
 * defaults. Saving through the owner's route and then "Leave as is" (the defaults kept) both
 * pass the step as `done`; the pass is sent only after the save answered. "Leave as is" is
 * offered only while nothing typed is unsaved, so it never passes over an edit that was not
 * saved. "Skip" belongs to the frame.
 */

import { useCallback, useState } from 'react'
import { sendPass } from '../../api/onboarding'
import CatalogMessageForm from '../settings/CatalogMessageForm'
import StepSubmit from './StepSubmit'
import { useOnboardingWrite } from './useOnboardingWrite'
import type { StepBodyProps } from './stepBodies'
import { COMMON_TEXT } from '../../copy/common'
import { ONBOARDING_TEXT } from '../../copy/onboarding'

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
        submitLabel={COMMON_TEXT.save}
        onDirtyChange={onDirty}
        onSaved={() => void run(() => sendPass('header_footer', 'done'))}
      />
      {!dirty && (
        <StepSubmit
          variant="secondary"
          disabled={sending}
          onSubmit={() => void run(() => sendPass('header_footer', 'done'))}
        >
          {ONBOARDING_TEXT.leaveAsIs}
        </StepSubmit>
      )}
      {notice}
    </>
  )
}
