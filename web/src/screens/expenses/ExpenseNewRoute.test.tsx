/**
 * `ExpenseNewRoute` at the screen seam (plan, subtask `expense-form`): through the
 * real data router with `fetch` faked. The route owns how the form is left: back by
 * history to whichever screen opened it, "Expense saved" there, the discard
 * confirmation, and the fallback when there is no history.
 */

import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { EXPENSES, EXPENSE_NEW, MORE } from "../../routes";
import { stubViewport } from "../../test-viewport";
import {
  type FetchImpl,
  ME,
  jsonResponse,
  renderExpenses,
} from "./renderExpenses";

const CATEGORIES = [
  { id: 1, name: "Packaging" },
  { id: 2, name: "Otros" },
];

const EMPTY_VIEW = { month: "2026-10", total: 0, categories: [] };

/** `holdPost`: the POST to EXPENSES waits for this promise, so the test decides when the save lands. */
function api({ holdPost }: { holdPost?: Promise<void> } = {}): FetchImpl {
  return async (url, init) => {
    const method = init?.method ?? "GET";
    if (url.startsWith("/expense-categories") && method === "GET")
      return jsonResponse(200, CATEGORIES);
    if (url.startsWith("/expenses?month=") && method === "GET")
      return jsonResponse(200, EMPTY_VIEW);
    if (url === EXPENSES && method === "POST") {
      await holdPost;
      return jsonResponse(201, {
        id: 10,
        spent_on: ME.today,
        category_id: 1,
        amount: 1000,
        detail: "Cinta",
      });
    }
    throw new Error(`unexpected ${method} ${url}`);
  };
}

async function fillForm(): Promise<void> {
  await userEvent.selectOptions(
    await screen.findByLabelText("Category"),
    "Packaging",
  );
  await userEvent.type(screen.getByLabelText("Amount"), "1000");
  await userEvent.type(screen.getByLabelText("Details"), "Cinta");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Waits for the route to change to Gastos, then for something only Gastos has. On a phone
 * the form draws Gastos' month body in an aria-hidden pane behind the sheet, and `*ByText`
 * does not skip aria-hidden, so the text alone can be found before the route has changed.
 * A role query skips the pane. The form's sheet is also a `<main>` and may still be mounted
 * for a moment after the route changes, so the `main` is looked up again on every retry
 * (more than one `main` throws, and the next retry looks again) instead of once.
 */
async function expectGastosLoaded(
  router: ReturnType<typeof renderExpenses>,
): Promise<void> {
  await waitFor(() => expect(router.state.location.pathname).toBe(EXPENSES));
  await waitFor(() =>
    expect(
      within(screen.getByRole("main")).getByText("You spent this month"),
    ).toBeInTheDocument(),
  );
}

test('a save opened from Más goes back to Más and toasts "Expense saved" there, once', async () => {
  const router = renderExpenses([MORE], api());

  await userEvent.click(
    await screen.findByRole("link", { name: "Add expense from More" }),
  );
  await fillForm();
  await userEvent.click(
    screen.getByRole("button", { name: "Save the expense" }),
  );

  expect(await screen.findByText("More screen")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe(MORE);
  expect(await screen.findAllByText("Expense saved")).toHaveLength(1);
});

async function openFromMore(
  router: ReturnType<typeof renderExpenses>,
): Promise<void> {
  await userEvent.click(
    await screen.findByRole("link", { name: "Add expense from More" }),
  );
  expect(router.state.location.pathname).toBe(EXPENSE_NEW);
}

test("the date is today", async () => {
  renderExpenses([MORE, EXPENSE_NEW], api());

  expect(await screen.findByLabelText("Date")).toHaveValue(ME.today);
});

test("an untouched form closes at once, back to the screen that opened it", async () => {
  const router = renderExpenses([MORE], api());
  await openFromMore(router);

  await userEvent.click(await screen.findByRole("button", { name: "Close" }));

  expect(await screen.findByText("More screen")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe(MORE);
  expect(screen.queryByText("Expense saved")).not.toBeInTheDocument();
});

test('"Close" is there and works while the categories are still loading', async () => {
  const pending: FetchImpl = async (url, init) => {
    if (
      url.startsWith("/expense-categories") &&
      (init?.method ?? "GET") === "GET"
    ) {
      return new Promise(() => undefined);
    }
    return api()(url, init);
  };
  const router = renderExpenses([MORE], pending);
  await openFromMore(router);

  await userEvent.click(await screen.findByRole("button", { name: "Close" }));

  expect(await screen.findByText("More screen")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe(MORE);
});

test("closing with something typed asks before discarding; staying keeps the form", async () => {
  const router = renderExpenses([MORE], api());
  await openFromMore(router);

  await userEvent.type(await screen.findByLabelText("Details"), "Cinta");
  await userEvent.click(screen.getByRole("button", { name: "Close" }));

  expect(await screen.findByText("Discard the expense?")).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "No, keep entering" }),
  );

  expect(screen.queryByText("Discard the expense?")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Details")).toHaveValue("Cinta");
  expect(router.state.location.pathname).toBe(EXPENSE_NEW);
});

test("confirming the discard leaves the form and saves nothing", async () => {
  const router = renderExpenses([MORE], api());
  await openFromMore(router);

  await userEvent.type(await screen.findByLabelText("Details"), "Cinta");
  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Yes, discard it" }),
  );

  expect(await screen.findByText("More screen")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe(MORE);
  expect(fetch).not.toHaveBeenCalledWith(
    EXPENSES,
    expect.objectContaining({ method: "POST" }),
  );
});

test("with no history, closing goes to Gastos on the current month", async () => {
  const router = renderExpenses([EXPENSE_NEW], api());

  await userEvent.click(await screen.findByRole("button", { name: "Close" }));

  await expectGastosLoaded(router);
  expect(router.state.location.search).toBe("");
});

test("with no history, a save goes to Gastos and toasts there", async () => {
  stubViewport("phone");
  let release = (): void => undefined;
  const holdPost = new Promise<void>((resolve) => {
    release = resolve;
  });
  const router = renderExpenses([EXPENSE_NEW], api({ holdPost }));

  await fillForm();
  await userEvent.click(
    screen.getByRole("button", { name: "Save the expense" }),
  );

  // The POST is held: still on the form, whose sheet is then the only <main>.
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      EXPENSES,
      expect.objectContaining({ method: "POST" }),
    ),
  );
  expect(router.state.location.pathname).toBe(EXPENSE_NEW);
  expect(
    within(screen.getByRole("main")).getByRole("dialog", { name: "Add expense" }),
  ).toBeInTheDocument();

  release();

  await expectGastosLoaded(router);
  expect(await screen.findAllByText("Expense saved")).toHaveLength(1);
});

