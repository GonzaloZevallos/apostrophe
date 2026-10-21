/**
 * The step frame's two leave details, shared with its tests and registered in
 * `LIMITED_COPY` so `copy/copyLimits.test.ts` measures the very bindings the dialogs show.
 */

import type { LimitedCopy } from './limits'
import { STOCK_TEXT } from './stock.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const DISCARD_DETAIL = 'What you typed is lost: nothing has been saved yet.'
/** For a step that has already saved part of its work: the variety is kept, the price typed is not. */
export const PARTLY_SAVED_DETAIL = 'The variety is already saved; the price you typed is lost.'

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'help', text: DISCARD_DETAIL },
  { kind: 'help', text: PARTLY_SAVED_DETAIL },
]

export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const ONBOARDING_TEXT = {
  continue: 'Continue',
  varietyWithPriceLower: 'variety with price',
  initialStockLower: 'initial stock',
  partnerLower: 'partner',
  varietyOne: STOCK_TEXT.varietyOne,
  varietyMany: STOCK_TEXT.varietyMany,
  entryOne: 'entry',
  entryMany: 'entries',
  leaveAsIs: 'Leave as is',
  stepsCount: (done: string | number, total: string | number) => `${done} of ${total} steps`,
  thisIsWhatGotSetUp: 'This is what got set up in your business.',
  addMyFirstSale: 'Add my first sale',
  goToHome: 'Go to Home',
  missing: (shortName: string | number) => `Missing: ${shortName}`,
  back: 'Back',
  stepOf: (slug: string | number, total: string | number) => `Step ${slug} of ${total}`,
  skip: 'Skip',
  skipTheRest: 'Skip the rest',
  anotherToAddNow: 'Have another to add now? Each one takes its name, its price and its initial stock.',
  withTodaysPriceAndStock: 'With today\'s price and its initial stock',
  firstAddAVariety: 'First add a variety with today\'s price.',
  addAVariety: 'Add a variety',
  varietyNamed: (name: string | number) => `Variety: ${name}`,
  saveTheVariety: 'Save the variety',
  publishItFromVarieties: 'Whenever you like, publish it from Varieties → Send catalog',
  forLaterIn: (later: string | number) => `For later — in ${later}`,
  doneWith: (detail: string | number) => `Done · ${detail}`,
  goOnToTheSetup: 'Go on to the setup',
  discardWhatYouTyped: 'Discard what you typed?',
  createTheLink: 'Create the link',
  addYourFirstVariety: 'Add your first variety',
  toSellEachVarietyNeeds: 'To sell, each variety needs a name and today\'s price.',
  withoutStockItCannotBeSold: 'Without stock it can\'t be sold: tell us how many grams you have of this variety.',
  howYourCatalogLooks: 'How your catalog looks',
  headerAndFooterGoOnEveryCatalog: 'The header and footer go on every catalog you send. They already have a text: leave it as is or change it.',
  catalogMessageLower: 'catalog message',
  settingsCatalogMessage: 'Settings → Catalog message',
  connectYourTelegramBot: 'Connect your Telegram bot',
  withTheBot: 'With the bot, your catalog is published and kept up to date in your channel on its own.',
  settingsIntegrations: 'Settings → Integrations',
  sendTheLinkToYourPartner: 'Send the link to your partner',
  withTheLinkYourPartner: 'With the link your partner joins this business and sees the same as you. They don\'t need to join now.',
  settingsUsers: 'Settings → Users',
  theyOrganiseWhatYouSpend: 'They organise what you spend. You already have the most common ones: add, rename or remove the ones you want.',
  expenseCategoriesLower: 'expense categories',
  settingsExpenseCategories: 'Settings → Expense categories',
  ifYouSkipIt: (later: string | number) => `If you skip it, you can do it later in ${later}.`,
} as const
