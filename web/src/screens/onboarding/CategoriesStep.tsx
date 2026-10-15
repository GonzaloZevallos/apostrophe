/**
 * Step 6, "Categorías de gastos": the owner's list, add, rename and remove. Each of those
 * saves at once and never passes the step; only "Seguir" does (`done`). "Saltar" belongs to
 * the frame and keeps the defaults.
 */

import { sendPass } from '../../api/onboarding'
import ExpenseCategoriesEditor from '../settings/ExpenseCategoriesEditor'
import StepSubmit from './StepSubmit'
import { useOnboardingWrite } from './useOnboardingWrite'
import type { StepBodyProps } from './stepBodies'

export default function CategoriesStep({ onDirtyChange, onProgress }: StepBodyProps) {
  const { run, sending, notice } = useOnboardingWrite(onProgress)
  return (
    <>
      <ExpenseCategoriesEditor onDirtyChange={onDirtyChange} />
      <StepSubmit disabled={sending} onSubmit={() => void run(() => sendPass('categories', 'done'))}>
        Seguir
      </StepSubmit>
      {notice}
    </>
  )
}
