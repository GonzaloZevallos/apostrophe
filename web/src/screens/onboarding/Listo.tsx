/**
 * "Listo" (`OnboardingListo.dc.html`): one line per step, from the progress answer alone
 * (a step done or saved says "Hecho"; a skipped one says where it lives; the two required
 * ones count the records made, never a figure or an amount), then "Cargar mi primera
 * venta" and "Ir a Inicio". No celebration. Reaching it already ended the Onboarding
 * (the write that answered `over: true`), so nothing here writes.
 *
 * "Cargar mi primera venta" first swaps this entry of the history for Inicio and then
 * opens Nueva venta, so closing or saving that sale goes back to Inicio, never to "Listo".
 */

import { useNavigate } from 'react-router'
import type { StepSlug } from '../../api/onboarding'
import Icono from '../../components/Icono'
import { NEW_SALE } from '../../routes'
import { useOnboarding } from './onboardingContext'
import StepIndicator from './StepIndicator'
import { STEP_COUNT, STEPS, type StepInfo } from './steps'

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`
}

export default function Listo() {
  const { progress } = useOnboarding()
  const navigate = useNavigate()

  function lineOf(info: StepInfo): { done: boolean; text: string } {
    const state = progress.steps.find((item) => item.step === info.slug)?.state ?? 'pending'
    if (state === 'done') return { done: true, text: doneText(info.slug) }
    return { done: false, text: `Para después — en ${info.later}` }
  }

  function doneText(slug: StepSlug): string {
    if (slug === 'variety') return `Hecho · ${plural(progress.varieties_count, 'variedad', 'variedades')}`
    if (slug === 'stock') return `Hecho · ${plural(progress.stock_entries_count, 'entrada', 'entradas')}`
    return 'Hecho'
  }

  async function firstSale(): Promise<void> {
    await navigate('/', { replace: true })
    void navigate(NEW_SALE)
  }

  return (
    <main className="pantalla onboarding">
      <div className="onboarding__columna">
        <div className="onboarding__cabecera onboarding__cabecera--derecha">
          <button type="button" className="onboarding__enlace" onClick={() => void navigate('/', { replace: true })}>
            Cerrar
          </button>
        </div>
        <div className="onboarding__progreso">
          <span className="onboarding__paso">{`${STEP_COUNT} de ${STEP_COUNT} pasos`}</span>
          <StepIndicator steps={progress.steps} current={null} />
        </div>
        <div className="onboarding__titulos">
          <h1 className="onboarding__titulo onboarding__titulo--grande">Listo</h1>
          <p className="onboarding__porque">Esto quedó armado en tu negocio.</p>
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
                  {line.done && <Icono nombre="hecho" size={14} strokeWidth={2.4} />}
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
          <button type="button" className="boton" onClick={() => void firstSale()}>
            Cargar mi primera venta
          </button>
          <button
            type="button"
            className="boton boton--suave onboarding__boton-saltar"
            onClick={() => void navigate('/', { replace: true })}
          >
            Ir a Inicio
          </button>
        </div>
      </div>
    </main>
  )
}