test('the form route has no bar and no "New sale"; Gastos has both', async () => {
  renderExpenses([EXPENSES], api());
  await screen.findByText("You spent this month");
  const navsOnGastos = screen.getAllByRole("navigation").length;
  expect(
    screen.getAllByRole("link", { name: "New sale" }).length,
  ).toBeGreaterThan(0);

  await userEvent.click(screen.getByRole("link", { name: "Add expense" }));
  await screen.findByLabelText("Details");

  expect(
    screen.queryByRole("link", { name: "New sale" }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByRole("navigation")).toHaveLength(navsOnGastos - 1);
});

test("closing, or going back by history, with something typed asks the same question", async () => {
  const router = renderExpenses([MORE], api());
  await openFromMore(router);
  await userEvent.type(await screen.findByLabelText("Details"), "Cinta");

  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  const viaCerrar = (await screen.findByRole("alertdialog")).textContent;
  await userEvent.click(
    screen.getByRole("button", { name: "No, keep entering" }),
  );

  await act(() => router.navigate(-1));
  const viaBack = (await screen.findByRole("alertdialog")).textContent;

  expect(viaBack).toBe(viaCerrar);
  expect(viaBack).toContain("Discard the expense?");
  expect(router.state.location.pathname).toBe(EXPENSE_NEW);
  expect(screen.getByLabelText("Details")).toHaveValue("Cinta");

  await userEvent.click(screen.getByRole("button", { name: "Yes, discard it" }));
  expect(await screen.findByText("More screen")).toBeInTheDocument();
});

test("with no in-app history, closing replaces the form with Gastos", async () => {
  const router = renderExpenses([MORE, EXPENSE_NEW], api());

  await userEvent.click(await screen.findByRole("button", { name: "Close" }));

  await expectGastosLoaded(router);
  expect(router.state.historyAction).toBe("REPLACE");
});

test("after a save the form is no longer in history: leaving by history is a pop to Más", async () => {
  const router = renderExpenses([MORE], api());
  await openFromMore(router);

  await fillForm();
  await userEvent.click(
    screen.getByRole("button", { name: "Save the expense" }),
  );

  expect(await screen.findByText("More screen")).toBeInTheDocument();
  expect(router.state.historyAction).toBe("POP");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});
