// frontend/src/utils/receipt.js

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n) || 0);
}

function fmtDateTime(d) {
  try {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleString('es-AR');
  } catch {
    return '';
  }
}

/**
 * Abre una ventana con un ticket imprimible (80mm) y opcionalmente dispara window.print().
 * Esto cubre:
 * - Cliente: “Guardar como PDF” desde el diálogo de imprimir del teléfono
 * - Staff: imprimir a impresora térmica desde el diálogo de imprimir (configurar papel 80mm)
 */
export function openReceiptWindow({
  restaurant = {},
  mesaNumber,
  orderId,
  items = [],
  subtotal,
  discount,
  total,
  paidAt,
  paymentMethod,
  staffNotes,
  customerNotes,
  title = 'Cuenta / Ticket',
  autoPrint = true,
} = {}) {
  const legalName = restaurant.billing_legal_name || restaurant.name || '';
  const cuit = restaurant.billing_cuit || '';
  const addr = restaurant.billing_address || '';
  const iva = restaurant.billing_iva_condition || '';
  const phone = restaurant.billing_phone || '';
  const email = restaurant.billing_email || '';
  const footer = restaurant.receipt_footer || '';

  const lines = (items || []).map((it) => ({
    name: it?.name || it?.productName || it?.product?.name || 'Producto',
    qty: Number(it?.quantity || it?.qty || 1) || 1,
    price: Number(it?.unitPrice ?? it?.UnitPrice ?? it?.price ?? 0) || 0,
    total: Number(it?.totalPrice ?? it?.total ?? (Number(it?.unitPrice ?? it?.UnitPrice ?? it?.price ?? 0) * (Number(it?.quantity || it?.qty || 1) || 1))) || 0,
  }));

  const computedSubtotal = subtotal != null ? Number(subtotal) : lines.reduce((s, l) => s + (Number(l.total) || 0), 0);
  const computedTotal = total != null ? Number(total) : computedSubtotal - (Number(discount) || 0);

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    :root { --w: 80mm; }
    @page { size: var(--w) auto; margin: 6mm; }
    body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 0; }
    .paper { width: var(--w); max-width: 100%; }
    h1 { font-size: 14px; margin: 0 0 6px; text-align: center; }
    .meta { font-size: 11px; line-height: 1.3; text-align: center; }
    .hr { border-top: 1px dashed #999; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; }
    .small { font-size: 10px; color: #444; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    td { padding: 4px 0; vertical-align: top; }
    td.qty { width: 16mm; }
    td.price { width: 22mm; text-align: right; white-space: nowrap; }
    td.total { width: 22mm; text-align: right; white-space: nowrap; }
    .totals .row { font-size: 12px; }
    .totals .grand { font-weight: 800; font-size: 13px; }
    .notes { font-size: 10.5px; white-space: pre-wrap; }
    .actions { margin: 10px 0 0; display: none; }
    @media screen {
      body { background: #f4f4f4; padding: 12px; }
      .paper { background: white; padding: 10px; border: 1px solid #ddd; border-radius: 8px; }
      .actions { display: block; }
      button { width: 100%; padding: 10px; font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="paper">
    <h1>${esc(legalName || 'Cuenta')}</h1>
    <div class="meta">
      ${cuit ? `<div><strong>CUIT:</strong> ${esc(cuit)}</div>` : ``}
      ${iva ? `<div><strong>IVA:</strong> ${esc(iva)}</div>` : ``}
      ${addr ? `<div>${esc(addr)}</div>` : ``}
      ${(phone || email) ? `<div class="small">${esc([phone, email].filter(Boolean).join(' · '))}</div>` : ``}
    </div>

    <div class="hr"></div>

    <div class="row"><div><strong>Mesa</strong></div><div>${esc(mesaNumber ?? '—')}</div></div>
    ${orderId ? `<div class="row"><div><strong>Pedido</strong></div><div>${esc(orderId)}</div></div>` : ``}
    <div class="row"><div><strong>Fecha</strong></div><div>${esc(fmtDateTime(paidAt || new Date()))}</div></div>
    ${paymentMethod ? `<div class="row"><div><strong>Pago</strong></div><div>${esc(paymentMethod)}</div></div>` : ``}

    <div class="hr"></div>

    <table>
      <tbody>
        ${lines.map((l) => `
          <tr>
            <td class="qty"><strong>${esc(l.qty)}x</strong></td>
            <td>${esc(l.name)}</td>
            <td class="total">${esc(money(l.total))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="hr"></div>

    <div class="totals">
      <div class="row"><div>Subtotal</div><div>${esc(money(computedSubtotal))}</div></div>
      ${discount ? `<div class="row"><div>Descuento</div><div>-${esc(money(discount))}</div></div>` : ``}
      <div class="row grand"><div>Total</div><div>${esc(money(computedTotal))}</div></div>
    </div>

    ${(customerNotes || staffNotes) ? `<div class="hr"></div>` : ``}
    ${customerNotes ? `<div class="notes"><strong>Nota cliente:</strong>\n${esc(customerNotes)}</div>` : ``}
    ${staffNotes ? `<div class="notes" style="margin-top:6px;"><strong>Nota staff:</strong>\n${esc(staffNotes)}</div>` : ``}

    ${footer ? `<div class="hr"></div><div class="meta small">${esc(footer)}</div>` : ``}

    <div class="hr"></div>
    <div class="meta small">Documento interno / no fiscal.</div>

    <div class="actions">
      <button onclick="window.print()">Imprimir / Guardar como PDF</button>
    </div>
  </div>

  <script>
    window.__AUTO_PRINT__ = ${autoPrint ? 'true' : 'false'};
    if (window.__AUTO_PRINT__) {
      setTimeout(() => { try { window.print(); } catch(e) {} }, 250);
    }
  </script>
</body>
</html>`;

  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) {
    alert('Tu navegador bloqueó la ventana emergente. Habilitá popups para imprimir/guardar el ticket.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export const LAST_RECEIPT_KEY = 'MOZOQR_LAST_RECEIPT_V1';

export function saveLastReceiptToStorage(payload) {
  try {
    localStorage.setItem(LAST_RECEIPT_KEY, JSON.stringify(payload || {}));
  } catch { }
}

export function loadLastReceiptFromStorage() {
  try {
    const raw = localStorage.getItem(LAST_RECEIPT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

