/**
 * Configuración de pagos (Mercado Pago).
 * Strapi carga estas variables al arranque con env(); en Railway definí MP_ACCESS_TOKEN en Variables.
 */
export default ({ env }: { env: (key: string, fallback?: string) => string }) => ({
  mpAccessToken: String(env('MP_ACCESS_TOKEN', '') || '').trim(),
});
