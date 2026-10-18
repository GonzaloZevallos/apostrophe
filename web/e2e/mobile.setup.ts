/**
 * Seeds the phone check's server once (GH-80): `scripts/design/mobile_seed.py` mints the
 * invitation with the operator's own command, seeds over HTTP and writes the session
 * `storageState` (cookie only, no origins) and the ids the registry's placeholders name.
 */

import { execFileSync } from 'node:child_process'
import { test as setup } from '@playwright/test'
import { MOBILE_FACTS_FILE, MOBILE_STATE_FILE, mobileBaseUrl, mobileEnv } from './env.js'

setup('seed the mobile server', () => {
  execFileSync(
    'uv',
    [
      'run', '--no-project', 'python', 'scripts/design/mobile_seed.py',
      '--base', mobileBaseUrl(),
      '--state', `web/${MOBILE_STATE_FILE}`,
      '--facts', `web/${MOBILE_FACTS_FILE}`,
    ],
    { cwd: '..', env: { ...process.env, ...mobileEnv() }, encoding: 'utf-8' },
  )
})
