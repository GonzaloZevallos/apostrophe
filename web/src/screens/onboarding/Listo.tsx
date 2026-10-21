/**
 * "Listo" (`OnboardingListo.dc.html`): one line per step, from the progress answer alone
 * (a step done or saved says "Hecho"; a skipped one says where it lives; the two required
 * ones count the records made, never a figure or an amount), then "Cargar mi primera
 * venta" and "Go to Home". No celebration. Reaching it already ended the Onboarding
 * (the write that answered `over: true`), so nothing here writes.
 *
 * "Add my first sale" first swaps this entry of the history for Inicio and then
 * opens Nueva venta as an in-app entry (`inAppState`, from Inicio), so closing or saving that
 * sale goes back to Inicio by history, never to "Listo".
 */

import { useNavigate } from 'react-router'
import type { StepSlug } from '../../api/onboarding'
import Boton from '../../components/Boton'
import Icono from '../../components/Icono'
import { inAppState } from '../../components/inAppState'
import { HOME, SALE_NEW } from '../../routes'
import { useOnboarding } from './onboardingContext'
import StepIndicator from './StepIndicator'
import { STEP_COUNT, STEPS, type StepInfo } from './steps'
import { COMMON_TEXT } from '../../copy/common'
import { ONBOARDING_TEXT } from '../../copy/onboarding'
import { CHECKLIST_DONE } from '../../copy/inicio'

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`
}

export default function Listo() {
  const { progress } = useOnboarding()
  const navigate = useNavigate()

  function lineOf(info: StepInfo): { done: boolean; text: string } {
    const state = progress.steps.find((item) => item.step === info.slug)?.state ?? 'pending'
    if (state === 'done') return { done: true, text: doneText(info.slug) }
    return { done: false, text: ONBOARDING_TEXT.forLaterIn(info.later) }
  }

  function doneText(slug: StepSlug): string {
    if (slug === 'variety') return ONBOARDING_TEXT.doneWith(plural(progress.varieties_count, 'variedad', 'variedades'))
    if (slug === 'stock') return ONBOARDING_TEXT.doneWith(plural(progress.stock_entries_count, 'entrada', 'entradas'))
    return CHECKLIST_DONE
  }

  async function firstSale(): Promise<void> {
    await navigate(HOME, { replace: true })
    void navigate(SALE_NEW, { state: inAppState({ pathname: HOME }) })
  }

  return (
    <main className="pantalla onboarding">
      <div className="onboarding__columna">
        <div className="onboarding__cabecera onboarding__cabecera--derecha">
          <Boton
            variant="icon"
            action="close"
            ariaLabel={COMMON_TEXT.close}
            onClick={() => void navigate(HOME, { replace: true })}
          />
        </div>
        <div className="onboarding__progreso">
          <span className="onboarding__paso">{ONBOARDING_TEXT.stepsCount(STEP_COUNT, STEP_COUNT)}</span>
          <StepIndicator steps={progress.steps} current={null} />
        </div>
        <div className="onboarding__titulos">
          <h1 className="onboarding__titulo onboarding__titulo--grande">{COMMON_TEXT.done}</h1>
          <p className="onboarding__porque">{ONBOARDING_TEXT.thisIsWhatGotSetUp}</p>
        </div>
        <ul className="listo__lista">
          {STEPS.map((info) => {
            const line = lineOf(info)
            return (
              <li key={info.slug} className="listo__fila">
                <span
                  className={line.done ? 'listo__marca listo__marca--hecha' : 'listo__marca'}
                  aria-hidden="true"
                >
                  {line.done && <Icono nombre="hecho" />}
                </span>
                <span className="listo__texto">
                  <span className="listo__nombre">{info.name}</span>
                  <span className="listo__detalle">{line.text}</span>
                </span>
              </li>
            )
          })}
        </ul>
        <div className="onboarding__acciones">
          <Boton icon="agregar" onClick={() => void firstSale()}>
            {ONBOARDING_TEXT.addMyFirstSale}
          </Boton>
          <Boton variant="secondary" icon="inicio" onClick={() => void navigate(HOME, { replace: true })}>
            {ONBOARDING_TEXT.goToHome}
          </Boton>
        </div>
      </div>
    </main>
  )
}
