/**
 * `ForgotSheet`: what "Forgot your password?" opens on Sign in (`accounts.md`, GH-521). A reset
 * link is issued by the person who runs the app for the business, so this only explains how to
 * get one: fixed text, the same for everyone, with no field, no send button and no contact.
 * It takes no prop but `onClose` and imports nothing from the form, so it can read nothing
 * typed there. Its host (`Entrar`) owns the history entry, Escape and the focus on return.
 */

import { useId, useMemo, useRef } from 'react'
import Boton from '../components/Boton'
import Sheet from '../components/Sheet'
import { AUTH_TEXT, FORGOT_SHEET_TEXT } from '../copy/auth'
import { COMMON_TEXT } from '../copy/common'
import { useViewport } from '../shell/useViewport'

export default function ForgotSheet({ onClose }: { onClose: () => void }) {
  const computer = useViewport() === 'computer'
  const titleId = useId()
  // The sheet opens on its own Close: a phone user hears the dialog's name first. `Boton` takes no
  // ref, so the target is found through its wrapper at the moment the sheet asks for it.
  const closeWrapper = useRef<HTMLSpanElement>(null)
  const closeButton = useMemo(
    () => ({
      get current(): HTMLElement | null {
        return closeWrapper.current?.querySelector('button') ?? null
      },
    }),
    [],
  )

  return (
    <Sheet
      computer={computer}
      computerClass="pantalla cobro-modal"
      computerDialog
      frameTag="div"
      titleId={titleId}
      touched={false}
      onClose={onClose}
      initialFocus={closeButton}
    >
      <div className="gasto-form__cabecera">
        <h2 id={titleId} className="gasto-form__titulo">
          {AUTH_TEXT.forgotPassword}
        </h2>
        <span ref={closeWrapper} className="gasto-form__cerrar">
          <Boton variant="icon" action="close" ariaLabel={COMMON_TEXT.close} onClick={onClose} />
        </span>
      </div>
      <div className="olvido">
        <p>{FORGOT_SHEET_TEXT.whoGivesLink}</p>
        <p>{FORGOT_SHEET_TEXT.whatToAsk}</p>
        <p>{FORGOT_SHEET_TEXT.whatLinkDoes}</p>
      </div>
    </Sheet>
  )
}
