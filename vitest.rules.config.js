import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/test/rules.test.js'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
