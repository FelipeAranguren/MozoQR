/**
 * Abre el checkout de Mercado Pago intentando la app nativa en móvil y
 * cayendo al init_point HTTPS en el navegador si no hay app o el esquema falla.
 *
 * @param {{ initPoint: string, preferenceId?: string|null }} opts
 */
export function openMercadoPagoCheckout({ initPoint, preferenceId }) {
  const webUrl = String(initPoint || '').trim();
  if (!webUrl) return;

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isAndroid = /Android/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isMobile = isAndroid || isIos || /Mobile/i.test(ua);

  if (!isMobile) {
    window.location.href = webUrl;
    return;
  }

  let urlObj;
  try {
    urlObj = new URL(webUrl);
  } catch {
    window.location.href = webUrl;
    return;
  }

  if (isAndroid) {
    try {
      const pathQuery = `${urlObj.pathname}${urlObj.search}`;
      const scheme = urlObj.protocol.replace(/:$/, '') || 'https';
      const intent = `intent://${urlObj.host}${pathQuery}#Intent;scheme=${scheme};package=com.mercadopago.wallet;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
      window.location.href = intent;
      return;
    } catch {
      /* fall through */
    }
    window.location.href = webUrl;
    return;
  }

  if (isIos) {
    const appUrl = webUrl.replace(/^https:\/\//i, 'mercadopago://');
    const fallbackMs = 1100;
    let done = false;
    const goWeb = () => {
      if (done) return;
      if (document.visibilityState === 'visible') {
        done = true;
        window.location.href = webUrl;
      }
    };
    const timer = window.setTimeout(goWeb, fallbackMs);
    const cancel = () => {
      window.clearTimeout(timer);
      done = true;
    };
    window.addEventListener('pagehide', cancel, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') cancel();
    });
    window.location.href = appUrl;
    return;
  }

  window.location.href = webUrl;
}
