/** Where an answer leads, at the `afterProgress` seam: the navigation it asks for, in order. */

import { QueryClient } from '@tanstack/react-query'
import { expect, test, vi } from 'vitest'
import type { NavigateFunction } from 'react-router'
import { keys } from '../../api/keys'
import type { OnboardingProgress } from '../../api/onboarding'
import { HOME, ONBOARDING, ONBOARDING_BOT, ONBOARDING_DONE } from '../../routes'
import { afterProgress, openListo } from './afterProgress'

const BASE: OnboardingProgress = {
  offered: true,
  over: false,
  count: 6,
  resume: 'finish',
  steps: [],
  can_skip_rest: true,
  products_count: 1,
  stock_entries_count: 1,
  price_target: null,
  priced_target: null,
  stock_target: null,
}

function setup() {
  const queryClient = new QueryClient()
  const order: string[] = []
  const navigate = vi.fn((...args: unknown[]) => {
    order.push(`navigate ${String(args[0])}`)
    return Promise.resolve()
  })
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success') order.push('keep')
  })
  return { queryClient, navigate, order, asNavigate: navigate as unknown as NavigateFunction }
}

test('a not-over answer with every step done opens /onboarding, so a fresh entry ends it', async () => {
  const { queryClient, navigate, asNavigate } = setup()

  await afterProgress(BASE, asNavigate, queryClient)

  expect(navigate).toHaveBeenCalledOnce()
  expect(navigate).toHaveBeenCalledWith(ONBOARDING)
  expect(queryClient.getQueryData(keys.onboardingProgress())).toEqual(BASE)
})

test('a not-over answer with nothing to resume goes to Inicio', async () => {
  const { queryClient, navigate, asNavigate } = setup()

  await afterProgress({ ...BASE, resume: null }, asNavigate, queryClient)

  expect(navigate).toHaveBeenCalledWith(HOME)
})

test('an over answer opens "Listo" with the flag, as a push, before keeping the answer', async () => {
  const { queryClient, navigate, order, asNavigate } = setup()

  await afterProgress({ ...BASE, over: true, resume: null }, asNavigate, queryClient)

  expect(navigate).toHaveBeenCalledWith(ONBOARDING_DONE, { state: { listo: true }, replace: false })
  expect(order).toEqual([`navigate ${ONBOARDING_DONE}`, 'keep'])
})

test('openListo can replace the entry it is called from', async () => {
  const { queryClient, navigate, asNavigate } = setup()

  await openListo({ ...BASE, over: true, resume: null }, asNavigate, queryClient, { replace: true })

  expect(navigate).toHaveBeenCalledWith(ONBOARDING_DONE, { state: { listo: true }, replace: true })
})

test('a not-over answer naming a step, or a step named by the caller, opens that step', async () => {
  const { queryClient, navigate, asNavigate } = setup()

  await afterProgress({ ...BASE, resume: 'bot' }, asNavigate, queryClient)
  await afterProgress(BASE, asNavigate, queryClient, '/somewhere')

  expect(navigate).toHaveBeenNthCalledWith(1, ONBOARDING_BOT)
  expect(navigate).toHaveBeenNthCalledWith(2, '/somewhere')
})
