/**
 * The "Categorías de gastos" group of Configuración (`ConfiguracionCategorias.dc.html`,
 * `ConfiguracionCategoriasCompu.dc.html`; `docs/product/expenses.md`, "Expense category"):
 * the frame (title, "Cerrar", the unsaved-changes ask) around `ExpenseCategoriesEditor`, which
 * is shared with the Onboarding's categories step and tells the group whether something typed
 * is not saved yet.
 */

import { useState } from 'react'
import { GROUP_EXPENSE_CATEGORIES, LEAVE_CATEGORY } from '../../copy/settings'
import ExpenseCategoriesEditor from './ExpenseCategoriesEditor'
import SettingsGroup from './SettingsGroup'

export default function ExpenseCategoriesGroup() {
  const [dirty, setDirty] = useState(false)
  return (
    <SettingsGroup title={GROUP_EXPENSE_CATEGORIES} dirty={dirty} leave={LEAVE_CATEGORY}>
      <ExpenseCategoriesEditor onDirtyChange={setDirty} />
    </SettingsGroup>
  )
}
