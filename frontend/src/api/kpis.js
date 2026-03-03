import { client, unwrap } from './client';

/**
 * Fetch KPIs
 */
export async function fetchKpis(slug) {
    const res = await client.get(`/restaurants/${slug}/kpis`);
    return unwrap(res);
}

/**
 * Get CSV export URL
 */
export function exportCsvUrl(slug, { start, end, status } = {}) {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    if (status) params.set('status', status);

    // Use client.defaults.baseURL to construct the full URL
    const baseURL = client.defaults.baseURL;
    const url = `${baseURL}/restaurants/${slug}/export?${params.toString()}`;
    return url;
}
