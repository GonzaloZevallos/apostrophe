/**
 * Stub mounted by `router-and-feedback`'s route table at `/ventas/:id` (plan,
 * "Order"): `sales-list-and-detail` fills this module in — the sale's detail,
 * "Borrar venta", and the "Venta guardada" notice with Deshacer read through
 * `components/feedback.ts`'s `readFeedback`/`clearSaleJustSaved`
 * (`sales.md`, "On screen: Detalle de venta"). `assign-customer` later adds
 * "Asignar cliente" to this same module. Kept to the bare shape every gated
 * screen in this app follows (`main.pantalla` > `div.cuerpo`) so the route
 * renders something real before those subtasks land.
 */

export default function VentaDetalle() {
  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">Venta</span>
      </div>
    </main>
  )
}
