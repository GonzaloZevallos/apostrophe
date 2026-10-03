/**
 * Stub mounted by `router-and-feedback`'s route table at `/ventas/nueva` (plan,
 * "Order"): `new-sale-screen` fills this module in — the form, the live preview
 * (`sales/pricing.ts`), the leave guard and "Elegir cliente" (`sales.md`, "On
 * screen: Nueva venta"). Kept to the bare shape every gated screen in this app
 * follows (`main.pantalla` > `div.cuerpo`) so the route renders something real
 * before that subtask lands.
 */

export default function NuevaVenta() {
  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">Nueva venta</span>
      </div>
    </main>
  )
}
