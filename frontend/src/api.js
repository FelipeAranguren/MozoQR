import { client } from './api/client';

export const api = client;


// 👇 NUEVO helper para endpoints namespaced
export const withSlug = (slug, path) => `/restaurants/${slug}${path}`;