/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isValidElement } from "react";
import { matchRoutes, type RouteObject } from "react-router";
import { describe, expect, test } from "vitest";
import screensJson from "../../scripts/design/screens.json";
import { router } from "./router";
import * as routes from "./routes";
import {
  isPublicPath,
  OUTSIDE,
  parentOf,
  pathTo,
  placeOf,
  SCREENS,
  type Kind,
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
  "stock-entry-new": expectation("form", "stock", VARIETIES_PLACE),
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
  // The Onboarding's steps and "Listo": forms whose parent is Inicio (onboarding.md).
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
        title: declared?.title,
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
      title: "Más",
      path: routes.MORE,
    });
    expect(parentOf("settings", "computer")).toMatchObject({
      title: "Inicio",
      path: routes.HOME,
    });
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

/** One shape for a path template: `:name` on the front and `{name}` in screens.json are both
 * `{id}`, so `/sales/{owing_sale}` and `/sales/:id` are the same path. */
function normalise(path: string): string {
  return path.replace(/:[A-Za-z_]+|\{[A-Za-z_]+\}/g, "{id}");
}

interface RegistryRow {
  path: string;
  kind: string;
  parent?: string;
  /** The parent on a computer, when it is not the phone's. */
  computer_parent?: string;
}

/** What is wrong between the design registry's rows and the front's screens: a screen with no
 * row, a row whose screen is not declared, or a row that disagrees on kind or parent, on either
 * viewport. Every screen is checked: there is no exemption. */
function registryDisagreements(
  rows: readonly RegistryRow[],
  screens: readonly routes.Screen[],
): string[] {
  const missing = screens
    .filter((s) => !rows.some((row) => normalise(row.path) === normalise(s.path)))
    .map((s) => `${s.path}: no registry row`);
  const wrong = rows.flatMap((row) => {
    const entry = screens.find((s) => normalise(s.path) === normalise(row.path));
    if (entry === undefined) return [`${row.path}: no screen declares it`];
    const found: string[] = [];
    if (entry.kind !== row.kind)
      found.push(`${row.path}: kind ${entry.kind} is not ${row.kind}`);
    for (const viewport of VIEWPORTS) {
      const parent = parentOf(entry.id, viewport);
      const have = parent === undefined ? undefined : normalise(parent.path);
      const want =
        viewport === "computer" && row.computer_parent !== undefined
          ? row.computer_parent
          : row.parent;
      if (have !== (want === undefined ? undefined : normalise(want)))
        found.push(`${row.path}: parent ${have} on ${viewport} is not ${want}`);
    }
    return found;
  });
  return [...missing, ...wrong];
}

describe("the registry against screens.json", () => {
  test("every routes.ts screen has a registry row that agrees on path, kind and parent, on both viewports", () => {
    expect(screensJson.registry.length).toBe(SCREENS.length);
    expect(registryDisagreements(screensJson.registry, SCREENS)).toEqual([]);
  });

  test("a row that disagrees on kind or parent, names no screen, or is missing, is refused", () => {
    const rows: RegistryRow[] = [
      { path: routes.CUSTOMER_NEW, kind: "card", parent: routes.CUSTOMERS },
      { path: routes.CUSTOMER_EDIT, kind: "form", parent: routes.CUSTOMERS },
      { path: routes.SETTINGS, kind: "card", parent: routes.MORE },
      { path: "nowhere", kind: "form", parent: routes.CUSTOMERS },
    ];
    const refused = registryDisagreements(rows, SCREENS);
    expect(refused).toContain(`${routes.CUSTOMER_NEW}: kind form is not card`);
    expect(refused).toContain(
      `${routes.CUSTOMER_EDIT}: parent ${normalise(routes.CUSTOMER)} on phone is not ${routes.CUSTOMERS}`,
    );
    expect(refused).toContain(
      `${routes.SETTINGS}: parent ${routes.HOME} on computer is not ${routes.MORE}`,
    );
    expect(refused).toContain("nowhere: no screen declares it");
    expect(refused).toContain(`${routes.SALES}: no registry row`);
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

/** Screens whose route is still null or still the old shape: the screen is not built yet, or a later piece flips it. */
const NOT_BUILT = [
  "InicioPrimeraVez",
  "InicioPrimeraVezCompu",
];

/** Screens compare.sh reaches by steps from another route: "Listo" opens only from the write
 * that ended the Onboarding, never by loading its own path (onboarding.md). Its dark and
 * computer rows copy the same route and path, so they are listed too. */
const REACHED_BY_STEPS = ["OnboardingListo", "OnboardingListoOscuro", "OnboardingListoCompu"];

describe("screens.json against the English routes", () => {
  test("route is path for every screen, but the ones not built", () => {
    const wrong = screensJson.screens.flatMap((entry) => {
      if (REACHED_BY_STEPS.includes(entry.screen))
        return "steps" in entry && entry.route !== null
          ? []
          : [`${entry.screen}: reached by steps, so it needs a route and steps`];
      if (NOT_BUILT.includes(entry.screen))
        return entry.route === null
          ? []
          : [`${entry.screen}: built, so route should not be null`];
      return entry.route === entry.path
        ? []
        : [`${entry.screen}: route ${entry.route} is not path ${entry.path}`];
    });
    expect(wrong).toEqual([]);
    expect(
      screensJson.screens
        .filter((entry) => entry.route === null)
        .map((entry) => entry.screen)
        .sort(),
    ).toEqual([...NOT_BUILT].sort());
  });

  test("every English path of the registry is a screens.json path, with no exemption, and the old Spanish ones are gone", () => {
    const paths = new Set([
      ...screensJson.screens.map((entry) => normalise(entry.path)),
      ...screensJson.registry.map((entry) => normalise(entry.path)),
    ]);
    const registered = [...SCREENS, ...OUTSIDE]
      .filter((entry) => entry.path !== routes.CATCH_ALL)
      .map((entry) => normalise(entry.path));
    expect(registered.filter((path) => !paths.has(path))).toEqual([]);
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
    expect(parentOf("stock", "phone")?.title).toBe("Variedades");
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

/** Files that call `matchMedia`, other than `useViewport.ts`, the one allowed to. */
function findMatchMediaCalls(files: Source[]): string[] {
  return files
    .filter(({ path }) => path !== "src/shell/useViewport.ts")
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

  test("the real front sources and e2e specs write no route literal and call matchMedia only in useViewport.ts", () => {
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
