/**
 * metodos-pago controller
 * El schema marca mp_access_token como private (Strapi ya no lo incluye en REST).
 * Sanitizamos por seguridad por si se usa entityService en custom routes.
 */

import { factories } from '@strapi/strapi';

const defaultController = factories.createCoreController('api::metodos-pago.metodos-pago');

function sanitizeEntry(entry: any): any {
  if (!entry) return entry;
  const attrs = entry.attributes ?? entry;
  if (typeof attrs !== 'object' || !('mp_access_token' in attrs)) return entry;
  const { mp_access_token, ...rest } = attrs;
  return entry.attributes ? { ...entry, attributes: rest } : { ...entry, ...rest };
}

export default factories.createCoreController('api::metodos-pago.metodos-pago', () => ({
  async find(ctx) {
    const result = await (defaultController as any).find(ctx);
    const data = result?.data;
    const sanitized = Array.isArray(data) ? data.map(sanitizeEntry) : data ? sanitizeEntry(data) : data;
    return { ...result, data: sanitized };
  },
  async findOne(ctx) {
    const result = await (defaultController as any).findOne(ctx);
    if (result?.data) result.data = sanitizeEntry(result.data);
    return result;
  },
}));
