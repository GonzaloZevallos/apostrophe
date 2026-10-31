/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isValidElement } from "react";
import { matchRoutes, type RouteObject } from "react-router";
import { describe, expect, test } from "vitest";
import screensJson from "../../scripts/design/screens.json";
import { ROUTE_REGISTRY } from "./mobile-standard/registry";
import { patternsMatch } from "./mobile-standard/routeCoverage";
import { router } from "./router";
import { consumePaymentReturn, peekPaymentReturn } from "./paymentReturn";
import { SHELL_TEXT } from "./copy/shell";
import { INTEGRATIONS_LINK_WORD } from "./copy/pinnedCatalog";
import { englishBundle } from "./i18n/resources";
import { resolveKey } from "./i18n/resolve";
import * as routes from "./routes";
import {
  isPublicPath,
  OUTSIDE,
  parentOf,
  pathTo,
  paymentLink,
  placeOf,
  readPaymentUnderneath,
  SCREENS,
  screenOf,
  type Kind,
  type ParentRef,
  type Place,
  type ScreenId,
  type Viewport,
} from "./routes";
import OnboardingLayout from "./screens/onboarding/OnboardingLayout";
import Shell from "./shell/Shell";

const VIEWPORTS: Viewport[] = ["phone", "computer"];

interface Expected {
  kind: Kind;
  /** The parent's id on each viewport, `undefined` for a root. */
  parent: { phone: ScreenId; computer: ScreenId } | undefined;
  place: Place;
}

function same(parent: ScreenId | undefined) {
  return parent === undefined ? undefined : { phone: parent, computer: parent };
}

function expectation(
  kind: Kind,
  parent: ScreenId | undefined,
  place: Place,
): Expected {
  return { kind, parent: same(parent), place };
}

const HOME_PLACE: Place = { bar: "home", rail: "home" };
const SALES_PLACE: Place = { bar: "sales", rail: "sales" };
const CUSTOMERS_PLACE: Place = { bar: "customers", rail: "customers" };
const VARIETIES_PLACE: Place = { bar: "varieties", rail: "varieties" };
const EXPENSES_PLACE: Place = { bar: "more", rail: "expenses" };
const SETTINGS_PLACE: Place = { bar: "more", rail: "business" };

/** navigation.md's structure, said once more here and independently of `routes.ts`. */
const EXPECTED: Record<ScreenId, Expected> = {
  home: expectation("root", undefined, HOME_PLACE),
  more: expectation("root", undefined, { bar: "more", rail: "more" }),
  sales: expectation("root", undefined, SALES_PLACE),
  "sale-new": expectation("form", "sales", SALES_PLACE),
  sale: expectation("card", "sales", SALES_PLACE),
  customers: expectation("root", undefined, CUSTOMERS_PLACE),
  "customer-new": expectation("form", "customers", CUSTOMERS_PLACE),
  customer: expectation("card", "customers", CUSTOMERS_PLACE),
  "customer-edit": expectation("form", "customer", CUSTOMERS_PLACE),
  "customer-payment": expectation("form", "customers", CUSTOMERS_PLACE),
  varieties: expectation("root", undefined, VARIETIES_PLACE),
  variety: expectation("card", "varieties", VARIETIES_PLACE),
  "variety-new": expectation("form", "varieties", VARIETIES_PLACE),
  "variety-prices": expectation("card", "variety", VARIETIES_PLACE),
  "variety-price-new": expectation("form", "variety", VARIETIES_PLACE),
  "variety-entries": expectation("card", "variety", VARIETIES_PLACE),
  catalog: expectation("card", "varieties", VARIETIES_PLACE),
  stock: expectation("card", "varieties", VARIETIES_PLACE),
  "stock-entry-new": expectation("form", "varieties", VARIETIES_PLACE),
  "stock-entry": expectation("form", "stock", VARIETIES_PLACE),
  "varieties-archived": expectation("card", "varieties", VARIETIES_PLACE),
  "withdrawal-new": expectation("form", "varieties", VARIETIES_PLACE),
  withdrawal: expectation("card", "varieties", VARIETIES_PLACE),
  "withdrawal-edit": expectation("form", "withdrawal", VARIETIES_PLACE),
  expenses: expectation("root", undefined, EXPENSES_PLACE),
  "expense-new": expectation("form", "expenses", EXPENSES_PLACE),
  analysis: expectation("root", undefined, { bar: "more", rail: "analysis" }),
  // Configuración's list is the one screen whose parent differs by viewport.
  settings: {
    kind: "card",
    parent: { phone: "more", computer: "home" },
    place: SETTINGS_PLACE,
  },
  "settings-business": expectation("form", "settings", SETTINGS_PLACE),
  "settings-users": expectation("form", "settings", SETTINGS_PLACE),
  "settings-prices": expectation("form", "settings", SETTINGS_PLACE),
  "settings-integrations": expectation("form", "settings", SETTINGS_PLACE),
  "settings-catalog-message": expectation("form", "settings", SETTINGS_PLACE),
  "settings-expense-categories": expectation(
    "form",
    "settings",
    SETTINGS_PLACE,
  ),
  "settings-appearance": expectation("form", "settings", SETTINGS_PLACE),
  "settings-account": expectation("form", "settings", SETTINGS_PLACE),
  // The Onboarding's steps and "Done": forms whose parent is Inicio (onboarding.md).
  onboarding: expectation("form", "home", HOME_PLACE),
  "onboarding-variety": expectation("form", "home", HOME_PLACE),
  "onboarding-stock": expectation("form", "home", HOME_PLACE),
  "onboarding-catalog-message": expectation("form", "home", HOME_PLACE),
  "onboarding-bot": expectation("form", "home", HOME_PLACE),
  "onboarding-partner": expectation("form", "home", HOME_PLACE),
  "onboarding-categories": expectation("form", "home", HOME_PLACE),
  "onboarding-done": expectation("form", "home", HOME_PLACE),
};

const ids = SCREENS.map((entry) => entry.id);

