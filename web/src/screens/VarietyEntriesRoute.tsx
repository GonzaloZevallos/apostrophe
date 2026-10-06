/**
 * `VarietyEntriesRoute`: the host of `/varieties/:id/entries`. It reads the `:id`
 * parameter and hands `EntriesList` a number, or shows "Eso ya no está." for an id that is
 * not an integer (the route's own matcher only ever serves digits, ADR-0027).
 */

import { useParams } from 'react-router'
import GoneScreen from '../components/GoneScreen'
import { VARIETIES } from '../routes'
import EntriesList from './EntriesList'

export default function VarietyEntriesRoute() {
  const { id } = useParams<{ id: string }>()
  const varietyId = Number(id)
  if (id === undefined || !/^[0-9]+$/.test(id) || !Number.isSafeInteger(varietyId)) {
    return <GoneScreen label="Variedades" to={VARIETIES} />
  }
  return <EntriesList varietyId={varietyId} />
}
