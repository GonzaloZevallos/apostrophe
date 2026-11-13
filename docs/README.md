# Cómo funciona

Punto de entrada de la documentación técnica de apostrophe, en español. Desde aquí se llega a cada página en dos clics. Los nombres del código, de los diagramas y de [CONTEXT.md](../CONTEXT.md) van en inglés, como en el repositorio.

## Qué hace el producto

Cada capacidad tiene su página en [docs/product/](product/):

- [Accounts](product/accounts.md)
- [Análisis](product/analysis.md)
- [Brand](product/brand.md)
- [Catalog](product/catalog.md)
- [Clientes](product/customers.md)
- [Design capture](product/design-capture.md)
- [Drawing as guide](product/drawing-as-guide.md)
- [Expenses](product/expenses.md)
- [Gate](product/gate.md)
- [Icon and text rule](product/icon-and-text-rule.md)
- [Import](product/import.md)
- [Language](product/language.md)
- [Dinero](product/money.md)
- [Mobile check](product/mobile-check.md)
- [Navigation](product/navigation.md)
- [Onboarding](product/onboarding.md)
- [Pagos](product/payments.md)
- [Payment methods](product/payment-methods.md)
- [Phone first](product/phone-first.md)
- [Pinned catalog](product/pinned-catalog.md)
- [Pricing settings](product/pricing-settings.md)
- [Product language](product/product-language.md)
- [Cantidad](product/quantity.md)
- [Results](product/results.md)
- [Sale bill](product/sale-bill.md)
- [Screen images](product/screen-images.md)
- [Ventas](product/sales.md)
- [Selector](product/selector.md)
- [Stock](product/stock.md)
- [Stored language](product/stored-language.md)
- [Elección de tema y paleta](product/theme-choice.md)
- [Varieties](product/varieties.md)

El contrato de diseño del front está en [el sistema de diseño](product/design-system/).

## Cómo está armado

- [Arquitectura](architecture/README.md): contexto, contenedores, componentes, modelo de datos y flujos clave.
- [Decisiones](architecture/decisiones.md): el índice de los ADR de [docs/adr/](adr/).
- Los documentos generados (`docs/api/`, `docs/architecture/generated/` y `decisiones.md`, que sale del `summary:` de cada ADR) no se editan a mano. Git los fusiona con el driver `merge=regen`: al fusionar master en una rama gana la copia de master, y al fusionar una rama en master, en local, gana la de la rama y `regen` escribe encima en master. Un archivo generado borrado en un lado y editado en el otro sigue en conflicto y se resuelve regenerándolo. Después de una fusión se corre `generate` y se confirma. Ver la [ADR](adr/20261112-generated-docs-and-the-adr-index-are-built-on-master.md).
- [Referencia de la API](api/index.html): el documento OpenAPI exportado de la app, como página estática.
