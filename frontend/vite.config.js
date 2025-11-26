// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Activá HTTPS solo cuando lo necesites:
//   VITE_DEV_HTTPS=1 npm run dev
const USE_HTTPS = process.env.VITE_DEV_HTTPS === '1';

export default defineConfig(async () => {
  let plugins = [react(), tailwindcss()];
  let server = {
    host: '127.0.0.1',   // evita [::1]
    port: 5173,
    strictPort: true,
    // sin HMR forzado: Vite decide lo mejor para tu entorno
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:1337', // Strapi
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  };

  // Solo si pedís HTTPS (para Mercado Pago con auto_return)
  if (USE_HTTPS) {
    // cargamos el plugin solo en modo HTTPS
    const basicSsl = (await import('@vitejs/plugin-basic-ssl')).default;
    plugins.push(basicSsl());
    server.https = true;

    // HMR: solo tocar si usás túnel/Live Share y lo necesitás.
    // Comentado por defecto para no degradar performance.
    // server.hmr = {
    //   protocol: 'wss',
    //   clientPort: 443,
    // };
  }

  return {
    plugins,
    server,
  };
});
