/**
 * Step 6, "Categorías de gastos": the owner's list, add, rename and remove. Each of those
 * saves at once and never passes the step; only "Continue" does (`done`). "Skip" belongs to
 * the frame and keeps the defaults.
 */

import { sendPass } from '../../api/onboarding'
import ExpenseCategoriesEditor, { CATEGORIES_SAVE_AT_ONCE } from '../settings/ExpenseCategoriesEditor'
import StepSubmit from './StepSubmit'
import { useOnboardingWrite } from './useOnboardingWrite'
import type { StepBodyProps } from './stepBodies'
import { ONBOARDING_TEXT } from '../../copy/onboarding'

export default function CategoriesStep({ onDirtyChange, onProgress }: StepBodyProps) {
  const { run, sending, notice } = useOnboardingWrite(onProgress)
  return (
    <>
      <ExpenseCategoriesEditor
        onDirtyChange={onDirtyChange}
        footnote={
          <span className="campo__rotulo" data-copy="help">
            {CATEGORIES_SAVE_AT_ONCE}
          </span>
        }
      />
      <StepSubmit disabled={sending} onSubmit={() => void run(() => sendPass('categories', 'done'))}>
        {ONBOARDING_TEXT.continue}
      </StepSubmit>
      {notice}
    </>
  )
}
