import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/computers': 'http://localhost:8080',
      '/buildings': 'http://localhost:8080',
      '/tasks': 'http://localhost:8080',
      '/ping': 'http://localhost:8080',
      '/auth': 'http://localhost:8080',
      '/building-networks': 'http://localhost:8080',
    },
  },
})
