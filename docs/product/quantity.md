# Cantidad

## Jobs

- Cuando construyo o cambio stock, ventas o resultados para un negocio que quizás no venda por gramo, quiero que la API, el front, los fakes de fetch, los e2e y la importación de la planilla hablen de cantidad, así puedo sumar unidades y totales por unidad sin traducir gramos a cantidad en ningún lado y sin cambiar un solo valor. (GH-318, parte 4; sirve a "Assume nothing", criterio 4 del BRIEF.)

## Qué es hoy

En el contrato JSON de stock, ventas y resultados, la cantidad de una variedad se llama `quantity`, igual que en el código detrás. El valor sigue siendo el de siempre: gramos, como Decimal con hasta dos decimales. Esta parte cambia solo nombres. El paso a centésimos de una unidad (ADR-0056, Invariante 5) y la agrupación por unidad (`QuantityByUnit`, Invariante 6) son de la parte de unidades.

## Reglas

- En los schemas de stock, ventas y resultados, todo campo que decía "grams" dice "quantity" y conserva el resto del nombre: `grams` → `quantity`, `grams_sold` → `quantity_sold`, `grams_gifted` → `quantity_gifted`, `pending_grams` → `pending_quantity`, `total_grams` → `total_quantity`. Cualquier otro compuesto de esos schemas sigue el mismo patrón. Vale para pedidos y respuestas.
- El tipo compartido `GramsOut` lleva un nombre de cantidad.
- Los nombres viejos se dejan de aceptar en el acto, sin alias. Un pedido que manda `grams` en vez de `quantity` se rechaza porque falta `quantity`, con el mismo status que cualquier campo obligatorio ausente. El trato de los campos de más no cambia.
- Umbral de stock bajo (`PUT /stock/products/{id}/threshold`): `quantity` es obligatorio y puede ser null. `{"quantity": null}` apaga el umbral, como antes `{"grams": null}`. `{"grams": "20"}` y un cuerpo vacío `{}` responden 422, así un pedido con el nombre viejo nunca borra el umbral en silencio. El front apaga el umbral mandando `{"quantity": null}`, nunca un cuerpo vacío. Es el único rechazo que esta parte agrega fuera del cambio de nombres.
- Cada respuesta lleva los mismos números que antes bajo los nombres nuevos: nada se reescala, nada se redondea, nada se reinterpreta.
- Todo `detail` de rechazo de stock, ventas y resultados que nombraba gramos ahora nombra la cantidad, en inglés llano (por ejemplo "the quantity must be more than zero"). La condición, el status y el momento del rechazo no cambian. Un `detail` nunca se muestra (Product language) y el front nunca compara su texto.
- El front (tipos, fakes de fetch, e2e) usa los nombres nuevos. El snapshot de OpenAPI los sigue.
- La importación de la planilla cambia solo donde arma o lee esos schemas o puertos, y carga los mismos registros con los mismos valores. Las columnas de la planilla y el informe del operador no cambian.
- Las tablas y columnas guardadas conservan sus nombres. El mapeo de `quantity` a las columnas existentes queda en el adaptador, igual que `variety_id` (ADR-0061). No hay migración.
- El vendedor no ve ningún cambio: el texto de pantalla, el catálogo y todas las cifras se leen igual. Una palabra de pantalla que dice gramos queda así hasta la parte de unidades o la de la palabra del producto.

## Lo que todavía dice grams en el contrato

Cada caso queda para la parte que lo posee. El plan del Tech Lead completa la lista.

| Campo o mensaje | Dónde | Parte dueña |
|---|---|---|
| Mínimo mayorista (bulk minimum) | Price entry, hexágono de precios | La parte que posee los precios (unidades / precios por tipo de cliente) |
| Rechazo del mínimo mayorista | `app/products/domain/product.py` | La misma |
| Campos con grams | Schemas de onboarding | La parte de onboarding que los toque, junto con unidades |
| Campos con grams | Schemas de catálogo / Telegram | La parte de unidades, junto con el catálogo |

`variety_id` y todo campo de producto en el contrato quedan para la parte Product rename on the wire (ADR-0061).

## Métricas

- Campos `grams` en los schemas de stock, ventas y resultados, en los tipos del front, en los fakes de fetch y en los e2e: 0 (búsqueda en el repositorio).
- Diff de los tests de API y del test de importación: solo nombres de campos y redacción de `detail`, más los dos casos 422 nuevos del umbral; 0 valores cambiados.
- Importación de la planilla: mismos registros y mismos valores que antes del cambio.
- Gate (pytest, vitest, e2e): pasa.
- Cambios visibles para el vendedor (texto de pantalla, catálogo, cifras): 0.
