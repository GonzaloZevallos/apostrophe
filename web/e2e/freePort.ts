/**
 * Picks one free TCP port on `host` (`web/e2e/fixtures.ts` is the only caller, once
 * per attempt to start a worker's backend). Binds to port 0 — the
 * OS assigns an unused ephemeral port — reads it back, releases the socket and
 * resolves the port so the caller can bind it again itself. No retry here: a port taken
 * between this release and the real bind makes the child exit, and the fixture retries
 * with a new port (ADR-0040).
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
