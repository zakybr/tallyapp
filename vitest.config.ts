import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  resolve: { alias: { '@shared': resolve(import.meta.dirname, 'src/shared') } },
  test: {
    include: process.env.INTEGRATION ? ['tests/integration/**/*.test.ts'] : ['tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 180_000
  }
})
