/**
 * Step 5, "Send the link to your partner": the owner's invitation (one join link per tap, to
 * copy or share). The step never waits for the partner to join. "Continue" appears once a
 * link is created (or a second user already exists) and passes the step as `done`;
 * "Skip" belongs to the frame.
 */

import { useState } from 'react'
import { sendPass } from '../../api/onboarding'
import InvitePartner from '../settings/InvitePartner'
import StepSubmit from './StepSubmit'
import { useOnboardingWrite } from './useOnboardingWrite'
import type { StepBodyProps } from './stepBodies'
import { CHECKLIST_DONE } from '../../copy/inicio'
import { ONBOARDING_TEXT } from '../../copy/onboarding'

const CREATE_LINK = { label: ONBOARDING_TEXT.createTheLink, variant: 'primary' } as const

export default function PartnerStep({ progress, onProgress }: StepBodyProps) {
  const [created, setCreated] = useState(false)
  const { run, sending, notice } = useOnboardingWrite(onProgress)
  const done = progress.steps.find((item) => item.step === 'partner')?.state === 'done'

  return (
    <>
      {done && <span className="onboarding__insignia">{CHECKLIST_DONE}</span>}
      <InvitePartner onLinkCreated={() => setCreated(true)} action={CREATE_LINK} />
      {(created || done) && (
        <StepSubmit disabled={sending} onSubmit={() => void run(() => sendPass('partner', 'done'))}>
          {ONBOARDING_TEXT.continue}
        </StepSubmit>
      )}
      {notice}
    </>
  )
}
