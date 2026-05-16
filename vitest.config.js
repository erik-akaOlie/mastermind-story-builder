import { defineConfig, defaultExclude } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    // Defaults exclude node_modules/dist/.git/etc. but NOT .claude — any
    // worktree spawned under .claude/worktrees/ bundles its own node_modules
    // and test files; without this guard, Vitest re-runs those copies against
    // the wrong React instance and reports phantom failures.
    exclude: [...defaultExclude, '**/.claude/**'],
  },
})
