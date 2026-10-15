/**
 * What Inicio's two notice slots show (results.md's order): slot 1 is "Seguí con la
 * configuración" while the Onboarding is offered and not over, otherwise "Arrancá por las
 * variedades" whenever no variety is priced today; slot 2 is the out-of-date pin notice.
 * Never two of slot 1. Slot 1 stays empty until the Onboarding's answer has arrived
 * (`undefined`), so an Onboarding business never flashes "Arrancá"; it also waits for
 * `pricedToday` before it says "Arrancá".
 */

import type { OnboardingProgress } from '../api/onboarding'

export type FirstNotice = { kind: 'onboarding'; progress: OnboardingProgress } | { kind: 'start' }

export interface InicioNotices {
  first: FirstNotice | null
  pinOutOfDate: boolean
}

export function inicioNotices({
  onboarding,
  pricedToday,
  pinOutOfDate,
}: {
  onboarding: OnboardingProgress | undefined
  pricedToday: boolean | undefined
  pinOutOfDate: boolean
}): InicioNotices {
  return { first: firstNotice(onboarding, pricedToday), pinOutOfDate }
}

function firstNotice(
  onboarding: OnboardingProgress | undefined,
  pricedToday: boolean | undefined,
): FirstNotice | null {
  if (onboarding === undefined) return null
  if (onboarding.offered && !onboarding.over) return { kind: 'onboarding', progress: onboarding }
  return pricedToday === false ? { kind: 'start' } : null
}
