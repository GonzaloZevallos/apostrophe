/**
 * The Expenses card on the phone's Analysis: "Add expense" opens the Expense form (with
 * today's date, as it does from Expenses) and "See the expenses" opens Expenses. It does not
 * wait for the analysis to answer: both actions are always there. The computer reaches
 * Expenses from the side rail, so there the card draws nothing.
 */

import { useTranslation } from 'react-i18next'
import BotonLink from '../../components/BotonLink'
import { EXPENSE_NEW, EXPENSES } from '../../routes'
import { useViewport } from '../../shell/useViewport'

export default function ExpensesCard() {
  const { t } = useTranslation()
  if (useViewport() === 'computer') return null
  return (
    <div role="group" aria-label={t('common:expenses')} className="analisis__gastos">
      <span className="rotulo">{t('common:expenses')}</span>
      <BotonLink to={EXPENSE_NEW} icon="agregar">
        {t('common:addExpense')}
      </BotonLink>
      <BotonLink to={EXPENSES} variant="link">
        {t('common:seeExpenses')}
      </BotonLink>
    </div>
  )
}
