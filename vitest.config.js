import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node'
  },
  resolve: {
    alias: {
      '../mobxVueBridge.js': '/src/mobxVueBridge.js',
      '../mobxVueBridge': '/src/mobxVueBridge.js'
    }
  }
})