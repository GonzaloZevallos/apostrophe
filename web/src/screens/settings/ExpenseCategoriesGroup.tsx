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

export { CANNOT_REMOVE } from './ExpenseCategoriesEditor'

const LEAVE = {
  question: '¿Descartás la categoría?',
  detail: 'Se pierde lo que cargaste: todavía no se guardó nada.',
  keepLabel: 'No, seguí editando',
  discardLabel: 'Sí, descartala',
}

export default function ExpenseCategoriesGroup() {
  const [dirty, setDirty] = useState(false)
  return (
    <SettingsGroup title="Categorías de gastos" dirty={dirty} leave={LEAVE}>
      <ExpenseCategoriesEditor onDirtyChange={setDirty} />
    </SettingsGroup>
  )
}
