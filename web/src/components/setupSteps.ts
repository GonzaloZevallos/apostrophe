/** The checklist's copy and destinations (`results.md`, "Setup checklist"), one entry per
 * step id the server can answer. Kept out of the component file so it only exports
 * a component; a unit test pins its keys to the panel fixture's step ids. */

import type { SetupStepId } from "../api/panel";

export const STEP_COPY: Record<SetupStepId, { label: string; to: string }> = {
  priced_variety: {
    label: "Cargá una variedad con su precio",
    to: "/variedades",
  },
  stock_entry: {
    label: "Cargá tu stock inicial",
    to: "/mi-stock/nueva-entrada",
  },
  bot_published: { label: "Conectá el bot de Telegram", to: "/catalogo" },
  partner: { label: "Invitá a un socio", to: "/negocio" },
};