describe("parentOf and placeOf, every screen on both viewports", () => {
  test("the table says something about exactly the declared screens", () => {
    expect([...ids].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  test.each(
    ids.flatMap((id) => VIEWPORTS.map((viewport) => [id, viewport] as const)),
  )("%s on the %s", (id, viewport) => {
    const expected = EXPECTED[id];
    const parentId = expected.parent?.[viewport];
    const parent = parentOf(id, viewport);

    expect(parent?.id).toBe(parentId);
    if (parentId !== undefined) {
      const declared = SCREENS.find((entry) => entry.id === parentId);
      expect(parent).toEqual({
        id: parentId,
        path: declared?.path,
        titleKey: declared?.titleKey,
      });
    }
    expect(placeOf(id, viewport)).toEqual(expected.place);
    expect(SCREENS.find((entry) => entry.id === id)?.kind).toBe(expected.kind);
  });

  test("a card and a form have a parent, a root none; every chain ends at a root", () => {
    for (const entry of SCREENS) {
      for (const viewport of VIEWPORTS) {
        expect(parentOf(entry.id, viewport) === undefined).toBe(
          entry.kind === "root",
        );
        let hops = 0;
        let current: ScreenId | undefined = entry.id;
        while (current !== undefined) {
          expect(
            hops++,
            `${entry.id} on the ${viewport}: a parent cycle`,
          ).toBeLessThan(ids.length);
          current = parentOf(current, viewport)?.id;
        }
      }
    }
  });

  test("the label and the back fallback are one result: Configuración says Más on the phone, Inicio on a computer", () => {
    expect(parentOf("settings", "phone")).toMatchObject({
      titleKey: "common:more",
      path: routes.MORE,
    });
    expect(parentOf("settings", "computer")).toMatchObject({
      titleKey: "common:home",
      path: routes.HOME,
    });
  });
});

describe("the screens that are a modal on a computer", () => {
  test("are the price form and Registrar cobro, and no other: the rail goes only for a declared one", () => {
    const modals = SCREENS.filter((entry) => "modalOnComputer" in entry && entry.modalOnComputer === true).map((entry) => entry.id);
    expect(modals.sort()).toEqual(["customer-payment", "variety-price-new"]);
  });
});

describe("the screens a phone draws as a Sheet (`sheetOnPhone`)", () => {
  test("are the nine route-drawn forms, and no other: a phone leaves the page under them where it is", () => {
    const sheets = SCREENS.filter((entry) => "sheetOnPhone" in entry && entry.sheetOnPhone === true).map((entry) => entry.id);
    expect(sheets.sort()).toEqual([
      "customer-edit",
      "customer-new",
      "expense-new",
      "stock-entry",
      "stock-entry-new",
      "variety-new",
      "variety-price-new",
      "withdrawal-edit",
      "withdrawal-new",
    ]);
  });

  test("a full-screen form such as the new sale is not one", () => {
    expect(SCREENS.find((entry) => entry.id === "sale-new")).not.toHaveProperty("sheetOnPhone");
  });
});

describe("the new stock entry form's parent", () => {
  const VARIEDADES: ParentRef = { id: "varieties", path: "/varieties", titleKey: "common:varieties" };

  test("is Variedades, and editing an entry keeps Todas las entradas", () => {
    expect(parentOf("stock-entry-new", "phone")).toEqual(VARIEDADES);
    expect(parentOf("stock-entry-new", "computer")).toEqual(VARIEDADES);
    expect(parentOf("stock-entry", "phone")).toEqual({ id: "stock", path: "/varieties/entries", titleKey: "common:allEntries" });
  });
});

/** Every leaf of the route table, with whether it sits under `Shell` or under the
 * Onboarding's own frame, `OnboardingLayout`. */
function leaves(
  table: readonly RouteObject[],
  underShell: boolean,
  underOnboarding = false,
): { route: RouteObject; underShell: boolean; underOnboarding: boolean }[] {
  return table.flatMap((route) => {
    const shell =
      underShell ||
      (isValidElement(route.element) && route.element.type === Shell);
    const onboarding =
      underOnboarding ||
      (isValidElement(route.element) &&
        route.element.type === OnboardingLayout);
    return route.children === undefined
      ? [{ route, underShell: shell, underOnboarding: onboarding }]
      : leaves(route.children, shell, onboarding);
  });
}

function screenIdOf(route: RouteObject): unknown {
  const handle: unknown = route.handle;
  return typeof handle === "object" && handle !== null && "screen" in handle
    ? handle.screen
    : undefined;
}

describe("the router against the registry", () => {
  const all = leaves(router.routes, false);

  test("every leaf under Shell or OnboardingLayout is a registered screen at its registered path", () => {
    const inShell = all.filter((leaf) => leaf.underShell || leaf.underOnboarding);
    expect(inShell.map((leaf) => screenIdOf(leaf.route)).sort()).toEqual(
      [...ids].sort(),
    );
    for (const { route } of inShell) {
      const entry = SCREENS.find(
        (candidate) => candidate.id === screenIdOf(route),
      );
      expect(route.path).toBe(entry?.path);
    }
  });

  test("every other leaf is a declared outside route, and none is both", () => {
    const outsidePaths = OUTSIDE.map((entry) => entry.path);
    const elsewhere = all.filter(
      (leaf) => !leaf.underShell && !leaf.underOnboarding,
    );
    expect(elsewhere.map((leaf) => leaf.route.path).sort()).toEqual(
      [...outsidePaths].sort(),
    );
    for (const { route } of elsewhere)
      expect(screenIdOf(route)).toBeUndefined();
    for (const entry of SCREENS) expect(outsidePaths).not.toContain(entry.path);
  });

  test("the Onboarding's screens, and only they, are outside Shell: no bar, no rail, no \"+ Nueva venta\"", () => {
    for (const leaf of all.filter((candidate) => candidate.underOnboarding)) {
      expect(leaf.underShell).toBe(false);
      expect(routes.ONBOARDING_SCREENS.has(screenIdOf(leaf.route) as ScreenId)).toBe(true);
    }
    for (const id of routes.ONBOARDING_SCREENS) {
      const entry = SCREENS.find((candidate) => candidate.id === id);
      const matches = matchRoutes(router.routes, entry?.path ?? "") ?? [];
      const types = matches.map((match) =>
        isValidElement(match.route.element) ? match.route.element.type : null,
      );
      expect(types, id).not.toContain(Shell);
      expect(types, id).toContain(OnboardingLayout);
    }
  });

  test("registered paths and ids are unique", () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(SCREENS.map((entry) => entry.path)).size).toBe(
      SCREENS.length,
    );
  });

  test("a path the table does not mount falls through to the catch-all", () => {
    expect(
      matchRoutes(router.routes, "/no-such-screen")?.at(-1)?.route.path,
    ).toBe(routes.CATCH_ALL);
  });

  test("every route of screens.json that is built resolves to a registered path", () => {
    const built = screensJson.screens.flatMap((entry) =>
      entry.route === null ? [] : [entry.route],
    );
    expect(built.length).toBeGreaterThan(20);
    for (const route of built) {
      const concrete = route.replace(/\{[a-z_]+\}/g, "1");
      const leaf = matchRoutes(router.routes, concrete)?.at(-1);
      expect(leaf?.route.path, `${route} is not a route of the table`).not.toBe(
        routes.CATCH_ALL,
      );
      expect(leaf?.pathname).toBe(concrete);
    }
  });
});

/** A registry row as these checks read it: `ROUTE_REGISTRY`'s entries fit it. Paths are
 * compared only through `patternsMatch`, so `/sales/{owing_sale}` and `/sales/:id` are one path. */
interface RegistryRow {
  path: string;
  kind: string;
  parent: string | null;
  /** The parent on a computer, when it is not the phone's. */
  computerParent: string | null;
}

/** The registry's rows of the screens `routes.ts` declares: every row but the public pages. */
const SCREEN_ROWS = ROUTE_REGISTRY.filter(
  (row) => !OUTSIDE.some((page) => patternsMatch(page.path, row.path)),
);

/** What is wrong between the registry's rows and the public pages outside `Shell`: a page with
 * no row, a row that is not a root, or a root with a parent. The catch-all is no screen. */
function outsideDisagreements(
  rows: readonly RegistryRow[],
  pages: readonly routes.Outside[],
): string[] {
  return pages
    .filter((page) => page.path !== routes.CATCH_ALL)
    .flatMap((page) => {
      const row = rows.find((candidate) => patternsMatch(candidate.path, page.path));
      if (row === undefined) return [`${page.path}: no registry row`];
      return [
        ...(row.kind === "root" ? [] : [`${page.path}: kind root is not ${row.kind}`]),
        ...(row.parent === null ? [] : [`${page.path}: a public page has no parent`]),
      ];
    });
}

/** What is wrong between the design registry's rows and the front's screens: a screen with no
 * row, a row whose screen is not declared, or a row that disagrees on kind or parent, on either
 * viewport. Every screen is checked: there is no exemption. */
function registryDisagreements(
  rows: readonly RegistryRow[],
  screens: readonly routes.Screen[],
): string[] {
  const missing = screens
    .filter((s) => !rows.some((row) => patternsMatch(row.path, s.path)))
    .map((s) => `${s.path}: no registry row`);
  const wrong = rows.flatMap((row) => {
    const entry = screens.find((s) => patternsMatch(row.path, s.path));
    if (entry === undefined) return [`${row.path}: no screen declares it`];
    const found: string[] = [];
    if (entry.kind !== row.kind)
      found.push(`${row.path}: kind ${entry.kind} is not ${row.kind}`);
    for (const viewport of VIEWPORTS) {
      const have = parentOf(entry.id, viewport)?.path ?? null;
      const want =
        viewport === "computer" && row.computerParent !== null
          ? row.computerParent
          : row.parent;
      const agree =
        have === null || want === null ? have === want : patternsMatch(have, want);
      if (!agree)
        found.push(
          `${row.path}: parent ${have ?? "none"} on ${viewport} is not ${want ?? "none"}`,
        );
    }
    return found;
  });
  return [...missing, ...wrong];
}

/** The Configuración groups that are not forms: every screen directly under the settings list
 * (a `/settings/…` path whose parent is `settings`), in the front's registry and in the design
 * registry's row for the same path (navigation.md: a group is a form). */
function settingsGroupsNotForms(
  rows: readonly RegistryRow[],
  screens: readonly routes.Screen[],
): string[] {
  return screens
    .filter(
      (s) => s.path.startsWith(`${routes.SETTINGS}/`) && parentOf(s.id, "phone")?.id === "settings",
    )
    .flatMap((s) => {
      const row = rows.find((r) => patternsMatch(r.path, s.path));
      return [
        ...(s.kind === "form" ? [] : [`${s.path}: screen kind ${s.kind}`]),
        ...(row?.kind === "form" ? [] : [`${s.path}: registry kind ${row?.kind}`]),
      ];
    });
}

describe("the registry against screens.json", () => {
  test("every routes.ts screen has a registry row that agrees on path, kind and parent, on both viewports", () => {
    expect(SCREEN_ROWS.length).toBe(SCREENS.length);
    expect(registryDisagreements(SCREEN_ROWS, SCREENS)).toEqual([]);
  });

  test("every public page outside Shell has a root row with no parent, and the registry has no other row", () => {
    expect(outsideDisagreements(ROUTE_REGISTRY, OUTSIDE)).toEqual([]);
    const pages = OUTSIDE.filter((page) => page.path !== routes.CATCH_ALL);
    expect(ROUTE_REGISTRY.length).toBe(SCREENS.length + pages.length);
  });

  test("a public page with no row, or a row that is not a parentless root, is refused", () => {
    const pages: routes.Outside[] = [
      { path: routes.LOGIN },
      { path: routes.INVITATION },
      { path: routes.RESET },
      { path: routes.CATCH_ALL },
    ];
    const rows: RegistryRow[] = [
      { path: routes.LOGIN, kind: "form", parent: null, computerParent: null },
      { path: routes.INVITATION, kind: "root", parent: routes.HOME, computerParent: null },
    ];
    expect(outsideDisagreements(rows, pages)).toEqual([
      `${routes.LOGIN}: kind root is not form`,
      `${routes.INVITATION}: a public page has no parent`,
      `${routes.RESET}: no registry row`,
    ]);
  });

  test("a row that disagrees on kind or parent, names no screen, or is missing, is refused", () => {
    const rows: RegistryRow[] = [
      { path: routes.CUSTOMER_NEW, kind: "card", parent: routes.CUSTOMERS, computerParent: null },
      { path: routes.CUSTOMER_EDIT, kind: "form", parent: routes.CUSTOMERS, computerParent: null },
      { path: routes.SETTINGS, kind: "card", parent: routes.MORE, computerParent: null },
      { path: "nowhere", kind: "form", parent: routes.CUSTOMERS, computerParent: null },
    ];
    const refused = registryDisagreements(rows, SCREENS);
    expect(refused).toContain(`${routes.CUSTOMER_NEW}: kind form is not card`);
    expect(refused).toContain(
      `${routes.CUSTOMER_EDIT}: parent ${routes.CUSTOMER} on phone is not ${routes.CUSTOMERS}`,
    );
    expect(refused).toContain(
      `${routes.SETTINGS}: parent ${routes.HOME} on computer is not ${routes.MORE}`,
    );
    expect(refused).toContain("nowhere: no screen declares it");
    expect(refused).toContain(`${routes.SALES}: no registry row`);
  });

  test("every Configuración group is a form, in the front and in the design registry", () => {
    const groups = SCREENS.filter(
      (s) => s.path.startsWith(`${routes.SETTINGS}/`) && parentOf(s.id, "phone")?.id === "settings",
    );
    expect(groups.length).toBeGreaterThan(0);
    expect(settingsGroupsNotForms(ROUTE_REGISTRY, SCREENS)).toEqual([]);
  });

  test("a Configuración group registered as a card, or with a card row, is refused", () => {
    const asCard = SCREENS.map((s) =>
      s.id === "settings-integrations" ? { ...s, kind: "card" as const } : s,
    );
    expect(settingsGroupsNotForms(ROUTE_REGISTRY, asCard)).toEqual([
      `${routes.SETTINGS_INTEGRATIONS}: screen kind card`,
    ]);
    const rows = ROUTE_REGISTRY.map((r) =>
      patternsMatch(r.path, routes.SETTINGS_CATALOG_MESSAGE) ? { ...r, kind: "card" } : r,
    );
    expect(settingsGroupsNotForms(rows, SCREENS)).toEqual([
      `${routes.SETTINGS_CATALOG_MESSAGE}: registry kind card`,
    ]);
  });
});

describe("a path resolves to its own screen", () => {
  const sample = (path: string): string => pathTo(path, { id: 7 });

  test.each(SCREENS.map((entry) => [entry.id, entry.path] as const))(
    "%s: %s",
    (id, path) => {
      const leaf = matchRoutes(router.routes, sample(path))?.at(-1);
      expect(screenIdOf(leaf?.route ?? {})).toBe(id);
    },
  );

  test("a literal wins over the id that would also match it", () => {
    for (const [literal, id] of [
      [routes.VARIETY_NEW, "variety-new"],
      [routes.STOCK, "stock"],
      [routes.CATALOG, "catalog"],
      [routes.ARCHIVED_VARIETIES, "varieties-archived"],
      [routes.WITHDRAWAL_NEW, "withdrawal-new"],
      [routes.CUSTOMER_NEW, "customer-new"],
      [routes.SALE_NEW, "sale-new"],
    ] as const) {
      const leaf = matchRoutes(router.routes, literal)?.at(-1);
      expect(screenIdOf(leaf?.route ?? {}), literal).toBe(id);
    }
  });
});

/** Screens compare.sh reaches by steps from another route: "Done" opens only from the write
 * that ended the Onboarding, never by loading its own path (onboarding.md). An archived variety's
 * page is reached only by archiving a live one and opening it from "Archived" (varieties.md).
 * The stock entry form of a variety with no entries is opened from that variety's page with
 * "Entrada", so the form preselects "Initial stock" (stock.md). A registry row that reaches its
 * screen by steps is named here, or the route check below reports its route as not its path. */
const REACHED_BY_STEPS = [
  "OnboardingListo",
  "OnboardingListoCompu",
  "OnboardingListoOscuro",
  "OnboardingListoCompuOscuro",
  "OnboardingListoTexto130",
  "OnboardingVariedad",
  "OnboardingVariedadOscuro",
  "OnboardingVariedadCompu",
  "OnboardingVariedadCompuOscuro",
  "OnboardingVariedadTexto130",
  "EntradaStockSinEntradas",
  "EntradaStockSinEntradasOscuro",
  "EntradaStockSinEntradasCompu",
  "EntradaStockSinEntradasCompuOscuro",
  "VariedadArchivada",
  "VariedadArchivadaOscuro",
  "VariedadArchivadaCompu",
  "VariedadArchivadaCompuOscuro",
];

interface RouteEntry {
  readonly screen: string;
  readonly route: string | null;
  readonly path: string;
  readonly steps?: unknown;
}

/** How many businesses the design sample leaves in Onboarding: La Huerta, plus one per name of
 * `ONBOARDING_ACCOUNTS` in scripts/design/sample_app.py (#237), read from that file so the bound
 * moves in the same diff as the seed. */
function sampleOnboardingBusinesses(): number {
  const source = readFileSync(
    resolve(process.cwd(), "..", "scripts/design/sample_app.py"),
    "utf-8",
  );
  const declared = /^ONBOARDING_ACCOUNTS = \(([^)]*)\)/m.exec(source)?.[1];
  if (declared === undefined) throw new Error("sample_app.py declares no ONBOARDING_ACCOUNTS");
  return 1 + (declared.match(/"[^"]+"/g) ?? []).length;
}

/** What is wrong with the rows that end the Onboarding: reaching "Done" ends a business's
 * Onboarding for good, so one capture can do it per business of the sample (ADR-0036 §7). */
function listoRowsOverBound(
  rows: readonly { readonly screen: string; readonly steps?: readonly unknown[] }[],
  businesses: number,
): string[] {
  const ending = rows.filter((row) =>
    (row.steps ?? []).some(
      (step) =>
        typeof step === "object" && step !== null && "click" in step && step.click === "Skip the rest",
    ),
  );
  return ending.length <= businesses
    ? []
    : [
        `${ending.length} rows click "Skip the rest" but the sample has ${businesses} ${businesses === 1 ? "business" : "businesses"} in Onboarding: "Done" ends a business's Onboarding for good, so it is reached once per business (ADR-0036 §7). Rows: ${ending.map((row) => row.screen).join(", ")}`,
      ];
}

/** The screens of screens.json that may have `route: null` (not built yet), each with the issue
 * that builds it. It can only shrink: an entry leaves when its screen is built. */
const NULL_ROUTE_CEILING: Readonly<Record<string, number>> = Object.freeze({});

/** What is wrong with the routes of these entries: a null route that is not on the ceiling, or a
 * route that is not the path. */
function routeProblems(
  entries: readonly RouteEntry[],
  ceiling: Readonly<Record<string, number>> = NULL_ROUTE_CEILING,
): string[] {
  return entries.flatMap((entry) => {
    if (entry.route === null)
      return Object.keys(ceiling).includes(entry.screen)
        ? []
        : [`${entry.screen}: route is null, so it is not built`];
    if (REACHED_BY_STEPS.includes(entry.screen))
      return "steps" in entry ? [] : [`${entry.screen}: reached by steps, so it needs steps`];
    return entry.route === entry.path
      ? []
      : [`${entry.screen}: route ${entry.route} is not path ${entry.path}`];
  });
}

/** What is wrong with the ceiling against these entries: a key that is no row, a key whose row
 * has a route, or an issue number that is not a positive integer. */
function ceilingProblems(
  entries: readonly RouteEntry[],
  ceiling: Readonly<Record<string, number>>,
): string[] {
  return Object.entries(ceiling).flatMap(([screen, issue]) => {
    const row = entries.find((entry) => entry.screen === screen);
    const found: string[] = [];
    if (row === undefined)
      found.push(`${screen}: on the null-route ceiling but no row of screens.json`);
    else if (row.route !== null)
      found.push(`${screen}: on the null-route ceiling but its route is not null`);
    if (!Number.isInteger(issue) || issue < 1)
      found.push(`${screen}: its issue number is not a positive integer`);
    return found;
  });
}

/** A null-route row whose path is some built row's route: the unbuilt screen would shadow it. */
function nullPathProblems(entries: readonly RouteEntry[]): string[] {
  const built = entries.flatMap((entry) => (entry.route === null ? [] : [entry.route]));
  return entries
    .filter((entry) => entry.route === null && built.includes(entry.path))
    .map((entry) => `${entry.screen}: its path ${entry.path} is a built row's route`);
}

describe("screens.json against the English routes", () => {
  test("route is path for every screen, and none is null", () => {
    expect(routeProblems(screensJson.screens)).toEqual([]);
  });

  test("every ceiling entry is a null-route row, with a positive issue number", () => {
    expect(ceilingProblems(screensJson.screens, NULL_ROUTE_CEILING)).toEqual([]);
  });

  test("a null-route row's path is no built row's route", () => {
    expect(nullPathProblems(screensJson.screens)).toEqual([]);
  });

  test("the ceiling check reports a key with no row, a key whose row has a route, and an issue that is not a positive integer", () => {
    const entries: RouteEntry[] = [
      { screen: "Built", route: "/sales", path: "/sales" },
      { screen: "Unbuilt", route: null, path: "/unbuilt" },
    ];
    expect(ceilingProblems(entries, { Unbuilt: 12 })).toEqual([]);
    expect(
      ceilingProblems(entries, { Ghost: 3, Built: 4, Unbuilt: 0 }),
    ).toEqual([
      "Ghost: on the null-route ceiling but no row of screens.json",
      "Built: on the null-route ceiling but its route is not null",
      "Unbuilt: its issue number is not a positive integer",
    ]);
    expect(ceilingProblems(entries, { Unbuilt: 1.5 })).toEqual([
      "Unbuilt: its issue number is not a positive integer",
    ]);
  });

  test("a null-route row whose path is a built row's route is reported", () => {
    expect(
      nullPathProblems([
        { screen: "Ventas", route: "/sales", path: "/sales" },
        { screen: "VentasVacio", route: null, path: "/sales" },
        { screen: "Nueva", route: null, path: "/sales/new" },
      ]),
    ).toEqual(["VentasVacio: its path /sales is a built row's route"]);
  });

  test("one ceiling keeps the listed null row out of the report and the unlisted one in it, in the same run", () => {
    expect(
      routeProblems(
        [
          { screen: "Listed", route: null, path: "/listed" },
          { screen: "Unlisted", route: null, path: "/unlisted" },
        ],
        { Listed: 9 },
      ),
    ).toEqual(["Unlisted: route is null, so it is not built"]);
  });

  test("the route check reports a null route only off the ceiling, a route that is not the path, and a step-reached screen with no steps", () => {
    expect(
      routeProblems(
        [{ screen: "Listed", route: null, path: "/listed" }],
        { Listed: 9 },
      ),
    ).toEqual([]);
    expect(
      routeProblems([
        { screen: "Inicio", route: "/", path: "/" },
        { screen: "InicioPrimeraVez", route: null, path: "/" },
        { screen: "Ventas", route: "/sales", path: "/sales/new" },
        { screen: "OnboardingListo", route: "/onboarding/categories", path: "/onboarding/done" },
        {
          screen: "OnboardingVariedad",
          route: "/onboarding/stock",
          path: "/onboarding/variety",
          steps: [],
        },
      ]),
    ).toEqual([
      "InicioPrimeraVez: route is null, so it is not built",
      "Ventas: route /sales is not path /sales/new",
      "OnboardingListo: reached by steps, so it needs steps",
    ]);
  });

  test("no more rows end the Onboarding with \"Skip the rest\" than the sample has businesses in Onboarding", () => {
    expect(listoRowsOverBound(screensJson.screens, sampleOnboardingBusinesses())).toEqual([]);
  });

  test("the Listo bound refuses a row that ends the Onboarding of a business that is already finished, and counts La Huerta plus the sample's extra businesses", () => {
    const skip = [{ click: "Skip the rest" }];
    const rows = [
      { screen: "A", steps: skip },
      { screen: "B", steps: skip },
      { screen: "C", steps: [{ click: "Otra cosa" }] },
    ];
    expect(listoRowsOverBound(rows, 2)).toEqual([]);
    expect(listoRowsOverBound(rows, 1)).toEqual([
      expect.stringContaining("2 rows click \"Skip the rest\" but the sample has 1 business in Onboarding"),
    ]);
    expect(listoRowsOverBound(rows, 1)[0]).toContain("ADR-0036");
    expect(sampleOnboardingBusinesses()).toBeGreaterThanOrEqual(2);
  });

  test("every English path of the registry is a screens.json path, with no exemption, and the old Spanish ones are gone", () => {
    const paths = [
      ...screensJson.screens.map((entry) => entry.path),
      ...ROUTE_REGISTRY.map((entry) => entry.path),
    ];
    const registered = [...SCREENS, ...OUTSIDE]
      .filter((entry) => entry.path !== routes.CATCH_ALL)
      .map((entry) => entry.path);
    expect(
      registered.filter((path) => !paths.some((known) => patternsMatch(path, known))),
    ).toEqual([]);
    const everyPath = [...SCREENS, ...OUTSIDE].map((entry) => entry.path);
    for (const spanish of [
      "/ventas",
      "/clientes",
      "/mi-stock",
      "/variedades",
      "/catalogo",
      "/analisis",
      "/entrar",
    ]) {
      expect(
        everyPath.some(
          (path) => path === spanish || path.startsWith(`${spanish}/`),
        ),
        spanish,
      ).toBe(false);
    }
  });

  test("/varieties/entries shows today's entries list, as a card under Variedades", () => {
    const leaf = matchRoutes(router.routes, "/varieties/entries")?.at(-1);
    expect(screenIdOf(leaf?.route ?? {})).toBe("stock");
    expect(parentOf("stock", "phone")?.titleKey).toBe("common:varieties");
  });

  test("routes.ts keeps no legacy list: the old paths live only in app/legacy_front_paths.json", () => {
    expect(Object.keys(routes).filter((name) => name.startsWith("LEGACY"))).toEqual([]);
  });

  test("no old Spanish path of app/legacy_front_paths.json is a front route: the server redirects them", () => {
    const rows: unknown = JSON.parse(
      readFileSync(resolve(process.cwd(), "..", "app/legacy_front_paths.json"), "utf-8"),
    );
    if (!Array.isArray(rows)) throw new Error("legacy_front_paths.json is a list");
    expect(rows.length).toBeGreaterThan(15);
    for (const row of rows as { old: string }[]) {
      const concrete = row.old.replace("{id}", "3");
      expect(matchRoutes(router.routes, concrete)?.at(-1)?.route.path, concrete).toBe(
        routes.CATCH_ALL,
      );
    }
  });
});

describe("the screens whose back names the record", () => {
  test("a variety's page, its prices and its entries are marked backLabel record, and nothing else", () => {
    const marked = SCREENS.filter((entry) => "backLabel" in entry && entry.backLabel === "record").map(
      (entry) => entry.id,
    );
    expect(marked.sort()).toEqual(["variety", "variety-entries", "variety-prices"]);
    for (const id of marked) expect(screenOf(id).kind).toBe("card");
  });
});

describe("the screen Record payment was opened from", () => {
  test.each(["home", "customers", "card"])("%s is read back as itself", (underneath) => {
    expect(readPaymentUnderneath({ underneath })).toBe(underneath);
  });

  test.each([
    ["an unknown screen name", { underneath: "sales" }],
    ["an object", { underneath: { name: "home" } }],
    ["a number", { underneath: 3 }],
    ["a state without it", { from: "/customers" }],
    ["a bare string", "home"],
    ["null", null],
    ["undefined", undefined],
  ])("%s gives the customer's card", (_label, state) => {
    expect(readPaymentUnderneath(state)).toBe("card");
  });

  test("the link helper builds the payment path and writes only the closed screen name", () => {
    expect(paymentLink(7, "home")).toMatchObject({ to: "/customers/7/payment", state: { underneath: "home" } });
    expect(readPaymentUnderneath(paymentLink(7, "customers").state)).toBe("customers");
  });

  test("the link helper opens the payment and leaves nothing in memory", () => {
    consumePaymentReturn();

    const link = paymentLink("7", "customers");

    expect(link).toEqual({ to: "/customers/7/payment", state: { underneath: "customers" } });
    expect(peekPaymentReturn()).toBeNull();
  });

  test("the guard flags a source that sets the hand-off, aliased or not, the link helper included, and passes the save and the module", () => {
    const direct = { path: "src/screens/X.tsx", content: "setPaymentReturn(7)" };
    const aliased = {
      path: "src/screens/Y.tsx",
      content: "import { setPaymentReturn as remember } from '../paymentReturn'\nremember(7)",
    };
    const helper = { path: "src/routes.ts", content: "setPaymentReturn(Number(id))" };
    const save = { path: "src/screens/clientes/CobroRoute.tsx", content: "setPaymentReturn(Number(customerId))" };
    const reader = { path: "src/screens/Z.tsx", content: "import { peekPaymentReturn } from '../paymentReturn'" };

    expect(findHandOffSetters([direct, aliased, helper, save, reader])).toEqual([
      "src/screens/X.tsx",
      "src/screens/Y.tsx",
      "src/routes.ts",
    ]);
  });

  test("the real front sources set the hand-off only in the save of Record payment", () => {
    const modules = import.meta.glob<string>(["/src/**/*.{ts,tsx}", "!/src/**/*.test.{ts,tsx}"], {
      query: "?raw",
      import: "default",
      eager: true,
    });
    const files = Object.entries(modules).map(([path, content]) => ({ path: path.replace(/^\//, ""), content }));
    expect(files.length).toBeGreaterThan(50);
    expect(findHandOffSetters(files)).toEqual([]);
  });
});

describe("pathTo and isPublicPath", () => {
  test("pathTo fills the parameters and refuses a missing one", () => {
    expect(pathTo(routes.CUSTOMER_EDIT, { id: 7 })).toBe("/customers/7/edit");
    expect(() => pathTo(routes.SALE)).toThrow(/needs id/);
  });

  test("only Entrar, an invitation and a reset are public", () => {
    expect(isPublicPath(routes.LOGIN)).toBe(true);
    expect(isPublicPath(pathTo(routes.INVITATION, { token: "abc" }))).toBe(
      true,
    );
    expect(isPublicPath(pathTo(routes.RESET, { token: "abc" }))).toBe(true);
    expect(isPublicPath(routes.SALES)).toBe(false);
    expect(isPublicPath("/invitation/")).toBe(false);
  });
});

interface Source {
  path: string;
  content: string;
}

/** The first segment of every path the registry names: `'ventas'`, `'settings'`, and `''` for Inicio. */
const FIRST_SEGMENTS = new Set([
  ...[...SCREENS, ...OUTSIDE]
    .map((entry) => entry.path)
    .filter((path) => path !== routes.CATCH_ALL)
    .map((path) => path.split("/")[1] ?? ""),
  // The old Spanish spellings: only the server redirects them, and only `routes.ts` names them.
  ...[
    "ventas",
    "clientes",
    "mi-stock",
    "variedades",
    "catalogo",
    "analisis",
    "entrar",
    "mas",
    "gastos",
    "negocio",
  ],
]);

/** A literal that opens with `/`: a quote, the slash and the first segment after it. */
const SLASH_LITERAL = /(?<!\w)(['"`])\/([a-z0-9-]*)/g;

/** A line that talks to the API, whose paths coincide with front paths (`/expenses`, `/sales`). */
const API_LINE =
  /\bfetch\b|\burl\b|\brequest\.|\b(?:get|post|put|patch|del)\s*[<(]|toHaveBeenCalledWith|\bpath\s*[!=]==|\brequested\b/;

function withoutComments(content: string): string[] {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ""))
    .split("\n")
    .map((line) => line.replace(/(^|\s)\/\/.*$/, "$1"));
}

/** Files that write a front path as a string literal instead of a constant of `routes.ts`. */
/** The sources, other than the hand-off module and the save of Record payment, that name the setter (an alias still names it in its import). */
function findHandOffSetters(files: Source[]): string[] {
  return files
    .filter((file) => file.path !== "src/paymentReturn.ts" && file.path !== "src/screens/clientes/CobroRoute.tsx")
    .filter((file) => /\bsetPaymentReturn\b/.test(file.content))
    .map((file) => file.path);
}

function findPathLiterals(files: Source[]): string[] {
  return (
    files
      .filter(
        ({ path }) => path !== "src/routes.ts" && path !== "src/routes.test.ts",
      )
      // `api/` names the server's own routes (`/expenses`), not front paths.
      .filter(({ path }) => !path.startsWith("src/api/"))
      .filter(({ content }) =>
        withoutComments(content)
          // A line that talks to the API, or the argument line of an API call that opens on the one before.
          .filter(
            (line, index, lines) =>
              !API_LINE.test(line) &&
              !(
                API_LINE.test(lines[index - 1] ?? "") &&
                /\(\s*$/.test(lines[index - 1] ?? "")
              ),
          )
          .some((line) =>
            [...line.matchAll(SLASH_LITERAL)].some(
              ([whole, quote, segment]) =>
                segment !== undefined &&
                FIRST_SEGMENTS.has(segment) &&
                // `'/'` alone is Inicio; a bare `/` after a quote is not a path.
                (segment !== "" ||
                  line.startsWith(
                    `${quote ?? ""}/${quote ?? ""}`,
                    line.indexOf(whole),
                  )),
            ),
          ),
      )
      .map(({ path }) => path)
  );
}

/** The two modules allowed to call `matchMedia`: the viewport query and the system theme. */
const MATCH_MEDIA_MODULES = ["src/shell/useViewport.ts", "src/theme/systemTheme.ts"];

/** Files that call `matchMedia`, other than the two modules allowed to. */
function findMatchMediaCalls(files: Source[]): string[] {
  return files
    .filter(({ path }) => !MATCH_MEDIA_MODULES.includes(path))
    .filter(({ path }) => !/\.test\.tsx?$/.test(path))
    .filter(({ content }) =>
      withoutComments(content).some((line) => /\bmatchMedia\s*\(/.test(line)),
    )
    .map(({ path }) => path);
}

/** The names a per-screen path function would have: every path constant of `routes.ts`, plus the
 * retired spellings of #47 (`ENTRY`, `ENTRIES`, `ENTRY_NEW`). A call to one is a path built
 * outside `pathTo`; the registry's template goes through `pathTo`, never through a call. */
const PATH_CONSTANTS = [
  ...Object.entries(routes)
    .filter(([, value]) => typeof value === "string" && value.startsWith("/"))
    .map(([name]) => name),
  "ENTRY",
  "ENTRIES",
  "ENTRY_NEW",
];

/** Files that call a path constant (`VARIETY(id)`, `ENTRY(id)`) as if it were a function. */
function findPathFunctions(files: Source[]): string[] {
  const call = new RegExp(`(?<![\\w.])(?:${PATH_CONSTANTS.join("|")})\\s*\\(`);
  return files
    .filter(({ path }) => path !== "src/routes.ts" && path !== "src/routes.test.ts")
    .filter(({ content }) => withoutComments(content).some((line) => call.test(line)))
    .map(({ path }) => path);
}

describe("source scan for path literals", () => {
  test("flags a per-screen path function in a screen, a test or a spec", () => {
    expect(
      findPathFunctions([
        { path: "src/screens/X.tsx", content: "<Link to={VARIETY(id)}>" },
        { path: "src/screens/Y.tsx", content: "navigate(VARIETY_PRICE_NEW (3))" },
        { path: "src/screens/Y.test.tsx", content: "const to = ENTRY(9)" },
        { path: "e2e/a.spec.ts", content: "await page.goto(SALE(2))" },
        { path: "src/screens/Ok.tsx", content: "<Link to={pathTo(VARIETY, { id })}>" },
        { path: "src/screens/Ok2.tsx", content: "// VARIETY(id) was the old way" },
        { path: "src/screens/Ok3.tsx", content: "useVARIETY(id)" },
      ]),
    ).toEqual(["src/screens/X.tsx", "src/screens/Y.tsx", "src/screens/Y.test.tsx", "e2e/a.spec.ts"]);
  });

  test("flags a file that writes a front path, old or new, in any quote", () => {
    expect(
      findPathLiterals([
        { path: "src/screens/X.tsx", content: `<Link to="/sales">` },
        {
          path: "src/screens/Y.tsx",
          content: "navigate('/settings/users?x=1')",
        },
        { path: "src/screens/Z.tsx", content: "to={`/customers/${id}`}" },
        { path: "src/screens/W.tsx", content: "const a = '/analysis'" },
        { path: "src/screens/S.tsx", content: "page.goto('/gastos')" },
        {
          path: "src/screens/R.tsx",
          content: "await fetch(x)\nnavigate('/sales')",
        },
        { path: "src/screens/V.tsx", content: "navigate('/')" },
        { path: "e2e/a.spec.ts", content: "await page.goto('/more')" },
        {
          path: "src/screens/U.test.tsx",
          content: "initialEntries={['/expenses/new']}",
        },
      ]),
    ).toEqual([
      "src/screens/X.tsx",
      "src/screens/Y.tsx",
      "src/screens/Z.tsx",
      "src/screens/W.tsx",
      "src/screens/S.tsx",
      "src/screens/R.tsx",
      "src/screens/V.tsx",
      "e2e/a.spec.ts",
      "src/screens/U.test.tsx",
    ]);
  });

  test("lets through constants, other paths, API calls, comments, api/ and routes.ts itself", () => {
    expect(
      findPathLiterals([
        { path: "src/screens/X.tsx", content: "<Link to={MORE}>" },
        {
          path: "src/screens/Y.tsx",
          content: "const to = '/algo-que-no-es-una-ruta'",
        },
        {
          path: "src/screens/Z.tsx",
          content: "// goes to '/mas'\n/* '/gastos' */",
        },
        {
          path: "src/screens/A.tsx",
          content: "await post<Saved>('/sales', body)",
        },
        {
          path: "src/screens/A.test.tsx",
          content: "expect(url).toBe('/expenses/9')",
        },
        {
          path: "src/screens/B.test.tsx",
          content:
            "expect(fetch).toHaveBeenCalledWith(\n  '/customers',\n  init)",
        },
        { path: "src/api/me.ts", content: "get('/customers')" },
        { path: "src/routes.ts", content: "export const MORE = '/more'" },
      ]),
    ).toEqual([]);
  });

  test("flags a file that calls matchMedia outside useViewport.ts", () => {
    expect(
      findMatchMediaCalls([
        {
          path: "src/screens/X.tsx",
          content: 'const q = window.matchMedia("(min-width: 900px)")',
        },
        {
          path: "src/shell/useViewport.ts",
          content: "window.matchMedia(QUERY)",
        },
        {
          path: "src/screens/Y.tsx",
          content: "// matchMedia( is only for useViewport",
        },
        {
          path: "src/screens/Y.test.tsx",
          content: "vi.stubGlobal('matchMedia', stub)",
        },
      ]),
    ).toEqual(["src/screens/X.tsx"]);
  });

  test("lets systemTheme.ts call matchMedia and flags the system theme query anywhere else", () => {
    expect(
      findMatchMediaCalls([
        {
          path: "src/theme/systemTheme.ts",
          content: "window.matchMedia('(prefers-color-scheme: dark)')",
        },
        {
          path: "src/theme.ts",
          content: "window.matchMedia('(prefers-color-scheme: dark)').matches",
        },
        {
          path: "src/screens/settings/AppearanceGroup.tsx",
          content: 'const dark = matchMedia("(prefers-color-scheme: dark)")',
        },
      ]),
    ).toEqual(["src/theme.ts", "src/screens/settings/AppearanceGroup.tsx"]);
  });

  test("the real front sources and e2e specs write no route literal and call matchMedia only in useViewport.ts and systemTheme.ts", () => {
    const modules = import.meta.glob<string>(["/src/**/*.{ts,tsx}", "/e2e/**/*.ts"], {
      query: "?raw",
      import: "default",
      eager: true,
    });
    const files = Object.entries(modules).map(([path, content]) => ({
      path: path.replace(/^\//, ""),
      content,
    }));
    expect(files.length).toBeGreaterThan(50);
    expect(findPathLiterals(files)).toEqual([]);
    expect(findPathFunctions(files)).toEqual([]);
    expect(findMatchMediaCalls(files)).toEqual([]);
  });
});

describe("the registry holds keys, and English resolves each to today's title", () => {
  const TITLES: Record<ScreenId, string> = {
    home: "Home",
    more: "More",
    sales: "Sales",
    "sale-new": "New sale",
    sale: "Sale",
    customers: "Customers",
    "customer-new": "New customer",
    customer: "Customer",
    "customer-edit": "Edit customer",
    "customer-payment": "Record payment",
    varieties: "Varieties",
    variety: "Variety",
    "variety-new": "New variety",
    "variety-prices": "Prices",
    "variety-price-new": "New price",
    "variety-entries": "Entries",
    catalog: "Catalog",
    stock: "All entries",
    "stock-entry-new": "Stock entry",
    "stock-entry": "Stock entry",
    "varieties-archived": "Archived",
    "withdrawal-new": "Take from stock",
    withdrawal: "Withdrawal",
    "withdrawal-edit": "Take from stock",
    expenses: "Expenses",
    "expense-new": "New expense",
    analysis: "Analysis",
    settings: "Settings",
    "settings-business": "Business",
    "settings-users": "Users",
    "settings-prices": "Prices",
    "settings-integrations": "Integrations",
    "settings-catalog-message": "Catalog message",
    "settings-expense-categories": "Expense categories",
    "settings-appearance": "Appearance",
    "settings-account": "Your account",
    onboarding: "Getting started",
    "onboarding-variety": "Variety with price",
    "onboarding-stock": "Initial stock",
    "onboarding-catalog-message": "Catalog message",
    "onboarding-bot": "Telegram bot",
    "onboarding-partner": "Partner",
    "onboarding-categories": "Expense categories",
    "onboarding-done": "Done",
  };

  test.each(SCREENS.map((entry) => entry.id))("%s", (id) => {
    expect(resolveKey(englishBundle(), screenOf(id).titleKey)).toBe(TITLES[id]);
  });

  test("shell:sale and shell:integrations equal the English still exported", () => {
    expect(resolveKey(englishBundle(), "shell:sale")).toBe(SHELL_TEXT.sale);
    expect(resolveKey(englishBundle(), "shell:integrations")).toBe(INTEGRATIONS_LINK_WORD);
  });
});
