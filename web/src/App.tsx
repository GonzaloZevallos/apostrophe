/**
 * The app's root component (plan, "Session"; "Shape"): the query client plus the
 * data router built in `router.tsx` (`createBrowserRouter`/`RouterProvider`,
 * needed so `useBlocker` can catch Back — see that file for why the route table
 * itself lives there and not here).
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { queryClient } from './queryClient'
import { router } from './router'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
