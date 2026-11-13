# Arquitectura

Las páginas que explican cómo está armado apostrophe, escritas a mano y en español. Cada una enlaza los archivos del repositorio en los que se apoya; los diagramas generados desde el código están en [generated/README.md](generated/README.md).

- [Contexto](contexto.md): quién usa el producto y con qué sistemas externos habla, como vista C4 de contexto.
- [Contenedores](contenedores.md): el backend, el front, la base de datos y los trabajos en segundo plano.
- [Componentes](componentes.md): los hexágonos y sus puertos, con los diagramas de clases generados.
- [Modelo de datos](modelo-de-datos.md): el diagrama entidad-relación generado y cómo se aíslan los Businesses.
- [Flujos clave](flujos-clave.md): iniciar sesión, una venta con pago en el acto, un movimiento de stock y abrir un Business nuevo.
- [Decisiones](decisiones.md): el índice de los ADR de [docs/adr/](../adr/).

Los caminos generados (`generated/`, `../api/` y `decisiones.md`, que sale del `summary:` de cada ADR) no se editan a mano. El driver `merge=regen` evita los conflictos entre ramas: al fusionar master en una rama gana la copia de master, y al fusionar una rama en master, en local, gana la de la rama y `regen` escribe encima en master. Después de una fusión se corre `generate` y se confirma. Ver la [ADR](../adr/20261112-generated-docs-and-the-adr-index-are-built-on-master.md).

Volver a [Cómo funciona](../README.md).
