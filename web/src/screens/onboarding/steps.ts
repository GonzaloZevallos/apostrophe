/**
 * The Onboarding's six steps, in order (docs/product/onboarding.md): the one place the
 * front names a step's path, title, why and the words that name it in the notice and in
 * "Listo". Which of them is done, passed or next is never decided here: the API answers it
 * (`/onboarding-progress`). A step is named by the API's slug, never by its number.
 */

import type { OptionalStepSlug, StepSlug } from '../../api/onboarding'
import {
  ONBOARDING_BOT,
  ONBOARDING_CATALOG_MESSAGE,
  ONBOARDING_CATEGORIES,
  ONBOARDING_PARTNER,
  ONBOARDING_STOCK,
  ONBOARDING_VARIETY,
} from '../../routes'
import * as copy from '../../copy/onboarding'

/** The API's slugs, answers and states: codes, never shown. */
export const SLUG = {
  variety: 'variety',
  stock: 'stock',
  header_footer: 'header_footer',
  bot: 'bot',
  partner: 'partner',
  categories: 'categories',
} as const
export const PASS = { done: 'done', skipped: 'skipped' } as const
export const STATE = { pending: 'pending' } as const
export const FAILURE = { offline: 'offline', error: 'error' } as const

export interface StepInfo {
  slug: StepSlug
  path: string
  required: boolean
  title: string
  why: string
  /** How the notice names it after "Missing:". */
  shortName: string
  /** How "Listo" names it. */
  name: string
  /** Where a skipped step is done later: "Settings → <group>". */
  later: string
}

export const STEPS: readonly StepInfo[] = [
  {
    slug: SLUG.variety,
    path: ONBOARDING_VARIETY,
    required: true,
    title: copy.STEP_VARIETY_TITLE,
    why: copy.STEP_VARIETY_WHY,
    shortName: copy.STEP_VARIETY_SHORT,
    name: copy.STEP_VARIETY_NAME,
    later: copy.LATER_VARIETIES,
  },
  {
    slug: SLUG.stock,
    path: ONBOARDING_STOCK,
    required: true,
    title: copy.STEP_STOCK_TITLE,
    why: copy.STEP_STOCK_WHY,
    shortName: copy.STEP_STOCK_SHORT,
    name: copy.STEP_STOCK_NAME,
    later: copy.LATER_VARIETIES,
  },
  {
    slug: SLUG.header_footer,
    path: ONBOARDING_CATALOG_MESSAGE,
    required: false,
    title: copy.STEP_MESSAGE_TITLE,
    why: copy.STEP_MESSAGE_WHY,
    shortName: copy.STEP_MESSAGE_SHORT,
    name: copy.STEP_MESSAGE_NAME,
    later: copy.laterIn(copy.STEP_MESSAGE_GROUP),
  },
  {
    slug: SLUG.bot,
    path: ONBOARDING_BOT,
    required: false,
    title: copy.STEP_BOT_TITLE,
    why: copy.STEP_BOT_WHY,
    shortName: copy.STEP_BOT_SHORT,
    name: copy.STEP_BOT_NAME,
    later: copy.laterIn(copy.STEP_BOT_GROUP),
  },
  {
    slug: SLUG.partner,
    path: ONBOARDING_PARTNER,
    required: false,
    title: copy.STEP_PARTNER_TITLE,
    why: copy.STEP_PARTNER_WHY,
    shortName: copy.STEP_PARTNER_SHORT,
    name: copy.STEP_PARTNER_NAME,
    later: copy.laterIn(copy.STEP_PARTNER_GROUP),
  },
  {
    slug: SLUG.categories,
    path: ONBOARDING_CATEGORIES,
    required: false,
    title: copy.STEP_CATEGORIES_TITLE,
    why: copy.STEP_CATEGORIES_WHY,
    shortName: copy.STEP_CATEGORIES_SHORT,
    name: copy.STEP_CATEGORIES_NAME,
    later: copy.laterIn(copy.STEP_CATEGORIES_GROUP),
  },
]

export const STEP_COUNT = STEPS.length

export function stepInfo(slug: StepSlug): StepInfo {
  const found = STEPS.find((step) => step.slug === slug)
  if (found === undefined) throw new Error(`unknown onboarding step: ${slug}`)
  return found
}

export function stepNumber(slug: StepSlug): number {
  return STEPS.findIndex((step) => step.slug === slug) + 1
}

export function isOptional(slug: StepSlug): slug is OptionalStepSlug {
  return !stepInfo(slug).required
}

/** The first step has no step before it: no "Back". */
export function isFirst(slug: StepSlug): boolean {
  return stepNumber(slug) === 1
}

/** The last step has no step after it: no "Skip the rest". */
export function isLast(slug: StepSlug): boolean {
  return stepNumber(slug) === STEP_COUNT
}

/** The step path before this one, or `undefined` on the first. */
export function previousPath(slug: StepSlug): string | undefined {
  return STEPS[stepNumber(slug) - 2]?.path
}

/** The sentence under a skippable step's buttons, saying where it can be done later. */
export function laterHint(info: StepInfo): string {
  return copy.laterHint(info.later)
}
