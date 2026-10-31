# Decisiones

Índice de los ADR de [docs/adr/](../adr/): una fila por archivo, con su número enlazado, una frase en español y la marca que da la línea `status:` del propio ADR. Solo esa línea decide la marca de la columna «Estado»; esta página no afirma cuáles ADR están vigentes. Un ADR aceptado puede traer enmiendas o quedar reemplazado en parte por uno posterior, así que quien lo lee abre el ADR y sigue sus referencias. Por ejemplo, el [ADR 0048](../adr/0048-the-phone-check-measures-the-dom-for-what-a-person-reads.md) reemplaza solo la sección «Known gap» del [ADR 0029](../adr/0029-text-contrast-is-a-readme-table-checked-by-one-guard.md), y la línea `status:` de ninguno de los dos lo dice.

Un ADR da el motivo de una decisión; lo que el sistema hace hoy se afirma en las demás páginas de [architecture/](README.md), que citan el código. Cómo se mantienen esas citas lo decide el [ADR 0068](../adr/0068-architecture-docs-cite-defined-symbols-checked-by-text.md).

| ADR | Qué decide | Estado |
| --- | --- | --- |
| [0001](../adr/0001-stack-and-shape.md) | FastAPI sobre SQLite, un hexágono por capacidad, dinero y gramos como enteros |  |
| [0002](../adr/0002-users-invitations-and-a-signed-session.md) | usuarios con correo y contraseña, solo se entra por invitación, sesión firmada |  |
| [0003](../adr/0003-a-sale-line-records-its-price.md) | cada línea de venta guarda el precio al que se vendió |  |
| [0004](../adr/0004-businesses-never-mix.md) | los Businesses nunca se mezclan: el Business sale de la sesión y cada fila lo lleva |  |
| [0005](../adr/0005-no-request-data-in-answers-or-logs.md) | ningún dato del pedido aparece en respuestas de error ni en registros |  |
| [0006](../adr/0006-capabilities-meet-through-ports.md) | las capacidades se encuentran por puertos que declara quien llama |  |
| [0007](../adr/0007-a-sale-stores-its-line-totals-and-its-on-the-spot-payment.md) | la venta guarda los totales de sus líneas y su pago en el acto como una fila de pago |  |
| [0008](../adr/0008-refusals-carry-a-code-the-front-maps.md) | cada rechazo lleva un código y un tipo; el front mapea códigos, nunca el detalle |  |
| [0009](../adr/0009-cost-of-goods-follows-its-lots-never-frozen.md) | el costo de lo vendido sigue a sus lotes tal como están |  |
| [0010](../adr/0010-cost-of-goods-is-allocated-on-read-rounded-along-lot-order.md) | el costo se reparte al leer, en una función pura, siguiendo el orden de los lotes |  |
| [0011](../adr/0011-sales-answer-a-read-shape-and-unknown-references-are-gone.md) | las ventas responden una forma de lectura rotulada; una referencia desconocida es 404 |  |
| [0012](../adr/0012-settlement-is-worked-out-on-read-and-the-balance-guard-is-one-statement.md) | la liquidación se calcula al leer; registrar un pago protege el saldo en una sola sentencia |  |
| [0013](../adr/0013-the-panel-is-composed-from-each-owner-s-own-figures.md) | el panel se arma con las cifras de cada dueño en un solo pedido |  |
| [0014](../adr/0014-upkeep-runs-after-the-commit-and-compares-text-before-sending.md) | el mantenimiento corre después del commit y solo envía si el texto cambió |  |
| [0015](../adr/0015-business-removal-reflects-the-schema-and-deletes-what-it-exported.md) | la baja de un Business sigue el esquema y borra exactamente lo que exportó |  |
| [0016](../adr/0016-render-turso-and-uptimerobot-replace-the-oracle-vm.md) | Render, Turso y UptimeRobot reemplazan la máquina virtual anterior |  |
| [0017](../adr/0017-deploying-render-turso-backups-and-the-restore-drill.md) | el despliegue en Render y Turso, la copia diaria cifrada y el simulacro de restauración |  |
| [0018](../adr/0018-the-spreadsheet-import-plans-through-owner-ports-then-writes-once.md) | la importación de planillas planifica por los puertos de cada dueño y escribe una vez |  |
| [0019](../adr/0019-a-reset-link-exists-only-while-live-and-is-spent-in-one-statement.md) | un enlace de restablecimiento existe solo mientras puede servir y se gasta en una sentencia |  |
| [0020](../adr/0020-period-figures-are-summed-once-in-results.md) | las cifras de un período se suman una sola vez en resultados |  |
| [0021](../adr/0021-a-customer-is-identified-by-their-record-and-the-phone-is-optional.md) | un cliente se identifica por su registro; el teléfono es opcional |  |
| [0022](../adr/0022-the-catalog-text-has-one-author-and-markers-pass-through.md) | el texto del catálogo tiene un solo autor y las marcas del vendedor pasan tal cual |  |
| [0023](../adr/0023-what-telegram-receives.md) | qué recibe Telegram: texto plano con entidades de negrita y una tabla fija |  |
| [0024](../adr/0024-a-front-path-may-share-its-first-segment-with-the-api-only-through-an-exact-allowlist-served-to-browser-navigations.md) | una ruta del front comparte su primer segmento con la API solo por una lista exacta |  |
| [0025](../adr/0025-the-getting-in-screens-share-one-auth-page.md) | las pantallas de entrada comparten una sola página de autenticación |  |
| [0026](../adr/0026-the-theme-choice-is-the-only-thing-the-browser-stores.md) | la elección de tema es lo único que guarda el navegador |  |
| [0027](../adr/0027-a-sheet-s-open-state-lives-in-history.md) | el estado abierto de una hoja vive en el historial |  |
| [0028](../adr/0028-the-sales-form-pins-itself-to-the-visual-viewport.md) | el formulario de ventas se ancla al viewport visual |  |
| [0029](../adr/0029-text-contrast-is-a-readme-table-checked-by-one-guard.md) | el contraste del texto es una tabla del README vigilada por una sola prueba |  |
| [0030](../adr/0030-varieties-front-paths-are-served-by-id-patterns-and-legacy-ids-are-carried-across-server-side.md) | las rutas del front de variedades se sirven por patrones de id | reemplazada por 0033 |
| [0031](../adr/0031-a-withdrawal-is-a-third-draw-source-in-stock-with-an-explicit-source.md) | un retiro es una tercera fuente de salida de stock con una fuente explícita |  |
| [0032](../adr/0032-a-variety-is-archived-by-a-stored-instant-and-its-history-is-computed.md) | una variedad se archiva con un instante guardado y su historia se calcula |  |
| [0033](../adr/0033-front-paths-are-id-templates-the-legacy-rows-live-once-in-app-and-screens-json-is-cross-checked.md) | las rutas del front son plantillas de id y las filas heredadas viven una sola vez en la app |  |
| [0034](../adr/0034-pricing-switches-live-in-their-own-table-and-the-lowest-applicable-rule-prices-a-line.md) | los interruptores de precios viven en su propia tabla y la regla aplicable más baja fija el precio |  |
| [0035](../adr/0035-muestra-is-rendered-from-the-seed-at-a-pinned-date-and-screens-are-checked-against-it.md) | el archivo de muestra se genera desde la semilla en una fecha fija |  |
| [0036](../adr/0036-the-onboarding-stores-only-its-passes-and-its-end-done-ness-is-derived-steps-write-through-their-owners-and-its-api-is-onboarding-progress.md) | el Onboarding guarda solo sus pasos y su final; lo hecho se deriva |  |
| [0037](../adr/0037-boton-draws-the-icon-and-text-rule-as-a-type.md) | el botón dibuja la regla de ícono y texto como un tipo |  |
| [0038](../adr/0038-a-300-ms-speed-metric-is-guarded-by-query-plan-and-statement-count-never-by-elapsed-time.md) | una métrica de 300 ms se vigila por plan de consulta y cantidad de sentencias |  |
| [0039](../adr/0039-affected-only-checks-vitest-by-its-graph-plus-guards-e2e-only-for-e2e-only-changes-pytest-full.md) | los chequeos afectados: vitest por su grafo, e2e solo para cambios de e2e, pytest completo |  |
| [0040](../adr/0040-e2e-isolates-by-worker.md) | e2e aísla por worker: un backend y una base por worker |  |
| [0041](../adr/0041-the-tests-check-runs-in-parallel-with-pytest-xdist.md) | el chequeo de pruebas corre en paralelo con pytest-xdist |  |
| [0042](../adr/0042-design-captures-pin-their-fonts-and-before-after-compares-raw-captures-at-exact-ae.md) | las capturas de diseño fijan sus fuentes y comparan capturas crudas |  |
| [0043](../adr/0043-the-operator-commands-take-their-clock-tests-never-read-the-wall-clock.md) | los comandos del operador reciben su reloj; las pruebas nunca leen la hora real |  |
| [0044](../adr/0044-the-price-form-on-a-computer-is-a-modal-drawn-by-its-own-route.md) | el formulario de precio en computadora es un modal con su propia ruta |  |
| [0045](../adr/0045-the-shell-draws-the-chrome-and-a-parent-varies-only-by-its-record.md) | el shell dibuja el marco y un padre varía solo por su registro |  |
| [0046](../adr/0046-the-first-run-facts-live-in-their-own-table-and-a-read-stamps-them-in-a-second-guarded-phase.md) | los datos del primer uso viven en su propia tabla y una lectura los marca en dos fases |  |
| [0047](../adr/0047-the-customer-s-channel-is-dropped-for-good.md) | el canal del cliente se elimina para siempre |  |
| [0048](../adr/0048-the-phone-check-measures-the-dom-for-what-a-person-reads.md) | la prueba de teléfono mide el DOM por lo que una persona lee |  |
| [0049](../adr/0049-the-product-s-words-live-in-one-keyed-module.md) | las palabras del producto viven en un solo módulo con claves |  |
| [0050](../adr/0050-the-product-speaks-through-keyed-catalogs-and-a-forced-test-locale.md) | el producto habla con catálogos con claves y un idioma de prueba forzado |  |
| [0051](../adr/0051-operator-text-comes-from-the-operator-translator-never-from-a-business.md) | el texto del operador viene del traductor del operador |  |
| [0052](../adr/0052-one-shot-method-for-every-design-capture-row-and-side.md) | un solo método para cada fila y lado de las capturas de diseño |  |
| [0053](../adr/0053-a-shareable-text-is-worked-out-in-the-front-from-facts-the-server-sends.md) | un texto para compartir se arma en el front con datos que envía el servidor |  |
| [0054](../adr/0054-local-checks-and-ci-run-one-list-enforced-by-a-test.md) | los chequeos locales y la integración continua corren una sola lista verificada por una prueba |  |
| [0055](../adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md) | la configuración se guarda por Business en hexágonos separados por motivo de cambio |  |
| [0056](../adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md) | una cantidad guardada es un entero de centésimas, sea cual sea la unidad |  |
| [0057](../adr/0057-the-business-time-zone-replaces-argentina-days-today-is-worked-out-per-business-and-upkeep-is-due-when-its-last-check-was-not-on-the-business-s-own-today.md) | la zona horaria del Business reemplaza los días de Argentina |  |
| [0058](../adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md) | el dinero viaja en unidades de moneda como Decimal y se guarda con la escala del Business |  |
| [0059](../adr/0059-customer-type-prices-are-effective-dated-rows-and-the-vip-mark-and-vip-price-columns-stay-frozen-in-place.md) | los precios por tipo de cliente son filas con vigencia |  |
| [0060](../adr/0060-the-applied-promotion-snapshot-is-typed-sale-promotion-rows-recorded-as-the-sale-stood-when-saved-and-never-recomputed.md) | la instantánea de promociones aplicadas son filas tipadas, nunca recalculadas |  |
| [0061](../adr/0061-columns-keep-variety-id-until-75-while-code-and-the-api-say-product.md) | las columnas conservan variety_id mientras el código y la API dicen Product |  |
| [0062](../adr/0062-on-the-phone-a-form-is-drawn-by-one-sheet.md) | en el teléfono un formulario lo dibuja una sola hoja |  |
| [0063](../adr/0063-the-technical-docs-come-only-from-the-generator-and-are-built-by-pinned-offline-tools.md) | los documentos técnicos salen solo del generador y se construyen con herramientas fijas sin red |  |
| [0064](../adr/0064-ci-selection-is-a-union-of-path-rules-that-fails-closed.md) | la selección de CI es una unión de reglas por ruta que falla cerrada |  |
| [0066](../adr/0066-technical-docs-are-generated-by-one-command-and-gated-for-staleness.md) | los documentos técnicos se generan con un solo comando y se vigila que no queden viejos |  |
| [0067](../adr/0067-ci-runs-only-the-suites-a-change-affects-in-shards-with-coverage.md) | la integración continua corre solo las suites que un cambio afecta |  |
| [0068](../adr/0068-architecture-docs-cite-defined-symbols-checked-by-text.md) | las páginas de arquitectura citan símbolos definidos y una prueba de texto lo comprueba |  |
