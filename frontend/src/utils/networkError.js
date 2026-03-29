/**
 * Detecta fallos de red típicos de Axios/fetch (sin respuesta HTTP o códigos de red).
 * No considera "sin .response" a menos que sea un error de Axios de red o código conocido.
 */
export function isAxiosOrNetworkError(err) {
  if (!err) return false;
  const code = String(err.code || err?.cause?.code || '').toUpperCase();
  if (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    code === 'ERR_INTERNET_DISCONNECTED'
  ) {
    return true;
  }
  const msg = String(err.message || '').toLowerCase();
  if (msg.includes('network error') || msg.includes('failed to fetch') || msg.includes('load failed')) {
    return true;
  }
  if (err.isAxiosError && !err.response) {
    return true;
  }
  const status = err.response?.status;
  return typeof status === 'number' && status >= 500 && status < 600;
}
