// src/api.js
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// 👇 NUEVO helper para endpoints namespaced
export const withSlug = (slug, path) => `/restaurants/${slug}${path}`;