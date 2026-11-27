## Jobs

**Cuando** mi lista de Products creció y necesito uno (para ver su Stock, cambiarle el precio, registrar una Stock entry o editar cómo se muestra en el Catalog), **quiero** tipear una parte de su nombre y ver solo los Products que coinciden, **para** llegar a él en pocos toques desde el celular sin bajar por toda la lista. (GH-1219. La parte 1 preparó el estado de la búsqueda y la parte 2 construye el campo `SearchField`. El job lo entrega la parte que conecta el campo a la pestaña Products del celular, y se juzga contra él.)

# Products search

La **Products search** es la búsqueda por nombre dentro de la pestaña Products del celular (el dibujo `Productos.dc.html`). Es distinta de la **Global search** de la computadora (search.md): esta busca solo Products, en la lista que ya está en pantalla, y no llama a ninguna API.

Hoy quien vende baja por la lista de Products y lee los nombres, y eso es más lento cuanto más larga es la lista. El selector de Product de New sale no la reemplaza: elige un Product para una Sale line y nunca abre la página del Product, que es donde están su Stock, sus precios y sus Catalog attributes (varieties.md).

**Estado actual: todavía no se ve.** Las partes 1 y 2 de GH-1219 construyen las piezas, pero ninguna pantalla muestra el campo ni filtra la lista. Hasta que salga la parte que lo conecta, la lista de Products sigue sin búsqueda, como dice varieties.md.

Criterios de éxito:

1. **Llega con unas letras.** En el celular, quien vende abre un Product por su nombre tipeando unas letras y tocando una vez, en menos de 10 segundos. Se juzga en la parte que conecta el campo.
2. **Cómodo en el teléfono.**
   - El texto y el placeholder miden 16 px, para que el navegador no haga zoom. Es un apartamiento del dibujo (15 px) que el dueño ya aceptó.
   - El campo mide 44 px de alto y el objetivo de Clear, al menos 44×44.
   - El texto tipeado y el placeholder tienen un contraste de al menos 4,5:1, en claro y en oscuro.
3. **Clear deja seguir buscando.** Tocar Clear vacía el campo y deja el cursor adentro. Volver a mostrar la lista completa es de la parte que conecta el campo.
4. **Se oye bien.** Un lector de pantalla anuncia el campo como "Search products" y el botón como "Clear", y nunca anuncia la lupa.

## Comportamiento

### El texto buscado (parte 1)

- El texto buscado vive solo en memoria, en `ProductsSearchProvider`. Nunca se escribe en el estado del historial, el path, la consulta ni el almacenamiento del dispositivo.
- La clave del historial `productsTab` se escribe solo en `web/src/screens/varieties/productsSearch.ts` y en `productsSearch.test.ts`. Todo otro código, test, fixture o comentario la lee solo con `readNonce`, que acepta únicamente un string no vacío.
- Ninguna pantalla lee `useProductsSearch` todavía.

### El campo `SearchField` (parte 2)

- Es un componente reutilizable, `web/src/components/SearchField.tsx`, con las props `label`, `placeholder`, `clearLabel`, `value` y `onChange`. No guarda ningún texto propio: todo lo que muestra le llega por props.
- Tiene una etiqueta oculta a la vista, atada a un input con `type=search`, `autoComplete=off`, `enterKeyHint=search` e `inputMode=search`. Como no hay etiqueta visible, el placeholder es el único texto que nombra el campo en pantalla.
- Una lupa decorativa con `aria-hidden`.
- El botón "Clear" × (`type=button`, nombre accesible `clearLabel`) se muestra solo cuando el valor no está vacío. Al tocarlo llama a `onChange('')` y devuelve el foco al input.
- **Aspecto**, solo con tokens de diseño, en claro y en oscuro:
  - el texto y el placeholder miden 16 px;
  - el alto es de 44 px;
  - el radio, los espacios y los colores son los del dibujo, salvo el color del placeholder cuando no llega a 4,5:1: en ese caso se usa el token existente más cercano que sí llegue;
  - el botón de cancelar nativo y su decoración se ocultan (`::-webkit-search-cancel-button`, `::-webkit-search-decoration`, `appearance: none`);
  - el botón Clear mide al menos 44×44, con `user-select: none`, `touch-action: manipulation`, un estado `:active` y sin resaltado al tocar.
- **Textos**: van en el namespace `products` del Copy module, con su en-XA y sus tipos generados:
  - `searchLabel` y `searchPlaceholder` dicen "Search products";
  - `searchClear` dice "Clear".

  Sirven para cualquier Business (**Assume nothing**).

### Restricciones

- `src/components/SearchField.tsx` está en `web/scripts/docs/front-exclude.json` mientras ninguna pantalla lo muestre (D-62e6dc23). La parte que lo conecta saca esa entrada.
- `ProductsComputer`, `ProductsBody` y `Variedades` nunca importan `productsSearch` ni `SearchField`.
- `useLeaveGuard` y todo uso de `useBlocker` quedan sin tocar.
- Ninguna lista de infractores de `web/src/mobile-standard/offenders` cambia. No hay ningún WalkState ni fila de `scripts/design/screens.json` para el campo, porque nada lo muestra.

## Métricas

- **Nombre accesible (criterio 4)**: un test con Testing Library encuentra el input por el nombre "Search products" y el botón por "Clear", y comprueba que la lupa lleva `aria-hidden`. 100% en verde.
- **Atributos del teclado del teléfono (criterio 2)**: un test comprueba `type=search`, `autocomplete=off`, `enterkeyhint=search` e `inputmode=search`.
- **Clear (criterio 3)**: un test muestra que Clear llama a `onChange('')` y que el input conserva el foco, y que con el valor vacío no hay ningún botón Clear.
- **Tamaño y contraste (criterio 2)**: el CSS fija 16 px, 44 px de alto y un objetivo de Clear de al menos 44×44, solo con tokens. El guard de contraste (ADR-0029) pasa sin cambiar ningún token, y el texto tipeado y el placeholder alcanzan 4,5:1 en los dos temas.
- **Copy**: los controles de paridad de copy existentes pasan con las tres claves nuevas, su en-XA y sus tipos generados.
- **Sin pantalla todavía**: ninguna pantalla muestra SearchField ni lee las claves nuevas, y la entrada de `front-exclude.json` está presente.
- **Llegar en menos de 10 segundos (criterio 1)**: lo mide la parte que conecta el campo.

## Fuera de alcance

- Mostrar el campo en cualquier pantalla y filtrar la lista de Products: es de la parte que conecta el campo, que además saca la entrada de `front-exclude.json` y actualiza varieties.md.
- Buscar por algo que no sea el nombre del Product.
- Una búsqueda de Products en la computadora; la computadora tiene la Global search (search.md).
- Guardar el texto buscado en el historial, el path, la consulta o el dispositivo.
- Un token nuevo, o un cambio en el valor de un token.
- Pulido para la computadora (Phone first).
