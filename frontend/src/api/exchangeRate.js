/**
 * Servicio para obtener el tipo de cambio USD → ARS (Argentina).
 * Usa DolarAPI.com (dólar oficial - venta).
 */

const DOLAR_API_BASE = 'https://dolarapi.com';

/**
 * Obtiene el valor del dólar en ARS (precio de venta).
 * @returns {Promise<number|null>} Cotización venta (ARS por 1 USD) o null si falla.
 */
export async function getUsdArsRate() {
  try {
    const res = await fetch(`${DOLAR_API_BASE}/v1/dolares/oficial`);
    if (!res.ok) return null;
    const data = await res.json();
    const venta = Number(data?.venta);
    return Number.isFinite(venta) && venta > 0 ? venta : null;
  } catch {
    return null;
  }
}

/** Valor fallback si la API no responde (ej. para desarrollo o sin red). */
export const FALLBACK_USD_ARS = 1000;

/**
 * Formatea un número con separadores de miles y dos decimales (locale es-AR).
 * @param {number} value
 * @returns {string}
 */
export function formatArs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0,00';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
