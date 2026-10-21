/**
 * The "Mensaje del catálogo" group of Configuración (`ConfiguracionMensaje.dc.html`,
 * `ConfiguracionMensajeCompu.dc.html`; `catalog.md`): the catalog's header and footer, two
 * multi-line fields, up to 500 characters each (the backend counts; the inputs carry no
 * `maxLength`), blank allowed.
 *
 * Success shows the fixed toast "Catálogo guardado". A refusal shows inline under its field
 * and keeps what was typed; a dropped network shows "Sin conexión", never the generic retry.
 *
 * The form itself is `CatalogMessageForm`; this group keeps the `SettingsGroup` frame
 * and its leave guard, fed by the form's `onDirtyChange`.
 */

import { useState } from 'react'
import CatalogMessageForm from './CatalogMessageForm'
import SettingsGroup from './SettingsGroup'
import { COMMON_TEXT } from '../../copy/common'
import { SETTINGS_TEXT } from '../../copy/settings'

const TITLE = COMMON_TEXT.catalogMessage

const LEAVE = {
  question: SETTINGS_TEXT.descartasElMensaje,
  detail: COMMON_TEXT.losesWhatYouEntered,
  keepLabel: COMMON_TEXT.noKeepEditing,
  discardLabel: COMMON_TEXT.yesDiscard,
}

export default function CatalogMessageGroup() {
  const [dirty, setDirty] = useState(false)
  return (
    <SettingsGroup title={TITLE} dirty={dirty} leave={LEAVE}>
      <CatalogMessageForm onDirtyChange={setDirty} />
    </SettingsGroup>
  )
}
