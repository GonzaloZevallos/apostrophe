/**
 * Where a write's answer leads (plan, "Front"): "Listo" only from an answer that says
 * `over: true`, carrying a bare flag in the history state so a reload or a deep link
 * without it goes to Inicio; any other answer opens the resume step. An answer with no
 * step left to resume and not over (a required fact moved between two writes) lands on
 * Inicio, where the notice's tap sends `advance`.
 */

import type { NavigateFunction } from 'react-router'
import type { OnboardingProgress } from '../../api/onboarding'
import { ONBOARDING_DONE } from '../../routes'
import { stepInfo } from './steps'

export interface ListoState {
  listo: true
}

export function isListoState(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'listo' in state && state.listo === true
}

export function afterProgress(answer: OnboardingProgress, navigate: NavigateFunction): void {
  if (answer.over) {
    const state: ListoState = { listo: true }
    void navigate(ONBOARDING_DONE, { state })
    return
  }
  if (answer.resume === null || answer.resume === 'finish') {
    void navigate('/')
    return
  }
  void navigate(stepInfo(answer.resume).path)
}
