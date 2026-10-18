/**
 * Asserts where the page is, from the route constants of `routes.ts` and never from a path
 * written here: `expectPath(page, SALE)` takes the template `/sales/:id` and accepts any
 * numeric id; `expectPath(page, EXPENSES, '?month=2026-01')` also pins the query string.
 */

import { expect } from '../fixtures.js'
import type { Page } from '@playwright/test'

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The regex a template stands for: a `:name` segment is a run of digits, the rest is literal. */
export function templateRegex(
  template: string,
  query: string | RegExp = "",
): RegExp {
  const path = template
    .split(/\//)
    .map((segment) => (segment.startsWith(":") ? "\\d+" : escaped(segment)))
    .join("\\/");
  const tail = typeof query === "string" ? escaped(query) : query.source;
  return new RegExp(`${path}${tail}$`);
}

export async function expectPath(
  page: Page,
  template: string,
  query: string | RegExp = "",
): Promise<void> {
  await expect(page).toHaveURL(templateRegex(template, query));
}

/** Where the page is when either of two screens is right: Variedades on a computer opens its
 * first variety, so `/varieties` and `/varieties/:id` are the same place for a seller. */
export async function expectAnyPath(
  page: Page,
  templates: readonly string[],
): Promise<void> {
  const alternatives = templates.map((template) => templateRegex(template).source.replace(/\$$/, ""));
  await expect(page).toHaveURL(new RegExp(`(?:${alternatives.join("|")})$`));
}
