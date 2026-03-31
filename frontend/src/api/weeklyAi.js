import { api } from '../api';

/**
 * Informe semanal generado en el servidor con Gemini (caché 7 días por restaurante).
 */
export async function fetchWeeklyAiReport(slug, { force = false } = {}) {
  const qs = force ? '?force=1' : '';
  const res = await api.get(`/owner/${slug}/weekly-ai-report${qs}`);
  return res.data;
}
