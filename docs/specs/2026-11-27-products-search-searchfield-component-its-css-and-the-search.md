---
status: draft
---
## Goal

Construir `SearchField`, el campo reutilizable para la Products search de la pestaña Products del celular, junto con su CSS y sus textos. Sirve a quien vende y tiene una lista de Products larga: más adelante podrá tipear una parte del nombre en vez de bajar por la lista. En esta parte ninguna pantalla muestra el campo. La parte posterior lo conecta a la pantalla y entrega el job.

## Acceptance criteria

- `web/src/components/SearchField.tsx` existe, con las props `label`, `placeholder`, `clearLabel`, `value` y `onChange`.
- Una etiqueta oculta a la vista está atada a un input con `type=search`, `autoComplete=off`, `enterKeyHint=search` e `inputMode=search`.
- La lupa lleva `aria-hidden`.
- Un botón "Clear" × (`type=button`, `aria-label` = `clearLabel`) se muestra solo cuando el valor no está vacío. Llama a `onChange('')` y devuelve el foco al input.
- El CSS usa solo tokens de diseño y funciona en claro y en oscuro:
  - texto y placeholder de 16 px;
  - alto de 44 px;
  - radio, espacios y colores como en el dibujo;
  - el botón de cancelar nativo y su decoración ocultos, con `appearance: none`;
  - un objetivo de Clear de al menos 44×44, con `user-select: none`, `touch-action: manipulation`, un estado `:active` y sin resaltado al tocar.
- El texto tipeado y el placeholder tienen un contraste de al menos 4,5:1 en los dos temas, y el guard de contraste pasa sin cambiar ningún token.
- El namespace products tiene `searchLabel` y `searchPlaceholder` ("Search products") y `searchClear` ("Clear"), con su en-XA y los tipos de copy regenerados. Los controles de paridad de copy pasan.
- `src/components/SearchField.tsx` está en `web/scripts/docs/front-exclude.json`.
- Los tests con Testing Library cubren:
  - el nombre accesible;
  - los atributos `type`, `autocomplete`, `enterkeyhint` e `inputmode`;
  - que Clear vacía el campo y conserva el foco;
  - que no hay botón Clear con el valor vacío;
  - que la lupa lleva `aria-hidden`.
- Ninguna pantalla muestra SearchField ni lee las claves nuevas. `ProductsComputer`, `ProductsBody` y `Variedades` no importan `productsSearch` ni `SearchField`.
- `productsTab` sigue escrito solo en `productsSearch.ts` y en su test.
- `useLeaveGuard`, los usos de `useBlocker`, las listas de infractores, los WalkStates y `screens.json` no cambian.

## Out of scope

- Mostrar el campo en cualquier pantalla, filtrar la lista de Products o leer el texto buscado.
- Sacar la entrada de `front-exclude.json` y actualizar varieties.md: es de la parte que conecta el campo.
- Un token nuevo, o un cambio en el valor de un token.
- Pulido para la computadora.

## Decisions

- El mínimo de contraste de 4,5:1 vale también para el placeholder. Si el color dibujado no llega, se usa el token existente más cercano que sí llegue.
  - Reason: con la etiqueta oculta, el placeholder es el único texto que nombra el campo en pantalla.
- La capacidad se documenta en un archivo nuevo, `products-search.md`, con el término de glosario Products search, y no en varieties.md.
  - Reason: es una búsqueda distinta de la Global search de la computadora, y varieties.md sigue siendo cierto hasta que el campo se muestre.
- `touches_ui` queda en false y `touches_copy` en true.
  - Reason: ninguna pantalla muestra el componente, pero se suman textos nuevos al Copy module.

## Risks

Puede que el color del placeholder del dibujo no llegue a 4,5:1 con los tokens actuales. En ese caso se elige otro token existente, y el componente se aparta un poco del dibujo.

## Screens

none

## Slices

### search-field

#### Acceptance criteria

- SearchField, su CSS, las tres claves de copy (con en-XA y tipos) y la entrada en `front-exclude.json` están entregados, y cumplen todos los criterios de aceptación de arriba.
- Los tests con Testing Library y los controles de paridad de copy y de contraste pasan.
- Ninguna pantalla muestra SearchField, y ninguno de los archivos protegidos por las invariantes cambia.

#### Risks

- placeholder-contrast-token
