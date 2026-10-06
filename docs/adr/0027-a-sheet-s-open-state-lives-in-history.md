---
status: accepted
date: 2026-10-06
---

# A sheet's open state lives in history; back and Cerrar are one move

On the phone, the system back gesture must close the sheet on top and never ask
"¿Descartás la venta?" for the form underneath. With sheets kept in `useState`, back leaves
the whole screen and the leave guard asks about the form. The product rule (GH-78) is that a
sheet's back does exactly what its own "Cerrar" does.

## Decision

- **The open state is the history entry's `state.sheet`**, an integer depth: 0 or absent is
  the form alone, 1 the first sheet over it, 2 a sheet over that. A sheet at level n is open
  when depth ≥ n. The state carries nothing else about a sheet: no name, id or amount
  (CODING_STANDARDS §9).
- **One `SheetStackProvider` per screen** (`web/src/components/useSheetStack.ts`) creates and
  recognises these entries. `useSheet(level)` gives `{ isOpen, open, close, closeAll }` and
  throws outside a provider. No child makes its own stack, and no screen touches
  `window.history` or `popstate`.
- **`open()` pushes** the same path with `sheet: depth + 1`. **`close()` is `navigate(-1)`**
  and **`closeAll()` is `navigate(-depth)`**. The back gesture is the same pop, so back and
  "Cerrar" are one move by construction.
- **Depth is read at call time from the router's own current location** (`router.state`),
  which changes synchronously on a pop. It is never read from a React state or ref refreshed
  by an effect: a data router may publish a pop inside a transition, so a deferred callback
  (a resolved fetch calling `closeAll()`) could otherwise pop an entry that belongs to the
  form. The router reaches the hook through `SheetRouterProvider`, set in `App.tsx` where
  `RouterProvider` is created, because react-router has no public synchronous read of its
  state from inside a component and `UNSAFE_` contexts are not used.
- **At depth 0, close and closeAll do nothing**, and `navigate(0)` (a reload) is never called.
- **Orphans are cleared.** An entry with `sheet` > 0 that this provider did not push in this
  mount (a reload, a forward into a closed sheet's entry) opens nothing and is replaced by the
  same entry without `sheet`. A level-2 entry pushed through the same provider is not one.
- **`useLeaveGuard` never blocks a navigation that keeps the pathname and search and changes
  only the `sheet` depth.** It stays the only caller of `useBlocker`; `dirty`, `disarm` and
  re-arming through `blocker.reset()` are unchanged.

## Consequences

- New sheets adopt `useSheet`. Existing sheets of other screens stay `useState` until a task
  touches them.
- A form's back after "No, seguí cargando" asks again, because the guard re-arms as before.
- `SheetStackProvider` throws without a `SheetRouterProvider` above it. There is no fallback
  to the rendered location, which lags a pop; tests render with a real data router and
  `SheetRouterProvider`.
