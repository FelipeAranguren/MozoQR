import { isAxiosOrNetworkError } from './networkError';

/**
 * Ejecuta una función async con reintentos en caso de fallo.
 * @param {() => Promise<T>} fn - Función que retorna una promesa
 * @param {Object} options - Opciones
 * @param {number} options.maxRetries - Máximo de reintentos (default: 2)
 * @param {number} options.delayMs - Delay base entre reintentos en ms (default: 1000)
 * @param {boolean} options.exponential - Si true, el delay crece como delayMs * 2^attempt (tope maxDelayMs)
 * @param {number} options.maxDelayMs - Tope de espera entre intentos (default: 30000)
 * @param {(err: Error) => boolean} options.shouldRetry - Si retornar true, se reintenta (default: red/5xx)
 * @returns {Promise<T>}
 */
export async function withRetry(
  fn,
  { maxRetries = 2, delayMs = 1000, exponential = false, maxDelayMs = 30000, shouldRetry } = {}
) {
  let lastError;
  const defaultShouldRetry = (e) => {
    const status = e?.response?.status;
    if (isAxiosOrNetworkError(e)) return true;
    return typeof status === 'number' && status >= 500 && status < 600;
  };
  const shouldRetryFn = shouldRetry ?? defaultShouldRetry;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const canRetry = attempt < maxRetries;
      if (!canRetry || !shouldRetryFn(err)) throw err;
      let wait = delayMs;
      if (exponential) {
        wait = Math.min(maxDelayMs, delayMs * Math.pow(2, attempt));
      }
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastError;
}
