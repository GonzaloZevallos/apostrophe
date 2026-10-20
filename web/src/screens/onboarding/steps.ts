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
import { ONBOARDING_TEXT } from '../../copy/onboarding'
import { COMMON_TEXT } from '../../copy/common'
import { STEP_STOCK_ENTRY } from '../../copy/inicio'

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
    title: ONBOARDING_TEXT.cargaTuPrimeraVariedad,
    why: ONBOARDING_TEXT.paraVenderCadaVariedad,
    shortName: 'variedad con precio',
    name: COMMON_TEXT.variedadConPrecio,
    later: COMMON_TEXT.variedades,
  },
  {
    slug: 'stock',
    path: ONBOARDING_STOCK,
    required: true,
    title: STEP_STOCK_ENTRY,
    why: ONBOARDING_TEXT.sinStockNoSe,
    shortName: 'stock inicial',
    name: COMMON_TEXT.stockInicial,
    later: COMMON_TEXT.variedades,
  },
  {
    slug: 'header_footer',
    path: ONBOARDING_CATALOG_MESSAGE,
    required: false,
    title: ONBOARDING_TEXT.comoSaleTuCatalogo,
    why: ONBOARDING_TEXT.elEncabezadoYEl,
    shortName: ONBOARDING_TEXT.mensajeDelCatalogo,
    name: COMMON_TEXT.mensajeDelCatalogo,
    later: ONBOARDING_TEXT.configuracionMensajeDelCatalogo,
  },
  {
    slug: 'bot',
    path: ONBOARDING_BOT,
    required: false,
    title: ONBOARDING_TEXT.conectaTuBotDe,
    why: ONBOARDING_TEXT.conElBotTu,
    shortName: ONBOARDING_TEXT.botDeTelegram,
    name: COMMON_TEXT.botDeTelegram,
    later: ONBOARDING_TEXT.configuracionIntegraciones,
  },
  {
    slug: 'partner',
    path: ONBOARDING_PARTNER,
    required: false,
    title: ONBOARDING_TEXT.envialeElLinkA,
    why: ONBOARDING_TEXT.conElLinkTu,
    shortName: 'socio',
    name: COMMON_TEXT.socio,
    later: ONBOARDING_TEXT.configuracionUsuarios,
  },
  {
    slug: 'categories',
    path: ONBOARDING_CATEGORIES,
    required: false,
    title: COMMON_TEXT.categoriasDeGastos,
    why: ONBOARDING_TEXT.ordenanLoQueGastas,
    shortName: ONBOARDING_TEXT.categoriasDeGastos,
    name: COMMON_TEXT.categoriasDeGastos,
    later: ONBOARDING_TEXT.configuracionCategoriasDeGastos,
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

/** The first step has no step before it: no "Atrás". */
export function isFirst(slug: StepSlug): boolean {
  return stepNumber(slug) === 1
}

/** The last step has no step after it: no "Saltar el resto". */
export function isLast(slug: StepSlug): boolean {
  return stepNumber(slug) === STEP_COUNT
}

/** The step path before this one, or `undefined` on the first. */
export function previousPath(slug: StepSlug): string | undefined {
  return STEPS[stepNumber(slug) - 2]?.path
}

/** The sentence under a skippable step's buttons, saying where it can be done later. */
export function laterHint(info: StepInfo): string {
  return ONBOARDING_TEXT.siLoSalteasLo(info.later)
}
