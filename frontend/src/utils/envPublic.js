/**
 * UI pública de demo (/demo, CTAs en Home).
 * En build de producción queda desactivada salvo VITE_ENABLE_PUBLIC_DEMO_UI=true (p. ej. staging).
 */
export function isPublicDemoUiEnabled() {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_PUBLIC_DEMO_UI === 'true';
}

/**
 * Bypass de auth en staff/mostrador para restaurantes is_demo.
 * Solo en desarrollo o si VITE_ENABLE_DEMO_STAFF_BYPASS=true (no usar en prod real).
 */
export function isDemoStaffBypassEnabled() {
  return !import.meta.env.PROD || import.meta.env.VITE_ENABLE_DEMO_STAFF_BYPASS === 'true';
}
