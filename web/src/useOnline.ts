/**
 * `navigator.onLine` plus the `online`/`offline` events (`accounts.md`, "No
 * network"): "Sin conexión" does not depend on the service worker and holds on any
 * origin. A dropped request (`NetworkError`, `api/client.ts`) is the other half —
 * screens that make their own request check that themselves — this hook is the
 * proactive half, true the instant the browser itself says the network is gone.
 */

import { useEffect, useState } from 'react'

export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() => navigator.onLine)

  useEffect(() => {
    function goOnline(): void {
      setOnline(true)
    }
    function goOffline(): void {
      setOnline(false)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
