/**
 * What Inicio's notice slots show (results.md's order), drawn from `GET /first-run`
 * (`api/firstRun.ts`): the front decides nothing. Slot 1 is `first_run.kind` (the Onboarding
 * notice, the checklist, "Arrancá por las variedades" or nothing, never two); slot 2 is the
 * out-of-date pin notice; slot 3 is the after-import notice. Slot 1 stays empty until
 * `/first-run` has answered (`undefined`) and, for the Onboarding notice, until its own
 * progress has arrived, so nothing flashes.
 */

import type { ChecklistStepAnswer, FirstRunAnswer } from '../api/firstRun'
import type { OnboardingProgress } from '../api/onboarding'

export type FirstNotice =
  | { kind: 'onboarding'; progress: OnboardingProgress }
  | { kind: 'checklist'; steps: ChecklistStepAnswer[] }
  | { kind: 'start' }

export interface InicioNotices {
  first: FirstNotice | null
  pinOutOfDate: boolean
  importNotice: boolean
}

export function inicioNotices({
  firstRun,
  onboarding,
  pinOutOfDate,
}: {
  firstRun: FirstRunAnswer | undefined
  onboarding: OnboardingProgress | undefined
  pinOutOfDate: boolean
}): InicioNotices {
  return {
    first: firstNotice(firstRun, onboarding),
    pinOutOfDate,
    importNotice: firstRun?.import_notice === true,
  }
}

function firstNotice(
  firstRun: FirstRunAnswer | undefined,
  onboarding: OnboardingProgress | undefined,
): FirstNotice | null {
  if (firstRun === undefined) return null
  switch (firstRun.kind) {
    case 'onboarding':
      return onboarding === undefined ? null : { kind: 'onboarding', progress: onboarding }
    case 'checklist':
      return { kind: 'checklist', steps: firstRun.checklist }
    case 'start_varieties':
      return { kind: 'start' }
    case 'none':
      return null
  }
}
