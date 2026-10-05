/**
 * Picks one free TCP port on `host` (plan, "Build": `web/playwright.config.ts` is the
 * only caller, and only when `APOSTROPHE_E2E_PORT` is unset). Binds to port 0 — the
 * OS assigns an unused ephemeral port — reads it back, releases the socket and
 * resolves the port so the caller can bind it again itself. No retry: a port taken
 * between this release and the real bind fails loudly instead (plan, "Known risks,
 * accepted").
 */

import * as net from 'node:net'

export function freePort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', (error) => {
      reject(error)
    })
    server.listen(0, host, () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        server.close()
        reject(new Error('freePort: the server produced no address'))
        return
      }
      const { port } = address
      server.close((closeError) => {
        if (closeError) reject(closeError)
        else resolve(port)
      })
    })
  })
}
