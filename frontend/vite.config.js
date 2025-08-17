// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',       // evita [::1] que rompe con túneles
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: 'wss',       // Live Share expone https → HMR por wss
      clientPort: 443        // usa el puerto 443 del túnel
      // sin "host": toma el hostname de la URL del túnel
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:1337', // mejor IPv4 que "localhost"
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api/, '')
      }
    }
  }
})
