/**
 * Ejecuta una función async con reintentos en caso de fallo.
 * @param {() => Promise<T>} fn - Función que retorna una promesa
 * @param {Object} options - Opciones
 * @param {number} options.maxRetries - Máximo de reintentos (default: 2)
 * @param {number} options.delayMs - Delay entre reintentos en ms (default: 1000)
 * @param {(err: Error) => boolean} options.shouldRetry - Si retornar true, se reintenta (default: retry en errores de red o 5xx)
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { maxRetries = 2, delayMs = 1000, shouldRetry } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const canRetry = attempt < maxRetries;
      const shouldRetryFn = shouldRetry ?? ((e) => {
        const status = e?.response?.status;
        const isNetworkError = !e?.response && e?.message?.includes('Network');
        return isNetworkError || (status >= 500 && status < 600);
      });
      if (!canRetry || !shouldRetryFn(err)) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}
