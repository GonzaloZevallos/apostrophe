/**
 * Step 5, "Enviale el link a tu socio": the owner's invitation (one join link per tap, to
 * copy or share). The step never waits for the partner to join. "Seguir" appears once a
 * link is created (or a second user already exists) and passes the step as `done`;
 * "Saltar" belongs to the frame.
 */

import { useState } from 'react'
import { sendPass } from '../../api/onboarding'
import InvitePartner from '../settings/InvitePartner'
import { useOnboardingWrite } from './useOnboardingWrite'
import type { StepBodyProps } from './stepBodies'

export default function PartnerStep({ progress, onProgress }: StepBodyProps) {
  const [created, setCreated] = useState(false)
  const { run, sending, notice } = useOnboardingWrite(onProgress)
  const done = progress.steps.find((item) => item.step === 'partner')?.state === 'done'

  return (
    <>
      {done && <span className="onboarding__insignia">Hecho</span>}
      <InvitePartner onLinkCreated={() => setCreated(true)} />
      {(created || done) && (
        <button
          type="button"
          className="boton"
          disabled={sending}
          onClick={() => void run(() => sendPass('partner', 'done'))}
        >
          Seguir
        </button>
      )}
      {notice}
    </>
  )
}
