/**
 * The content area is the element the owner is looking at while a screen loads: the open modal
 * sheet's body, otherwise `Shell`'s `main`, the getting-in screens' centred column or
 * `OnboardingLayout`'s column (CODING_STANDARDS §10 item 7). It is named once, here, by the
 * attribute `components/ContentArea.tsx` renders on it. The components import this constant and the
 * phone probe receives it as an argument, so no other file spells a content-area selector.
 *
 * This file imports nothing and holds no DOM types: the probe serialises it into the page.
 */
export const CONTENT_AREA = {
  attribute: 'data-content-area',
  any: '[data-content-area]',
  modal: '[data-content-area][role="dialog"][aria-modal="true"]',
} as const
