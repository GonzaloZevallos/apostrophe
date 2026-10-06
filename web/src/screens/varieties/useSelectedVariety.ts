/**
 * `useSelectedVariety`: on a computer, which variety the right pane shows when the list is
 * opened with none chosen: the first by name, and only once the list has resolved and holds
 * one. While it loads, or with no varieties, there is none (the pane then holds no figure).
 * It shares the list's own query, so no extra request is made. The caller replaces the
 * history entry with it, so the automatic choice is not a step Back has to undo.
 */

import { useQuery } from '@tanstack/react-query'
import { get } from '../../api/client'
import { keys } from '../../api/keys'
import type { Variety } from '../Variedades'
import { varietiesByName } from './varietiesByName'

export function useSelectedVariety(): number | null {
  const { data } = useQuery({ queryKey: keys.varieties(), queryFn: () => get<Variety[]>('/varieties') })
  return data === undefined ? null : (varietiesByName(data)[0]?.id ?? null)
}
