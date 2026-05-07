/**
 * Mercado Pago Checkout Pro: desde la web no hay API oficial para forzar la app.
 * Chrome suele abrir el checkout en el navegador si el Intent usa scheme=https.
 * Aquí usamos scheme=mercadopago en el Intent (Android) y mercadopago:// en iOS.
 *
 * IMPORTANTE: en móvil conviene llamar a tryOpenMercadoPagoNativeApp() desde un onClick
 * directo (p. ej. botón del diálogo), no justo después de un await, para no perder
 * el "user gesture" que bloquean algunos navegadores.
 */

export function shouldOfferMercadoPagoApp() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

export function openMercadoPagoInWebBrowser(initPoint) {
  const webUrl = String(initPoint || '').trim();
  if (!webUrl) return;
  window.location.href = webUrl;
}

/**
 * Llamar desde un handler de click (usuario). Intenta abrir la app MP.
 * Si no pasa nada, el usuario puede usar "Continuar en el navegador".
 *
 * @param {{ initPoint: string, preferenceId?: string|null }} opts
 */
export function tryOpenMercadoPagoNativeApp({ initPoint, preferenceId }) {
  const webUrl = String(initPoint || '').trim();
  if (!webUrl) return;

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isAndroid = /Android/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua);

  let parsed;
  try {
    parsed = new URL(webUrl);
  } catch {
    openMercadoPagoInWebBrowser(webUrl);
    return;
  }

  const pathAndQuery = `${parsed.pathname}${parsed.search}`;
  const host = parsed.host;
  const appUrl = `mercadopago://${host}${pathAndQuery}`;

  if (isAndroid) {
    // scheme=mercadopago para que el paquete de la app reciba el VIEW; fallback HTTPS = mismo checkout en el navegador
    const intent = `intent://${host}${pathAndQuery}#Intent;scheme=mercadopago;package=com.mercadopago.wallet;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    window.location.href = intent;
    return;
  }

  if (isIos) {
    window.location.href = appUrl;
    return;
  }

  openMercadoPagoInWebBrowser(webUrl);
}

/**
 * Escritorio: solo web. Móvil: preferí MercadoPagoLaunchDialog + tryOpenMercadoPagoNativeApp.
 */
export function openMercadoPagoCheckout({ initPoint, preferenceId }) {
  const webUrl = String(initPoint || '').trim();
  if (!webUrl) return;
  if (shouldOfferMercadoPagoApp()) {
    tryOpenMercadoPagoNativeApp({ initPoint: webUrl, preferenceId });
    return;
  }
  openMercadoPagoInWebBrowser(webUrl);
}
