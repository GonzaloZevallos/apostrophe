/**
 * `StepSubmit`: the Onboarding's text-only step submit. A step body has no form of its
 * own around its next action, so this wraps one `Boton textOnly="submit"` in a form
 * whose `onSubmit` calls the same write the button used to call on click. Never rendered
 * inside another form. `.onboarding__envio` is `display: contents`, so the button stays
 * the layout child of the container it sits in.
 */

import type { ReactNode } from 'react'
import Boton from '../../components/Boton'

interface StepSubmitProps {
  children: ReactNode
  onSubmit: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}

export default function StepSubmit({
  children,
  onSubmit,
  disabled,
  variant = 'primary',
}: StepSubmitProps) {
  return (
    <form
      className="onboarding__envio"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <Boton variant={variant} textOnly="submit" type="submit" disabled={disabled}>
        {children}
      </Boton>
    </form>
  )
}
