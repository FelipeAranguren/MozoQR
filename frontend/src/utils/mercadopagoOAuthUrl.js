import { getStrapiPublicBase } from './strapiPublicBase';

const MP_AUTH_BASE = 'https://auth.mercadopago.com/authorization';

/**
 * URL de callback OAuth (debe coincidir con la registrada en Mercado Pago y con MP_REDIRECT_URI en el backend).
 * Si usás VITE_API_URL=/api (proxy), definí VITE_MP_OAUTH_REDIRECT_URI o VITE_STRAPI_URL con el origen real de Strapi.
 */
export function getMercadoPagoOAuthRedirectUri() {
  const full = import.meta.env?.VITE_MP_OAUTH_REDIRECT_URI?.trim();
  if (full) return full.replace(/\/$/, '');

  const strapiOrigin = import.meta.env?.VITE_STRAPI_URL?.trim();
  if (strapiOrigin?.startsWith('http')) {
    const base = strapiOrigin.replace(/\/api\/?$/, '').replace(/\/$/, '');
    return `${base}/api/auth/mercadopago/callback`;
  }

  const base = getStrapiPublicBase().replace(/\/$/, '');
  return `${base}/api/auth/mercadopago/callback`;
}

/**
 * @param {{ state: string, clientId?: string }} opts - state = id del restaurante para el callback (documentId o id numérico)
 */
export function buildMercadoPagoAuthorizationUrl(opts) {
  const clientId = opts.clientId?.trim() || import.meta.env?.VITE_MP_CLIENT_ID?.trim();
  if (!clientId) return null;

  const redirectUri = getMercadoPagoOAuthRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    platform_id: 'mp',
    state: String(opts.state),
    redirect_uri: redirectUri,
  });

  return `${MP_AUTH_BASE}?${params.toString()}`;
}
