/** Placeholder of the "Negocio" group: its own piece of GH-60 overwrites this file; the router never changes. */

import SettingsGroup from './SettingsGroup'

export default function BusinessGroup() {
  return (
    <SettingsGroup
      title="Negocio"
      dirty={false}
      leave={{
        question: '¿Descartás los cambios?',
        detail: 'Se pierde lo que cargaste: todavía no se guardó nada.',
        keepLabel: 'No, seguí editando',
        discardLabel: 'Sí, descartalos',
      }}
    >
      {null}
    </SettingsGroup>
  )
}
