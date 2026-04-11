/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * OAuth Mercado Pago: intercambio de code por tokens y persistencia en MetodosPago del restaurante.
 */
import { getBackendUrl, getFrontendUrl } from '../../../config/urls';

const METODOS_PAGO_UID = 'api::metodos-pago.metodos-pago';
const RESTAURANTE_UID = 'api::restaurante.restaurante';

function getStrapi(ctx: any): any {
  return ctx?.strapi ?? (typeof global !== 'undefined' && (global as any).__STRAPI__) ?? null;
}

function getMpRedirectUri(strapi: any): string {
  const fromEnv = process.env.MP_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const base = getBackendUrl(strapi?.config).replace(/\/$/, '');
  return `${base}/api/auth/mercadopago/callback`;
}

async function findRestauranteByState(strapi: any, state: string): Promise<{ id: number; slug?: string } | null> {
  const trimmed = String(state || '').trim();
  if (!trimmed || !strapi?.db) return null;

  if (/^\d+$/.test(trimmed)) {
    const r = await strapi.db.query(RESTAURANTE_UID).findOne({
      where: { id: Number(trimmed) },
      select: ['id', 'slug'],
    });
    if (r?.id != null) return { id: Number(r.id), slug: r.slug };
  }

  let r = await strapi.db.query(RESTAURANTE_UID).findOne({
    where: { documentId: trimmed },
    select: ['id', 'slug'],
  });
  if (r?.id != null) return { id: Number(r.id), slug: r.slug };

  r = await strapi.db.query(RESTAURANTE_UID).findOne({
    where: { slug: trimmed },
    select: ['id', 'slug'],
  });
  if (r?.id != null) return { id: Number(r.id), slug: r.slug };

  return null;
}

async function upsertMercadoPagoTokens(
  strapi: any,
  restauranteId: number,
  accessToken: string,
  refreshToken: string | undefined,
): Promise<void> {
  const rows = await strapi.entityService.findMany(METODOS_PAGO_UID, {
    filters: { restaurante: restauranteId, provider: 'mercado_pago' },
    limit: 10,
  });
  const list = Array.isArray(rows) ? rows : [];
  const existing = list[0];

  const data: Record<string, unknown> = {
    provider: 'mercado_pago',
    mp_access_token: accessToken,
    active: true,
  };
  if (refreshToken != null && String(refreshToken).length > 0) {
    data.mp_refresh_token = refreshToken;
  }

  if (existing?.id != null) {
    await strapi.entityService.update(METODOS_PAGO_UID, existing.id, { data });
    return;
  }

  await strapi.entityService.create(METODOS_PAGO_UID, {
    data: {
      ...data,
      restaurante: restauranteId,
    },
  });
}

function redirectFrontend(ctx: any, path: string, query: Record<string, string>): void {
  const u = new URL(path, getFrontendUrl().replace(/\/$/, '') + '/');
  for (const [k, v] of Object.entries(query)) {
    u.searchParams.set(k, v);
  }
  ctx.redirect(u.toString());
}

export default {
  async mercadoPagoCallback(ctx: any) {
    const strapi = getStrapi(ctx);
    const q = ctx.query || {};

    if (q.error) {
      strapi?.log?.warn?.('[auth.mercadoPagoCallback] OAuth error:', q.error, q.error_description);
      redirectFrontend(ctx, '/owner', {
        mp_oauth: 'error',
        mp_msg: String(q.error_description || q.error || 'oauth_error'),
      });
      return;
    }

    const code = q.code;
    const state = q.state;
    if (!code || !state) {
      redirectFrontend(ctx, '/owner', { mp_oauth: 'error', mp_msg: 'missing_code_or_state' });
      return;
    }

    const clientId = process.env.MP_CLIENT_ID?.trim();
    const clientSecret = process.env.MP_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      strapi?.log?.error?.('[auth.mercadoPagoCallback] MP_CLIENT_ID o MP_CLIENT_SECRET ausentes');
      redirectFrontend(ctx, '/owner', { mp_oauth: 'error', mp_msg: 'server_misconfigured' });
      return;
    }

    const redirectUri = getMpRedirectUri(strapi);

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: String(code),
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    let tokenJson: any;
    try {
      const res = await fetch('https://api.mercadopago.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      tokenJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        strapi?.log?.warn?.('[auth.mercadoPagoCallback] token HTTP', res.status, tokenJson);
        redirectFrontend(ctx, '/owner', {
          mp_oauth: 'error',
          mp_msg: String(tokenJson?.message || tokenJson?.error || `token_${res.status}`),
        });
        return;
      }
    } catch (e: any) {
      strapi?.log?.warn?.('[auth.mercadoPagoCallback] fetch token', e?.message);
      redirectFrontend(ctx, '/owner', { mp_oauth: 'error', mp_msg: 'token_request_failed' });
      return;
    }

    const accessToken = tokenJson?.access_token;
    const refreshToken = tokenJson?.refresh_token;
    if (!accessToken || typeof accessToken !== 'string') {
      redirectFrontend(ctx, '/owner', { mp_oauth: 'error', mp_msg: 'invalid_token_response' });
      return;
    }

    const restaurante = await findRestauranteByState(strapi, String(state));
    if (!restaurante?.id) {
      redirectFrontend(ctx, '/owner', { mp_oauth: 'error', mp_msg: 'restaurant_not_found' });
      return;
    }

    try {
      await upsertMercadoPagoTokens(
        strapi,
        restaurante.id,
        accessToken.trim(),
        typeof refreshToken === 'string' ? refreshToken.trim() : undefined,
      );
    } catch (e: any) {
      strapi?.log?.error?.('[auth.mercadoPagoCallback] persist tokens', e?.message);
      redirectFrontend(ctx, '/owner', { mp_oauth: 'error', mp_msg: 'persist_failed' });
      return;
    }

    const slug = restaurante.slug && String(restaurante.slug).length > 0 ? String(restaurante.slug) : '';
    if (slug) {
      redirectFrontend(ctx, `/owner/${slug}/settings`, { mp_oauth: 'success' });
    } else {
      redirectFrontend(ctx, '/owner', { mp_oauth: 'success' });
    }
  },
};
