/**
 * Where a write's answer leads (plan, "Front"): "Listo" only from an answer that says
 * `over: true`, carrying a bare flag in the history state so a reload or a deep link
 * without it goes to Inicio; any other answer opens the resume step. An answer with no
 * step left to resume and not over (a required fact moved between two writes) lands on
 * Inicio, where the notice's tap sends `advance`.
 */

import type { QueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import { keepProgress, type OnboardingProgress } from '../../api/onboarding'
import { ONBOARDING_DONE } from '../../routes'
import { stepInfo } from './steps'

export interface ListoState {
  listo: true
}

export function isListoState(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'listo' in state && state.listo === true
}

/** Navigates first and only then keeps the answer: keeping an `over: true` answer while a
 * step path is still showing would send that path to Inicio before "Listo" opens. */
export async function afterProgress(
  answer: OnboardingProgress,
  navigate: NavigateFunction,
  queryClient: QueryClient,
): Promise<void> {
  if (answer.over) {
    const state: ListoState = { listo: true }
    await navigate(ONBOARDING_DONE, { state })
  } else if (answer.resume === null || answer.resume === 'finish') {
    await navigate('/')
  } else {
    await navigate(stepInfo(answer.resume).path)
  }
  keepProgress(queryClient, answer)
}
