/**
 * Strapi suele devolver { error: { status, message, name, details } }.
 * Si pasamos eso a React como hijo → error #31 (objeto no válido como hijo).
 */
export function formatStrapiErrorPayload(data) {
  if (data == null) return 'Error desconocido';
  if (typeof data === 'string') return data;
  const err = data.error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const msg = err.message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    const name = err.name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  const top = data.message;
  if (typeof top === 'string' && top.trim()) return top.trim();
  try {
    return JSON.stringify(data);
  } catch {
    return 'Error desconocido';
  }
}

export function formatAxiosError(err) {
  if (err?.response?.data != null) return formatStrapiErrorPayload(err.response.data);
  if (typeof err?.message === 'string' && err.message) return err.message;
  return 'Error de red';
}
