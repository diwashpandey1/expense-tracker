import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    exclude: ['src/test/rules.test.js', 'src/test/ledgerIntegration.test.js', '**/node_modules/**', '**/dist/**'],
    clearMocks: true,
  },
})
