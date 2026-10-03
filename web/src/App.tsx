/**
 * The router (plan, "Session"): a public branch (`/entrar`, `/invitation/:token`)
 * and a gated branch, exactly as the plan's invariants ask — no gated query mounts
 * under the public paths, because `GatedLayout` (which runs `me`) is simply not in
 * their element tree. `RouterSync` keeps `queryClient.ts`'s notion of "where am I"
 * current, so a 401 on a gated call knows whether the screen it happened on is
 * public (plan, invariants: "a 401 does nothing on a public route").
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import SinConexion from './components/SinConexion'
import { queryClient, setCurrentPath, setNavigate } from './queryClient'
import Entrar from './screens/Entrar'
import Inicio from './screens/Inicio'
import Invitacion from './screens/Invitacion'
import Mas from './screens/Mas'
import Negocio from './screens/Negocio'
import GatedLayout from './shell/GatedLayout'
import Shell from './shell/Shell'
import { useOnline } from './useOnline'

function RouterSync() {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    setCurrentPath(location.pathname)
    setNavigate(navigate)
  }, [location.pathname, navigate])
  return null
}

function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="aviso-flotante">
      <SinConexion />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RouterSync />
        <OfflineBanner />
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/invitation/:token" element={<Invitacion />} />
          <Route element={<GatedLayout />}>
            <Route element={<Shell />}>
              <Route index element={<Inicio />} />
              <Route path="mas" element={<Mas />} />
              <Route path="negocio" element={<Negocio />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
