---
status: accepted
date: 2026-11-25
summary: "en Expenses, el teléfono y la computadora dibujan cuerpos de mes separados detrás de un solo selector de mes, y useViewport es el único interruptor; un cambio al cuerpo del mes se hace dos veces (GH-1053, todavía no está en el código)"
---

# On Expenses, phone and computer render separate month bodies behind one chooser, switched only by useViewport

GH-1123, parte 2; prepara GH-1053. Esta parte solo declara los tokens `--gasto*` y deja
escrita la regla; ninguna pantalla los dibuja todavía.

## Decisión

En Expenses, el teléfono y la computadora dibujan cuerpos de mes separados detrás de un
solo selector de mes (month chooser). `useViewport` (`web/src/shell/useViewport.ts`) es el
único interruptor: ningún módulo de Expenses lee `matchMedia`, `innerWidth` ni un ancho de
CSS para elegir un cuerpo.

Hoy `web/src/screens/Gastos.tsx` no tiene ningún interruptor, y los dos cuerpos llegan con
GH-1053. Esto es la regla para el código futuro, no un hecho del código actual.

## Razón

`BRIEF.md` dice que la computadora no recibe pulido propio y que sus diseños existentes se
quedan como están. El cuerpo de la computadora queda congelado, y el del teléfono (Phone
first) se dibuja aparte sin tocarlo. Es coherente con ADR-0044 (la computadora conserva su
propio marco), que esta decisión no revierte.

## Consecuencias

- Un cambio al cuerpo del mes se hace dos veces, o se registra a propósito como solo del
  teléfono, bajo Phone first.
- Un solo interruptor deja un solo lugar donde buscar qué cuerpo se dibuja.

## Riesgo conocido

Ningún test hace cumplir todavía el interruptor único. Un revisor busca con grep
`matchMedia|innerWidth` sobre los archivos de Expenses, y GH-1053 agrega el test de
arquitectura.
