/**
 * Agrega historial de pedidos pagados y llama a Google Gemini (tier gratuito vía Google AI Studio).
 * La API key va en GEMINI_API_KEY (nunca en el frontend).
 */

const MAX_ORDERS_SCAN = 12_000;
const BATCH = 400;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];

type ProductAgg = { qty: number; revenue: number };

function weekdayName(d: Date): string {
  const names = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return names[d.getUTCDay()] ?? '';
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function isWeeklyCacheFresh(generatedAt: string | Date | null | undefined): boolean {
  if (!generatedAt) return false;
  const t = new Date(generatedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < WEEK_MS;
}

/**
 * Recorre todos los pedidos pagados del restaurante (en lotes) y arma un resumen textual compacto.
 */
export async function buildOrderHistorySummary(
  strapi: any,
  restauranteId: number,
  restaurantName: string
): Promise<string> {
  const productMap = new Map<string, ProductAgg>();
  const byMonth = new Map<string, { orders: number; revenue: number }>();
  const byWeekday = new Map<string, { orders: number; revenue: number }>();
  const byHour = new Map<number, { orders: number }>();
  const paymentMethodCounts = new Map<string, number>();

  let orderCount = 0;
  let revenueTotal = 0;
  let firstDate: Date | null = null;
  let lastDate: Date | null = null;
  let start = 0;

  while (orderCount < MAX_ORDERS_SCAN) {
    const chunk = await strapi.entityService.findMany('api::pedido.pedido', {
      filters: { restaurante: restauranteId, order_status: 'paid' },
      fields: ['id', 'total', 'createdAt', 'payment_method'],
      populate: {
        items: {
          fields: ['quantity', 'UnitPrice', 'totalPrice'],
          populate: { product: { fields: ['name', 'price'] } },
        },
      },
      sort: { createdAt: 'asc' },
      start,
      limit: BATCH,
    });

    if (!chunk?.length) break;

    for (const o of chunk) {
      if (orderCount >= MAX_ORDERS_SCAN) break;
      const total = Number(o.total || 0);
      const created = o.createdAt ? new Date(o.createdAt) : null;
      if (created && Number.isFinite(created.getTime())) {
        if (!firstDate || created < firstDate) firstDate = created;
        if (!lastDate || created > lastDate) lastDate = created;
        const mk = monthKey(created);
        const m = byMonth.get(mk) || { orders: 0, revenue: 0 };
        m.orders += 1;
        m.revenue += total;
        byMonth.set(mk, m);

        const wk = weekdayName(created);
        const w = byWeekday.get(wk) || { orders: 0, revenue: 0 };
        w.orders += 1;
        w.revenue += total;
        byWeekday.set(wk, w);

        const h = created.getUTCHours();
        const hh = byHour.get(h) || { orders: 0 };
        hh.orders += 1;
        byHour.set(h, hh);
      }

      if (o.payment_method) {
        const pm = String(o.payment_method);
        paymentMethodCounts.set(pm, (paymentMethodCounts.get(pm) || 0) + 1);
      }

      revenueTotal += total;
      orderCount += 1;

      const items = o.items || [];
      for (const it of items) {
        const qty = Math.max(0, Number(it.quantity || 0));
        const pname =
          (it.product && (it.product.name || (it.product as any).attributes?.name)) ||
          'Producto sin nombre';
        const lineRev =
          Number(it.totalPrice || 0) ||
          Number(it.UnitPrice || it.product?.price || 0) * qty ||
          (total > 0 && items.length ? total / items.length : 0);
        const agg = productMap.get(pname) || { qty: 0, revenue: 0 };
        agg.qty += qty;
        agg.revenue += lineRev;
        productMap.set(pname, agg);
      }
    }

    if (chunk.length < BATCH) break;
    start += BATCH;
  }

  const productsSorted = Array.from(productMap.entries())
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 40);

  const monthsSorted = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const weekdaysOrder = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const weekdayLines = weekdaysOrder.map((d) => {
    const x = byWeekday.get(d);
    return x ? `${d}: ${x.orders} pedidos, facturación ~${Math.round(x.revenue)}` : `${d}: 0 pedidos`;
  });

  const hourLines = Array.from({ length: 24 }, (_, h) => {
    const x = byHour.get(h);
    return `${String(h).padStart(2, '0')}h: ${x?.orders || 0}`;
  }).join(', ');

  const paymentLines = Array.from(paymentMethodCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');

  const productBlock = productsSorted
    .map(([name, { qty, revenue }]) => `- ${name}: ${qty} uds vendidas, ~${Math.round(revenue)} en líneas`)
    .join('\n');

  const monthBlock = monthsSorted
    .map(([k, { orders, revenue }]) => `- ${k}: ${orders} pedidos, facturación total ~${Math.round(revenue)}`)
    .join('\n');

  const catalog = await strapi.entityService.findMany('api::producto.producto', {
    filters: { restaurante: restauranteId },
    fields: ['name', 'price', 'available'],
    limit: 500,
  });
  const catalogLines = (catalog || [])
    .map((p: any) => `- ${p.name} (${p.available === false ? 'no disponible' : 'disponible'}), precio lista ${p.price}`)
    .slice(0, 120)
    .join('\n');

  return [
    `Restaurante: ${restaurantName}`,
    `Pedidos pagados analizados: ${orderCount} (tope técnico ${MAX_ORDERS_SCAN}; si hay más en BD, este es un muestreo completo hasta el tope).`,
    `Facturación total pedidos (suma de totales de pedido): ~${Math.round(revenueTotal)}`,
    firstDate && lastDate
      ? `Rango de fechas: ${firstDate.toISOString().slice(0, 10)} a ${lastDate.toISOString().slice(0, 10)}`
      : 'Rango de fechas: sin datos',
    '',
    '## Catálogo actual (extracto)',
    catalogLines || '(sin productos)',
    '',
    '## Top productos por unidades vendidas (histórico analizado)',
    productBlock || '(sin líneas de ítems)',
    '',
    '## Pedidos y facturación por mes (UTC)',
    monthBlock || '(sin series)',
    '',
    '## Por día de la semana (UTC)',
    ...weekdayLines,
    '',
    '## Distribución horaria pedidos (UTC, 0-23)',
    hourLines,
    '',
    '## Métodos de pago (conteo de pedidos)',
    paymentLines || '(sin datos)',
  ].join('\n');
}

async function callGeminiOnce(apiKey: string, model: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.65,
        maxOutputTokens: 8192,
      },
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${raw.slice(0, 500)}`);
  }
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Respuesta Gemini no JSON');
  }
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
  if (!text.trim()) {
    throw new Error('Gemini no devolvió texto');
  }
  return text.trim();
}

export async function generateWeeklyReportMarkdown(apiKey: string, dataSummary: string): Promise<string> {
  const prompt = `Sos un asesor gastronómico y de operaciones para restaurantes en Argentina (español rioplatense).

Te paso datos REALES agregados del historial de pedidos pagados y del menú actual. No inventes cifras que no estén implícitas en los datos. Si algo falta, decilo.

Tareas:
1) **Resumen ejecutivo** (3-5 oraciones).
2) **Recomendaciones accionables** esta semana (lista concretas: precios, horarios, staffing, promos).
3) **Riesgos u oportunidades** que se desprendan de tendencias (ej. caída mes a mes, día débil, hora pico).
4) **Ideas de combos o promos** alineadas a los productos que más se venden y al catálogo.
5) **Qué vigilar la próxima semana** (métricas o señales).

Formato: markdown simple con ## para secciones y listas con guiones. Sin emojis si podés evitarlos. Sé directo y profesional.

--- DATOS ---
${dataSummary}`;

  let lastErr: Error | null = null;
  for (const model of GEMINI_MODELS) {
    try {
      return await callGeminiOnce(apiKey.trim(), model, prompt);
    } catch (e: any) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr || new Error('Gemini falló');
}

export { WEEK_MS };
