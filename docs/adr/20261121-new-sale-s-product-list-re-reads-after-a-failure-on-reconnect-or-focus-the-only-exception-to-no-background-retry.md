---
status: accepted
date: 2026-11-21
summary: "la lista de Products de New sale vuelve a leer sus precios tras un fallo al reconectar el teléfono o volver a la app, sin botón: es la única excepción a «sin reintento en segundo plano», y se hace con un refetch por observador que devuelve 'always' solo para una consulta en error, sin cambiar ninguna opción de la consulta"
---

# La lista de Products de New sale vuelve a leer tras un fallo, al reconectar o al volver a la app

Parte de GH-863 (la lista, sin ruta hasta el flip de GH-496). Decidido por el Tech Lead, a partir de la decisión 1 del humano. Es la única excepción a la postura de `web/src/queryClient.ts` («sin reintento silencioso en segundo plano: el producto reintenta solo cuando el usuario lo pide») y a «Sin red» de `docs/product/accounts.md`.

## Contexto

Si la lectura de precios falla, la lista muestra «No connection» o el error genérico, y ninguno tiene botón. Nada volvía a leer: el vendedor con el teléfono ya reconectado quedaba sin poder terminar la venta desde esa lista. El humano decidió leer de nuevo al reconectar o al recuperar el foco, sin botón nuevo, sin cambiar los dos avisos y sin tocar los valores por defecto de la app.

## Decisión

- **Cuándo.** Solo tras un fallo: al reconectar el teléfono o al volver la app al foco, la consulta de Products o la de Pricing settings que está en error vuelve a leer. Una lista ya cargada nunca se vuelve a leer en segundo plano, así que una Sale en curso no se vuelve a precificar a escondidas.
- **Cómo.** En `useNewSaleReads` y solo ahí, `refetchOnReconnect` y `refetchOnWindowFocus` de ambas consultas son la forma de función de react-query: devuelven `'always'` cuando `query.state.status === 'error'` y `false` en otro caso. Se decide por observador.
- **Lo que no se toca.** Ninguna opción de la consulta (`networkMode`, `gcTime`, `retry`, `staleTime`) se sobreescribe, porque son de la consulta y no del observador: con dos observadores sobre la misma clave (`NuevaVenta.tsx` y la lista, tras el flip), el último en fijarlas decidiría por los dos. `saleFormQueries.ts` y `api/saleSuggestions.ts` quedan como están. No hay bucle de reintentos: `retry: false` sigue siendo el valor por defecto de la app y un refetch que vuelve a fallar deja el aviso hasta el próximo evento.
- **Sin red al abrir.** Se lee de `fetchStatus === 'paused'` en la consulta de Products o en la de Pricing settings: es un `failed` con `NetworkError`, y muestra «No connection» sin `aria-busy`.
- **Sin botón.** Los avisos no cambian ni ganan una acción; un botón se apartaría del dibujo.
- **Alcance.** La lista de suggestions no se vuelve a leer. Al flip, un refetch que dispara la lista sobre una consulta en error también le da sus datos a `NuevaVenta.tsx`, porque comparten una entrada de caché.

## Consecuencias

- Los comentarios de `queryClient.ts` y `useOnline.ts` siguen describiendo bien el valor por defecto de la app; el comentario de `useNewSaleReads.ts` remite a esta ADR.
- `docs/product/accounts.md` («Sin red») nombra la excepción.
- Un test con un segundo observador, armado como lo arma `NuevaVenta.tsx`, comprueba que sus opciones no cambian.
