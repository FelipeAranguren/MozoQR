/**
 * Precios base de planes en USD (Básico, Pro, Ultra).
 * Se convierten a ARS usando la cotización del dólar blue.
 */
export const PLAN_BASE_USD = {
  BASIC: 0.0007,
  PRO: 80,
  ULTRA: 100
};

const formatterARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/**
 * Formatea un número como precio en ARS (ej: $123.456).
 */
export function formatPriceARS(value) {
  if (value == null || Number.isNaN(Number(value))) return '$0';
  return formatterARS.format(Number(value));
}

/**
 * Formatea un número como USD (ej: USD 50).
 */
export function formatPriceUSD(value) {
  if (value == null || Number.isNaN(Number(value))) return 'USD 0';
  return `USD ${Number(value)}`;
}
