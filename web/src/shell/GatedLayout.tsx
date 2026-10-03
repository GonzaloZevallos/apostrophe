/**
 * The gated branch of the router (plan, "Session": "Only the gated layout runs
 * `me`"). While `me` is pending or failed, nothing under it renders: a failed `me`
 * is a 401 most of the time, and `queryClient.ts`'s global handler already sends the
 * person to Entrar for that — this layout just has to not render stale children
 * meanwhile, never read `me`'s data as if it were there.
 */

import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router'
import { keys } from '../api/keys'
import { getMe } from '../api/me'

export default function GatedLayout() {
  const { data, isPending, isError } = useQuery({ queryKey: keys.me(), queryFn: getMe })
  if (isPending || isError || data === undefined) return null
  return <Outlet context={data} />
}
