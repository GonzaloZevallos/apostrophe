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
  varieties: expectation("root", undefined, VARIETIES_PLACE),
  variety: expectation("card", "varieties", VARIETIES_PLACE),
  catalog: expectation("card", "varieties", VARIETIES_PLACE),
  stock: expectation("card", "varieties", VARIETIES_PLACE),
  "stock-entry-new": expectation("form", "stock", VARIETIES_PLACE),
  "stock-entry": expectation("form", "stock", VARIETIES_PLACE),
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
  "settings-integrations": expectation("form", "settings", SETTINGS_PLACE),
  "settings-catalog-message": expectation("form", "settings", SETTINGS_PLACE),
  "settings-expense-categories": expectation(
    "form",
    "settings",
    SETTINGS_PLACE,
  ),
  "settings-appearance": expectation("form", "settings", SETTINGS_PLACE),
  "settings-account": expectation("form", "settings", SETTINGS_PLACE),
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

/** Every leaf of the route table, with whether it sits under `Shell`. */
function leaves(
  table: readonly RouteObject[],
  underShell: boolean,
): { route: RouteObject; underShell: boolean }[] {
  return table.flatMap((route) => {
    const shell =
      underShell ||
      (isValidElement(route.element) && route.element.type === Shell);
    return route.children === undefined
      ? [{ route, underShell: shell }]
      : leaves(route.children, shell);
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

  test("every leaf under Shell is a registered screen at its registered path", () => {
    const inShell = all.filter((leaf) => leaf.underShell);
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
    const elsewhere = all.filter((leaf) => !leaf.underShell);
    expect(elsewhere.map((leaf) => leaf.route.path).sort()).toEqual(
      [...outsidePaths].sort(),
    );
    for (const { route } of elsewhere)
      expect(screenIdOf(route)).toBeUndefined();
    for (const entry of SCREENS) expect(outsidePaths).not.toContain(entry.path);
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

/** Screens whose route is still null or still the old shape: the screen is not built yet, or a later piece flips it. */
const NOT_BUILT = [
  "InicioPrimeraVez",
  "InicioPrimeraVezCompu",
  "VerTodas",
  "PrecioNuevo",
  "PrecioNuevoCompu",
  "VariedadNueva",
  "VariedadNuevaCompu",
  "CobroCompu",
];

describe("screens.json against the English routes", () => {
  test("route is path for every screen, but the ones not built and Cobro (the payment route flips it)", () => {
    const wrong = screensJson.screens.flatMap((entry) => {
      if (NOT_BUILT.includes(entry.screen))
        return entry.route === null
          ? []
          : [`${entry.screen}: built, so route should not be null`];
      if (entry.screen === "Cobro")
        return entry.route === "/customers/{debtor}"
          ? []
          : [`Cobro: ${entry.route}`];
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

  test("every English path of the registry is in the path column (but the three with no design file), and the old Spanish ones are gone", () => {
    const paths = new Set(
      screensJson.screens.map((entry) =>
        entry.path.replace(/\{[a-z_]+\}/g, ":id"),
      ),
    );
    const registered = [...SCREENS, ...OUTSIDE].map((entry) =>
      entry.path.replace(/:[a-z]+/g, ":id"),
    );
    // These three screens have no design file of their own, so screens.json has no entry for them.
    const NO_DESIGN = [
      "/customers/new",
      "/customers/:id/edit",
      "/varieties/entries/:id",
    ];
    for (const path of registered.filter(
      (path) => path !== routes.CATCH_ALL && !NO_DESIGN.includes(path),
    )) {
      expect(
        paths.has(path) ||
          path.startsWith("/invitation") ||
          path.startsWith("/reset"),
        `${path} is not in screens.json`,
      ).toBe(true);
    }
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
        registered.some(
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

  test("the old Spanish paths fall to the catch-all: no front code redirects them", () => {
    for (const old of [
      "/ventas",
      "/clientes/3",
      "/mi-stock",
      "/catalogo",
      "/negocio",
      "/gastos/categorias",
      "/entrar",
    ]) {
      expect(matchRoutes(router.routes, old)?.at(-1)?.route.path, old).toBe(
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

describe("source scan for path literals", () => {
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
    const modules = import.meta.glob(["/src/**/*.{ts,tsx}", "/e2e/**/*.ts"], {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const files = Object.entries(modules).map(([path, content]) => ({
      path: path.replace(/^\//, ""),
      content,
    }));
    expect(files.length).toBeGreaterThan(50);
    expect(findPathLiterals(files)).toEqual([]);
    expect(findMatchMediaCalls(files)).toEqual([]);
  });
});
