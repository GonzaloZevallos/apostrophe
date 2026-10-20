/**
 * The "Categorías de gastos" group of Configuración (`ConfiguracionCategorias.dc.html`,
 * `ConfiguracionCategoriasCompu.dc.html`; `docs/product/expenses.md`, "Expense category"):
 * the frame (title, "Cerrar", the unsaved-changes ask) around `ExpenseCategoriesEditor`, which
 * is shared with the Onboarding's categories step and tells the group whether something typed
 * is not saved yet.
 */

import { useState } from 'react'
import ExpenseCategoriesEditor from './ExpenseCategoriesEditor'
import SettingsGroup from './SettingsGroup'
import { SETTINGS_TEXT } from '../../copy/settings'
import { COMMON_TEXT } from '../../copy/common'

export { CANNOT_REMOVE } from './ExpenseCategoriesEditor'

const LEAVE = {
  question: SETTINGS_TEXT.descartasLaCategoria,
  detail: COMMON_TEXT.sePierdeLoQue,
  keepLabel: COMMON_TEXT.noSeguiEditando,
  discardLabel: COMMON_TEXT.siDescartala,
}

export default function ExpenseCategoriesGroup() {
  const [dirty, setDirty] = useState(false)
  return (
    <SettingsGroup title={COMMON_TEXT.categoriasDeGastos} dirty={dirty} leave={LEAVE}>
      <ExpenseCategoriesEditor onDirtyChange={setDirty} />
    </SettingsGroup>
  )
}
