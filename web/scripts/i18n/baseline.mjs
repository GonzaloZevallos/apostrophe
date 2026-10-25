// `npm run i18n:baseline [-- --update]`: runs the baseline script through vitest, which
// provides the `import.meta.glob` the script reads the copy files with.
import { spawnSync } from 'node:child_process'

const mode = process.argv.includes('--update') ? 'update' : 'default'
const { status } = spawnSync('npx', ['vitest', 'run', 'scripts/i18n/baseline.run.test.ts'], {
  stdio: 'inherit',
  env: { ...process.env, I18N_BASELINE: mode },
})
process.exit(status ?? 1)
