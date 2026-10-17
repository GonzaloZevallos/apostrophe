/**
 * The first-run checklist (`InicioPrimeraVez.dc.html`, navigation.md): the four steps the
 * server answered, each with a box that is checked when done and the word "Hecho", and
 * "Obligatorio" or "Opcional" in words. Never told by color alone, and it carries no
 * attention icon. It decides no step: it draws `GET /first-run`'s `checklist`.
 */

import type { ChecklistStepAnswer, ChecklistStepName } from '../../api/firstRun'
import Icono from '../../components/Icono'
import {
  CHECKLIST_DONE,
  CHECKLIST_OPTIONAL,
  CHECKLIST_REQUIRED,
  CHECKLIST_TITLE,
  STEP_PRICED_VARIETY,
  STEP_PUBLISHED,
  STEP_SECOND_USER,
  STEP_STOCK_ENTRY,
} from '../../copy/home'

const LABEL: Record<ChecklistStepName, string> = {
  priced_variety: STEP_PRICED_VARIETY,
  stock_entry: STEP_STOCK_ENTRY,
  published: STEP_PUBLISHED,
  second_user: STEP_SECOND_USER,
}

export default function FirstRunChecklist({ steps }: { steps: ChecklistStepAnswer[] }) {
  return (
    <section className="checklist" aria-labelledby="checklist-titulo">
      <h2 className="checklist__titulo" id="checklist-titulo">
        {CHECKLIST_TITLE}
      </h2>
      <ul className="checklist__lista" aria-labelledby="checklist-titulo">
        {steps.map((step) => (
          <li key={step.step} className="checklist__paso">
            <span
              className={step.done ? 'checklist__caja checklist__caja--hecha' : 'checklist__caja'}
              aria-hidden="true"
            >
              {step.done && <Icono nombre="hecho" />}
            </span>
            <span className="checklist__texto">
              <span className="checklist__nombre" data-copy="help">
                {LABEL[step.step]}
              </span>
              <span className="checklist__requisito">
                {step.required ? CHECKLIST_REQUIRED : CHECKLIST_OPTIONAL}
              </span>
            </span>
            {step.done && <span className="checklist__hecho">{CHECKLIST_DONE}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
