// backend/config/server.ts
export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),

  /** * IMPORTANTE: En Railway, PUBLIC_URL debe ser https://mozoqr-production.up.railway.app
   * Strapi usa esta URL para generar los enlaces de redirección interna.
   */
  url: env('PUBLIC_URL', 'http://localhost:1337'),

  /**
   * Ya lo tenés en true, lo cual es correcto para Railway.
   * Esto permite que Strapi confíe en las cabeceras X-Forwarded-Proto enviadas por el proxy.
   */
  proxy: true,

  app: {
    /**
     * Aseguráte de que en Railway la variable APP_KEYS tenga valores reales
     * para que las sesiones de Google sean persistentes y seguras.
     */
    keys: env.array('APP_KEYS'),
  },
  
  /**
   * Opcional: Podés forzar configuraciones de cookies de sesión aquí también 
   * si ves que plugins.ts no las toma, pero con lo que ya hicimos debería alcanzar.
   */
});