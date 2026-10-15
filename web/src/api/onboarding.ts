/**
 * `/onboarding-progress` (docs/adr/0036): the one answer the front renders the Onboarding
 * from. The front decides no done, passed, count, resume, target or over; it shows what
 * this answers. Every write answers the same shape as the `GET`. No answer carries an
 * amount, grams, token, phone number or customer name: a target is `{id, name}` of a
 * variety only.
 *
 * The query is frozen like Inicio's panel (`gcTime: 0`, `staleTime: Infinity`, no refetch
 * on focus or reconnect): a mount always asks again, and a write sets the answer it got.
 */

import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { get, post } from './client'
import { keys } from './keys'

export type StepSlug = 'variety' | 'stock' | 'header_footer' | 'bot' | 'partner' | 'categories'
export type OptionalStepSlug = Exclude<StepSlug, 'variety' | 'stock'>
export type StepState = 'done' | 'skipped' | 'pending'
export type PassWay = 'done' | 'skipped'

export interface OnboardingStepAnswer {
  step: StepSlug
  state: StepState
}

export interface OnboardingTarget {
  id: number
  name: string
}

export interface OnboardingProgress {
  offered: boolean
  over: boolean
  count: number
  /** A step, `finish` (everything done or passed, not yet ended), or `null` once over. */
  resume: StepSlug | 'finish' | null
  steps: OnboardingStepAnswer[]
  can_skip_rest: boolean
  varieties_count: number
  stock_entries_count: number
  price_target: OnboardingTarget | null
  priced_target: OnboardingTarget | null
  stock_target: OnboardingTarget | null
}

const PATH = '/onboarding-progress'

export function getOnboardingProgress(): Promise<OnboardingProgress> {
  return get<OnboardingProgress>(PATH)
}

export function sendPass(step: OptionalStepSlug, way: PassWay): Promise<OnboardingProgress> {
  return post<OnboardingProgress>(`${PATH}/passes`, { step, as: way })
}

export function sendSkipRest(): Promise<OnboardingProgress> {
  return post<OnboardingProgress>(`${PATH}/skip-rest`)
}

export function sendAdvance(): Promise<OnboardingProgress> {
  return post<OnboardingProgress>(`${PATH}/advance`)
}

export const onboardingProgressQuery = queryOptions({
  queryKey: keys.onboardingProgress(),
  queryFn: getOnboardingProgress,
  gcTime: 0,
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
})

/** Keeps the answer a write returned, so the next screen reads it without asking again. */
export function keepProgress(queryClient: QueryClient, answer: OnboardingProgress): void {
  queryClient.setQueryData(keys.onboardingProgress(), answer)
}

/** For a step that saved through its owner's route: the answer is now stale. */
export function refreshProgress(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: keys.onboardingProgress() })
}
