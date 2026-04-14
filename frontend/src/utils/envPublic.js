/**
 * UI pública de demo (/demo, CTAs en Home).
 * En build de producción queda desactivada salvo VITE_ENABLE_PUBLIC_DEMO_UI=true (p. ej. staging).
 */
export function isPublicDemoUiEnabled() {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_PUBLIC_DEMO_UI === 'true';
}
