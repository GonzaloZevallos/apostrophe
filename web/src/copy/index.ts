/**
 * Every text the front shows, one section file per area (ADR-0048). A section is a
 * namespace here, so two sections may name an entry the same way. Screens import from the
 * section file they need; this index is the one list of the sections.
 */

export * as analysis from './analysis'
export * as auth from './auth'
export * as catalog from './catalog'
export * as common from './common'
export * as customers from './customers'
export * as expenses from './expenses'
export * as format from './format'
export * as home from './home'
export * as onboarding from './onboarding'
export * as refusals from './refusals'
export * as sales from './sales'
export * as settings from './settings'
export * as shell from './shell'
export * as states from './states'
export * as stock from './stock'
export * as varieties from './varieties'
