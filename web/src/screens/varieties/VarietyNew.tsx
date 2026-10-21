/**
 * `VarietyNew` (`VariedadNueva.dc.html`, frame 1): adds a variety (`POST /varieties`) on its
 * own route, `/varieties/new`, a form: "Cerrar" and a save go back by history, or to the list
 * when there is no history (a direct link); a save arms "Variedad guardada" for the screen
 * history returns to; leaving with a name typed asks first. Refusals show under the name and
 * keep what was typed. On a computer the CSS draws it as the design's modal over the panes.
 */

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import LeaveConfirm from '../../components/LeaveConfirm'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { useFlash } from '../../flash/useFlash'
import { VARIETIES } from '../../routes'
import { VARIETY_SAVED } from '../Variedades'
import Boton from '../../components/Boton'
import VarietyNameForm from './VarietyNameForm'
import { VARIETIES_TEXT } from '../../copy/varieties'
import { COMMON_TEXT } from '../../copy/common'
import { DISCARD_DETAIL } from '../../copy/onboarding'

export default function VarietyNew() {
  const navigate = useNavigate()
  const location = useLocation()
  const flash = useFlash()
  const [dirty, setDirty] = useState(false)
  const { blocker, disarm } = useLeaveGuard(dirty)

  function leave(): void {
    if (location.key === 'default') void navigate(VARIETIES, { replace: true })
    else void navigate(-1)
  }

  function onSaved(): void {
    disarm()
    flash.armAfterLeaving(VARIETY_SAVED)
    leave()
  }

  return (
    <main className="pantalla variedad-nueva">
      <div className="cuerpo">
        <div className="gasto-form">
          <div className="gasto-form__cabecera">
            <span className="gasto-form__titulo">{COMMON_TEXT.newVariety}</span>
            <span className="gasto-form__cerrar">
              <Boton variant="icon" action="close" ariaLabel={COMMON_TEXT.close} onClick={leave} />
            </span>
          </div>
          <VarietyNameForm onSaved={onSaved} onDirtyChange={setDirty} />
        </div>
      </div>
      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question={VARIETIES_TEXT.descartasLaVariedad}
          detail={DISCARD_DETAIL}
          keepLabel={COMMON_TEXT.noKeepTyping}
          discardLabel={COMMON_TEXT.yesDiscard}
        />
      )}
    </main>
  )
}
