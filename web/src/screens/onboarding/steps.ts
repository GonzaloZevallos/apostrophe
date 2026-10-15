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

export interface StepInfo {
  slug: StepSlug
  path: string
  required: boolean
  title: string
  why: string
  /** How the notice names it after "Falta:". */
  shortName: string
  /** How "Listo" names it. */
  name: string
  /** Where a skipped step is done later: "Configuración → <group>". */
  later: string
}

export const STEPS: readonly StepInfo[] = [
  {
    slug: 'variety',
    path: ONBOARDING_VARIETY,
    required: true,
    title: 'Cargá tu primera variedad',
    why: 'Para vender, cada variedad necesita un nombre y su precio de hoy.',
    shortName: 'variedad con precio',
    name: 'Variedad con precio',
    later: 'Variedades',
  },
  {
    slug: 'stock',
    path: ONBOARDING_STOCK,
    required: true,
    title: 'Cargá lo que tenés hoy',
    why: 'Sin stock no se puede vender: contanos cuántos gramos tenés de esta variedad.',
    shortName: 'stock inicial',
    name: 'Stock inicial',
    later: 'Variedades',
  },
  {
    slug: 'header_footer',
    path: ONBOARDING_CATALOG_MESSAGE,
    required: false,
    title: 'Cómo sale tu catálogo',
    why: 'El encabezado y el pie van en cada catálogo que mandás. Ya tienen un texto: dejalo así o cambialo.',
    shortName: 'mensaje del catálogo',
    name: 'Mensaje del catálogo',
    later: 'Configuración → Mensaje del catálogo',
  },
  {
    slug: 'bot',
    path: ONBOARDING_BOT,
    required: false,
    title: 'Conectá tu bot de Telegram',
    why: 'Con el bot, tu catálogo se publica y se actualiza solo en tu canal.',
    shortName: 'bot de Telegram',
    name: 'Bot de Telegram',
    later: 'Configuración → Integraciones',
  },
  {
    slug: 'partner',
    path: ONBOARDING_PARTNER,
    required: false,
    title: 'Enviale el link a tu socio',
    why: 'Con el link tu socio entra a este negocio y ve lo mismo que vos. No hace falta que se sume ahora.',
    shortName: 'socio',
    name: 'Socio',
    later: 'Configuración → Usuarios',
  },
  {
    slug: 'categories',
    path: ONBOARDING_CATEGORIES,
    required: false,
    title: 'Categorías de gastos',
    why: 'Ordenan lo que gastás. Ya tenés las más comunes: sumá, renombrá o sacá las que quieras.',
    shortName: 'categorías de gastos',
    name: 'Categorías de gastos',
    later: 'Configuración → Categorías de gastos',
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

/** The step path before this one, or `undefined` on the first. */
export function previousPath(slug: StepSlug): string | undefined {
  return STEPS[stepNumber(slug) - 2]?.path
}

/** The sentence under a skippable step's buttons, saying where it can be done later. */
export function laterHint(info: StepInfo): string {
  return `Si lo salteás, lo hacés después en ${info.later}.`
}
