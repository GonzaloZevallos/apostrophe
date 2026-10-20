/**
 * Every text the front shows, one section file per area (ADR-0049). A section is a
 * namespace here, so two sections may name an entry the same way. Screens import from the
 * section file they need; this index is the one list of the sections.
 */

export * as analysis from './analysis.ts'
export * as auth from './auth.ts'
export * as catalog from './catalog.ts'
export * as common from './common.ts'
export * as customers from './customers.ts'
export * as expenses from './expenses.ts'
export * as format from './format.ts'
export * as home from './home.ts'
export * as onboarding from './onboarding.ts'
export * as refusals from './refusals.ts'
export * as sales from './sales.ts'
export * as settings from './settings.ts'
export * as shell from './shell.ts'
export * as states from './states.ts'
export * as stock from './stock.ts'
export * as varieties from './varieties.ts'
