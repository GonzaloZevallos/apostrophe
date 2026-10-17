/**
 * The first-run checklist (`results.md`, "Setup checklist"): the server decides which
 * steps exist, in what order and which are done (plan invariant 7); this component
 * renders `steps` exactly as given and never filters or reorders them.
 */

import { Link } from 'react-router'
import type { SetupStep } from '../api/panel'
import { STEP_COPY } from './setupSteps'

export default function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  return (
    <section className="paso-inicial" aria-labelledby="paso-inicial-titulo">
      <h2 className="paso-inicial__titulo" id="paso-inicial-titulo">
        Para empezar a vender
      </h2>
      <ul className="paso-inicial__lista">
        {steps.map((s) => (
          <li key={s.step}>
            <Link to={STEP_COPY[s.step].to} className="paso-inicial__fila">
              <span
                className={
                  s.done ? 'paso-inicial__caja paso-inicial__caja--hecha' : 'paso-inicial__caja'
                }
                aria-hidden="true"
              />
              <span className="paso-inicial__texto">{STEP_COPY[s.step].label}</span>
              {!s.required && <span className="paso-inicial__etiqueta">Opcional</span>}
              {s.done && <span className="paso-inicial__hecho">Hecho</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
