/**
 * Where a write's answer leads (plan, "Front"): "Listo" only from an answer that says
 * `over: true`, carrying a bare flag in the history state so a reload or a deep link
 * without it goes to Inicio; any other answer opens the resume step. An answer with every
 * step done or passed and not over (`finish`) opens `/onboarding` again: a fresh entry
 * sends `advance` and ends it. An answer with nothing to resume (`null`) lands on Inicio.
 * A step may name where a not-over answer goes instead (`to`): the second variety's stock
 * is a route, not a progress decision.
 */

import type { QueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import { keepProgress, type OnboardingProgress } from '../../api/onboarding'
import { HOME, ONBOARDING, ONBOARDING_DONE } from '../../routes'
import { stepInfo } from './steps'

export interface ListoState {
  listo: true
}

export function isListoState(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'listo' in state && state.listo === true
}

/** Opens "Listo", then keeps the answer: keeping an `over: true` answer while a step path
 * is still showing would send that path to Inicio before "Listo" opens. */
export async function openListo(
  answer: OnboardingProgress,
  navigate: NavigateFunction,
  queryClient: QueryClient,
  options: { replace: boolean },
): Promise<void> {
  const state: ListoState = { listo: true }
  await navigate(ONBOARDING_DONE, { state, replace: options.replace })
  keepProgress(queryClient, answer)
}

/** Navigates first and only then keeps the answer (see `openListo`). */
export async function afterProgress(
  answer: OnboardingProgress,
  navigate: NavigateFunction,
  queryClient: QueryClient,
  to?: string,
): Promise<void> {
  if (answer.over) {
    await openListo(answer, navigate, queryClient, { replace: false })
    return
  }
  if (to !== undefined) {
    await navigate(to)
  } else if (answer.resume === null) {
    await navigate(HOME)
  } else if (answer.resume === 'finish') {
    await navigate(ONBOARDING)
  } else {
    await navigate(stepInfo(answer.resume).path)
  }
  keepProgress(queryClient, answer)
}
