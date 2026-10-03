/**
 * Stub mounted by `router-and-feedback`'s route table at `/ventas` (plan, "Order":
 * `sales-list-and-detail` fills this module in — periods, the period's total and
 * count, and the list itself (`sales.md`, "On screen: Ventas"). Kept to the bare
 * shape every gated screen in this app follows (`main.pantalla` > `div.cuerpo`) so
 * the route renders something real before that subtask lands.
 */

export default function Ventas() {
  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">Ventas</span>
      </div>
    </main>
  )
}
