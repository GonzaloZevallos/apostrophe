/**
 * The one reader of a variety route's `:id` parameter (a variety is named by its integer
 * id, ADR-0033). A screen under it receives `varietyId` as a prop only. A parameter that is
 * not a whole number is a variety that is not there: "Eso ya no está.", and the API is
 * never asked.
 */

import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import GoneScreen from '../../components/GoneScreen'
import { TAB_VARIETIES } from '../../copy/shell'
import { VARIETIES } from '../../routes'

const WHOLE_NUMBER = /^[0-9]+$/

export default function VarietyRoute({ render }: { render: (varietyId: number) => ReactNode }) {
  const { id } = useParams<{ id: string }>()
  if (id === undefined || !WHOLE_NUMBER.test(id)) return <GoneScreen label={TAB_VARIETIES} to={VARIETIES} />
  return <>{render(Number(id))}</>
}
