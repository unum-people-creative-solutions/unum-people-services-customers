import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Mesmo fuso do CI (UTC): data formatada sem fuso explícito não passa por acaso na máquina local.
    env: { TZ: 'UTC' },
    globals: true,
    setupFiles: './src/test/setup.tsx',
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
