import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The main game chunk is ~240 kB gzipped; the only larger chunk is the lazily-loaded MapLibre map (/map).
    chunkSizeWarningLimit: 1000,
  },
  server: {
    proxy: {
      // Forward /api → FastAPI (P4 + P5 local run)
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
