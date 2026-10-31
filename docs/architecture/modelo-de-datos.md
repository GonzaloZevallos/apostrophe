# Modelo de datos

El esquema completo, tabla por tabla, es el [diagrama ER generado](generated/data-model.md); se regenera con [scripts/docs/generate.py](../../scripts/docs/generate.py) y no se edita a mano. Esta página explica lo que ese diagrama no dice: cómo conviven varios Businesses en la misma base sin mezclarse. Contenedor de la base: [contenedores.md](contenedores.md).

## Un Business por sesión

1. **El Business sale solo de la sesión.** [app/accounts/adapters/deps.py](../../app/accounts/adapters/deps.py) `require_session` lee el token (cookie o cabecera de autorización), lo abre con [app/accounts/application/sign_in.py](../../app/accounts/application/sign_in.py) `open_session` y responde un `SignedIn`; de ahí [app/accounts/adapters/deps.py](../../app/accounts/adapters/deps.py) `CurrentBusinessId` entrega el id del Business a cada endpoint. Nunca viene de la URL ni del cuerpo del pedido.
2. **Todas las rutas de negocio pasan por la compuerta.** [app/main.py](../../app/main.py) `create_app` incluye cada router con `Depends(require_session)`; solo las rutas públicas de [app/accounts/adapters/router.py](../../app/accounts/adapters/router.py) `public_router` quedan afuera.
3. **Cada repositorio se construye para un Business.** Por ejemplo [app/sales/adapters/sql_sales.py](../../app/sales/adapters/sql_sales.py) `SqlSales` recibe el `business_id` al crearse y lo agrega a cada consulta: buscar una venta por id es buscar con el id y con ese Business.
4. **Cada fila dice quién es su dueño.** Toda tabla, salvo las de plataforma, tiene una columna `business_id` no nula con clave foránea a `business`; [tests/migrations/test_business_ownership.py](../../tests/migrations/test_business_ownership.py) `PLATFORM_TABLES` enumera las excepciones (las tablas business e invitation y las dos tablas del freno de login, que deciden a quién pertenece un pedido antes de conocer su Business) y la prueba falla si una tabla nueva no declara la columna. Las claves foráneas se activan en cada conexión SQLite desde [app/db.py](../../app/db.py) `make_engine`.

## 404 y no 403

Un registro de otro Business no se rechaza: no existe para quien lo pide. Como el repositorio filtra por Business, la búsqueda devuelve `None` y el caso de uso levanta el error de "no encontrado", por ejemplo [app/sales/application/delete_sale.py](../../app/sales/application/delete_sale.py) `delete_sale` con [app/sales/application/errors.py](../../app/sales/application/errors.py) `SaleNotFound`, que el router traduce a 404 con [app/sales/adapters/router.py](../../app/sales/adapters/router.py) `as_http`. Así tampoco se revela que el registro existe en otro Business.

[tests/test_business_isolation.py](../../tests/test_business_isolation.py) lo prueba contra toda la API: el Business A registra una de cada cosa (`SEEDERS`, con `MARKER` en cada nombre), el Business B llama a cada ruta con sesión, y toda ruta que nombra un registro de A debe responder 404 y toda lista debe salir sin nada de A. Una ruta nueva con parámetros o cuerpo sin ejemplo en `BODIES` hace fallar la prueba.

La decisión está en [docs/adr/0004-businesses-never-mix.md](../adr/0004-businesses-never-mix.md).

## Lo que no lleva datos de un Business

El pedido de `/health` no tiene sesión ni devuelve datos de ningún Business: [tests/test_health.py](../../tests/test_health.py) `test_health_answers_exactly_status_ok`.
