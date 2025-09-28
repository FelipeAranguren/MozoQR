import React, { useEffect, useMemo, useState, useCallback } from 'react';
// import { useParams, useNavigate } from 'react-router-dom'; // Eliminados para evitar errores de entorno
// import SalesByDayChart from '../components/SalesByDayChart'; // Eliminado
// import { getPaidOrders, ... } from '../api/analytics'; // Eliminado

// =====================================================================
// SIMULACIÓN DE API Y COMPONENTES EXTERNOS
// Para resolver los errores de importación, he movido una versión
// simulada de tus dependencias aquí.
// =====================================================================

const useMockParams = () => ({ slug: 'mcdonalds' }); // Simula useParams
const useMockNavigate = () => (path) => console.log(`Navegar a: ${path}`); // Simula useNavigate

// Simulación del módulo '../api/analytics'
const mockAnalyticsAPI = {
  getPaidOrders: async ({ slug, from, to }) => {
    console.log(`[API MOCK] Obteniendo órdenes pagadas para ${slug}`);
    await new Promise(res => setTimeout(res, 500));
    const count = Math.floor(Math.random() * 50) + 20;
    return Array.from({ length: count }, (_, i) => ({
      id: 100 + i,
      tableSessionId: `session-${Math.floor(i / 3)}`,
      tableNumber: Math.floor(i / 3) + 1,
      createdAt: new Date(from.getTime() + Math.random() * (to.getTime() - from.getTime())).toISOString(),
      updatedAt: new Date().toISOString(),
      total: Math.random() * 5000 + 1000,
      paymentMethod: ['QR', 'Tarjeta', 'Efectivo'][Math.floor(Math.random() * 3)],
      items: [{ name: 'Producto Mock', qty: 2, unitPrice: 500 }],
    }));
  },
  getTotalOrdersCount: async ({ slug }) => 987,
  getSessionsCount: async ({ slug, from, to }) => 138,
  fetchTopProducts: async ({ slug, from, to, limit = 5 }) => {
    return [
      { name: 'Hamburguesa Completa', qty: 102 },
      { name: 'Papas Fritas Grandes', qty: 95 },
      { name: 'Gaseosa Mediana', qty: 80 },
      { name: 'Ensalada Caesar', qty: 45 },
      { name: 'Helado de Vainilla', qty: 30 },
    ];
  },
};

// Simulación del componente '../components/SalesByDayChart'
function SalesByDayChart({ slug, start, end, periodKey, onTotalChange }) {
  useEffect(() => {
    const mockTotal = Math.random() * 1800000 + 500000;
    onTotalChange(mockTotal);
  }, [periodKey, onTotalChange]);

  return (
    <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
      <h4 style={{ margin: 0, color: '#111827' }}>Ventas por Día</h4>
      <p style={{ fontSize: '14px' }}>[Gráfico de ventas aparecerá aquí]</p>
       <div style={{ height: '250px', border: '1px dashed #d1d5db', borderRadius: '8px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '10px' }}>
        <div style={{ width: '10%', height: `${Math.random()*80+10}%`, background: '#a5b4fc' }}></div>
        <div style={{ width: '10%', height: `${Math.random()*80+10}%`, background: '#a5b4fc' }}></div>
        <div style={{ width: '10%', height: `${Math.random()*80+10}%`, background: '#a5b4fc' }}></div>
        <div style={{ width: '10%', height: `${Math.random()*80+10}%`, background: '#a5b4fc' }}></div>
        <div style={{ width: '10%', height: `${Math.random()*80+10}%`, background: '#a5b4fc' }}></div>
      </div>
    </div>
  );
}


// ===== Formatos (sin cambios) =====
const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(n) || 0);
const money0 = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Number(n) || 0);

const fmtDate     = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' });
const fmtTime     = new Intl.DateTimeFormat('es-AR', { timeStyle: 'short' });
const fmtDateTime = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' });

// ===== Períodos (Restaurados) =====
const PERIODS = [
  { key: '7d',  label: '7 días',   computeStart: (end) => addDays(end, -6) },
  { key: '15d', label: '15 días',  computeStart: (end) => addDays(end, -14) },
  { key: '30d', label: '30 días',  computeStart: (end) => addDays(end, -29) },
  { key: '6m',  label: '6 meses',  computeStart: (end) => addMonths(end, -6) },
  { key: '1y',  label: '12 meses', computeStart: (end) => addMonths(end, -12) },
];

function addDays(base, d) { const x = new Date(base); x.setDate(x.getDate() + d); return x; }
function addMonths(base, m) {
  const x = new Date(base); const day = x.getDate();
  x.setMonth(x.getMonth() + m);
  if (x.getDate() < day) x.setDate(0);
  return x;
}

const prettyName = (s = '') => s.replaceAll('-', ' ').toUpperCase();

// ===== Helpers de Facturas (sin cambios) =====
function safeDate(x) {
  const d = new Date(x);
  return isNaN(d.getTime()) ? new Date() : d;
}
function makeFallbackSessionKey(o) {
  const mesa = o.tableNumber ?? (o.table && o.table.number) ?? 'mesa?';
  const d = safeDate(o.createdAt);
  const ymd = d.toISOString().slice(0,10);
  return `fallback:${mesa}|${ymd}`;
}
function pickPaymentMethodFromOrder(o) {
  return ( o.paymentMethod || (o.payment && (o.payment.method || o.payment.type)) || (Array.isArray(o.payments) && o.payments[0] && (o.payments[0].method || o.payments[0].type)) || '—' );
}
function extractItemsFromOrder(order) {
  const out = [];
  if (Array.isArray(order?.items)) {
    for (const it of order.items) {
      const name = it?.name || it?.product?.name || 'Ítem';
      const qty  = Number(it?.qty ?? 1);
      const up   = Number(it?.unitPrice ?? it?.product?.price ?? 0);
      out.push({ name, qty, unitPrice: up, total: up * qty });
    }
  }
  if (Array.isArray(order?.itemPedidos)) {
    for (const it of order.itemPedidos) {
      const name = it?.producto?.nombre || 'Ítem';
      const qty  = Number(it?.cantidad ?? 1);
      const up   = Number(it?.precio ?? it?.producto?.precio ?? 0);
      out.push({ name, qty, unitPrice: up, total: up * qty });
    }
  }
  if (!out.length) {
    const t = Number(order?.total ?? 0);
    if (t > 0) out.push({ name: 'Consumo', qty: 1, unitPrice: t, total: t });
  }
  return out;
}
function groupOrdersToInvoices(orders = []) {
  const byKey = new Map();
  for (const o of orders) {
    const sessionKey = o.tableSessionId || makeFallbackSessionKey(o);
    if (!byKey.has(sessionKey)) {
      byKey.set(sessionKey, {
        invoiceId: sessionKey, table: o.tableNumber ?? (o.table?.number) ?? '—',
        openedAt: safeDate(o.createdAt), closedAt: safeDate(o.updatedAt),
        orders: [], ordersRaw: [], items: 0, total: 0,
        paymentMethod: '—', subtotal: 0, discounts: 0, taxes: 0, tip: 0,
      });
    }
    const inv = byKey.get(sessionKey);
    const created = safeDate(o.createdAt);
    const updated = safeDate(o.updatedAt);
    const total = Number(o.total ?? o.amount ?? 0);
    const payMethod = pickPaymentMethodFromOrder(o);
    
    inv.orders.push({ id: o.id, createdAt: created, status: o.status || '—', total });
    inv.ordersRaw.push(o);
    inv.items += (o.items || o.itemPedidos || []).reduce((s,i) => s + Number(i.qty || i.cantidad || 1), 0);
    inv.total += total;
    inv.subtotal += total;
    if (created < inv.openedAt) inv.openedAt = created;
    if (updated > inv.closedAt) inv.closedAt = updated;
    if (payMethod !== '—') inv.paymentMethod = payMethod;
  }
  return Array.from(byKey.values()).sort((a,b) => b.closedAt - a.closedAt);
}

// ===== Componente principal MEJORADO =====
export default function OwnerDashboard() {
  const { slug } = useMockParams();
  const navigate = useMockNavigate();

  const [periodKey, setPeriodKey] = useState('7d');
  const [periodTotal, setPeriodTotal] = useState(0);

  const end = useMemo(() => new Date(), []);
  const periodDef = useMemo(() => PERIODS.find(p => p.key === periodKey) || PERIODS[0], [periodKey]);
  const start = useMemo(() => periodDef.computeStart(end), [periodDef, end]);

  const [periodOrders, setPeriodOrders] = useState([]);
  const [lifetimeOrders, setLifetimeOrders] = useState(0);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [filters, setFilters] = useState({ query: '', paymentMethod: '' });

  // ===== Carga de datos (Usando API simulada) =====
  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    const from = start, to = end;
    Promise.all([
      mockAnalyticsAPI.getPaidOrders({ slug, from, to }),
      mockAnalyticsAPI.getTotalOrdersCount({ slug }),
      mockAnalyticsAPI.getSessionsCount({ slug, from, to }),
      mockAnalyticsAPI.fetchTopProducts({ slug, from, to, limit: 5 }),
    ]).then(([orders, totalOrd, sessions, topProd]) => {
      setPeriodOrders(orders || []);
      setLifetimeOrders(totalOrd);
      setSessionsCount(sessions);
      setTopProducts(topProd || []);
      const inv = groupOrdersToInvoices(orders || []);
      setInvoices(inv);
    }).catch(console.error).finally(() => setIsLoading(false));
  }, [slug, periodKey]);

  // ===== KPIs Derivados (NUEVOS y Mejorados) =====
  const derivedKpis = useMemo(() => {
    const today = new Date();
    const sameLocalDay = (d) => {
      const a = safeDate(d);
      return a.getFullYear() === today.getFullYear() && a.getMonth() === today.getMonth() && a.getDate() === today.getDate();
    };
    
    const ingresosHoy = periodOrders
      .filter((o) => o.createdAt && sameLocalDay(o.createdAt))
      .reduce((s, o) => s + (Number(o.total) || 0), 0);

    const ticketPromedio = periodOrders.length > 0 ? (periodTotal / periodOrders.length) : 0;
    
    const paymentMix = invoices.reduce((acc, inv) => {
      const method = inv.paymentMethod || '—';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {});
    const totalInvoices = invoices.length;
    Object.keys(paymentMix).forEach(k => {
        if(totalInvoices > 0) {
            paymentMix[k] = ((paymentMix[k] / totalInvoices) * 100).toFixed(0) + '%'
        } else {
            paymentMix[k] = '0%';
        }
    });

    return { ingresosHoy, ticketPromedio, paymentMix };
  }, [periodOrders, periodTotal, invoices]);

  // ===== Lógica de Filtros (NUEVO) =====
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const queryMatch = filters.query ? 
        (inv.invoiceId.toLowerCase().includes(filters.query.toLowerCase()) || 
         inv.table.toString().toLowerCase().includes(filters.query.toLowerCase()))
        : true;
      const paymentMatch = filters.paymentMethod ? inv.paymentMethod === filters.paymentMethod : true;
      return queryMatch && paymentMatch;
    });
  }, [invoices, filters]);
  
  // ===== Lógica de Exportación (NUEVO) =====
  const handleExport = useCallback(() => {
    const headers = "Factura,Cierre,Mesa,Items,Total,Pago\n";
    const csvContent = filteredInvoices.map(inv => 
      [
        inv.invoiceId.replace(/^fallback:/, ''),
        fmtDateTime.format(safeDate(inv.closedAt)),
        inv.table,
        inv.items,
        inv.total,
        inv.paymentMethod
      ].join(',')
    ).join('\n');
    
    const blob = new Blob([headers + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `facturas_${slug}_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [filteredInvoices, slug]);


  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpenDrawer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!slug) return <div><h2>Seleccioná un restaurante</h2></div>;

  const paymentMixString = Object.entries(derivedKpis.paymentMix).map(([k,v]) => `${k}: ${v}`).join(' ');

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Dashboard — {prettyName(slug)}</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriodKey(p.key)} className={`period-btn ${p.key === periodKey ? 'active' : ''}`}>{p.label}</button>
          ))}
        </div>
      </div>
      
      <div className="grid-layout-row">
        <div className="card">
          <SalesByDayChart slug={slug} start={start} end={end} periodKey={periodKey} onTotalChange={setPeriodTotal} />
        </div>
        <div className="card kpi-grid-container">
            <KpiBox title="Ingresos del Día" value={derivedKpis.ingresosHoy} formatter={money} resetKey={periodKey} />
            <KpiBox title="Ticket Promedio" value={derivedKpis.ticketPromedio} formatter={money} resetKey={periodKey} />
            <KpiBox title="Pedidos Completados" value={lifetimeOrders} formatter={(n) => String(Math.round(n))} resetKey={periodKey} />
            <KpiBox title="Clientes Atendidos" value={sessionsCount} resetKey={periodKey} />
            <KpiBox title="Mix de Pagos" value={paymentMixString || 'Calculando...'} formatter={s=>s} isText resetKey={periodKey} />
        </div>
      </div>

      <div className="grid-layout-row" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ marginTop: 0, marginBottom: 0 }}>Facturas del Período</h3>
                <div style={{color: '#64748b' }}>Mostrando: <b>{filteredInvoices.length}</b> de {invoices.length}</div>
            </div>
            <FiltersBar filters={filters} onFiltersChange={setFilters} onExport={handleExport} />
            {isLoading ? <div className="loading-placeholder">Cargando...</div> : <InvoicesTable rows={filteredInvoices} onRowClick={(inv) => { setSelectedInvoice(inv); setOpenDrawer(true); }} />}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Top productos del período</h3>
          {isLoading ? <div className="loading-placeholder">Cargando...</div> : <TopProductsList rows={topProducts} />}
        </div>
      </div>

      <InvoiceDrawer open={openDrawer} onClose={() => setOpenDrawer(false)} invoice={selectedInvoice} />
      
      <style>{`
        .card { border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; padding: 20px; box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05); }
        .grid-layout-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; align-items: stretch; }
        @media (max-width: 900px) { .grid-layout-row { grid-template-columns: 1fr; } }
        .period-btn { padding: 8px 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; cursor: pointer; font-weight: 600; }
        .period-btn.active { border-color: #0ea5e9; background: #e0f2fe; color: #0c4a6e; }
        .loading-placeholder { text-align: center; padding: 40px; color: #6b7280; }
        .kpi-grid-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }
      `}</style>
    </div>
  );
}

function FiltersBar({ filters, onFiltersChange, onExport }) {
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        onFiltersChange(prev => ({ ...prev, [name]: value }));
    };
    return (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" name="query" placeholder="Buscar por ID o mesa..." value={filters.query} onChange={handleInputChange} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', minWidth: 200 }} />
            <select name="paymentMethod" value={filters.paymentMethod} onChange={handleInputChange} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff' }}>
                <option value="">Todo Pago</option><option value="QR">QR</option><option value="Tarjeta">Tarjeta</option><option value="Efectivo">Efectivo</option><option value="—">—</option>
            </select>
            <button onClick={() => onFiltersChange({ query: '', paymentMethod: '' })} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Limpiar</button>
            <button onClick={onExport} style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: 'none', background: '#10b981', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Exportar CSV</button>
        </div>
    );
}

function KpiBox({ title, value, formatter, resetKey, isText }) {
  const [display, setDisplay] = useState(isText ? '' : 0);
  
  useEffect(() => {
    if (isText) {
        setDisplay(value);
        return;
    }
    const target = Number(value) || 0;
    const duration = 900;
    const start = performance.now();
    let raf;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(p);
      setDisplay(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setDisplay(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, resetKey, isText]);

  const show = isText ? value : (formatter ? formatter(display) : String(Math.round(display)));

  return (
    <div style={{ border: '1px solid #f0f0f0', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#fff' }}>
      <div style={{ color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ fontWeight: 800, lineHeight: 1.1, fontSize: isText ? '14px' : 'clamp(28px, 5vw, 30px)', whiteSpace: 'normal' }} title={String(value)}>{show}</div>
    </div>
  );
}

function InvoicesTable({ rows, onRowClick }) {
  const [sort, setSort] = useState({ key: 'closedAt', dir: 'desc' });
  const [pageSize, setPageSize] = useState(20);
  if (!rows || !rows.length) return <div style={{ color: '#6b7280', textAlign: 'center', padding: '30px' }}>Sin facturas para los filtros seleccionados.</div>;

  const sorted = [...rows].sort((a,b) => {
    const { key, dir } = sort;
    const av = a[key]; const bv = b[key];
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  const page = sorted.slice(0, pageSize);
  const canMore = rows.length > page.length;
  const toggle = (k) => setSort(s => s.key === k ? { key: k, dir: (s.dir === 'asc' ? 'desc' : 'asc') } : { key: k, dir: 'desc' });
  const shortId = (id) => String(id || '').replace(/^fallback:/, '').slice(-10);
  
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#6b7280' }}>
            <Th onClick={() => toggle('invoiceId')}>Factura {sort.key==='invoiceId' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
            <Th onClick={() => toggle('closedAt')}>Cierre {sort.key==='closedAt' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
            <Th onClick={() => toggle('table')}>Mesa {sort.key==='table' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
            <Th onClick={() => toggle('total')} style={{ textAlign:'right' }}>Total {sort.key==='total' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
            <Th>Pago</Th>
          </tr>
        </thead>
        <tbody>
          {page.map((inv) => (
            <tr key={inv.invoiceId} onClick={() => onRowClick && onRowClick(inv)} style={{ cursor:'pointer', borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px 8px', fontFamily:'ui-monospace, monospace' }}>{shortId(inv.invoiceId)}</td>
              <td style={{ padding: '12px 8px' }}>{fmtDateTime.format(safeDate(inv.closedAt))}</td>
              <td style={{ padding: '12px 8px' }}>{String(inv.table)}</td>
              <td style={{ padding: '12px 8px', textAlign:'right', fontWeight:700 }}>{money0(inv.total)}</td>
              <td style={{ padding: '12px 8px' }}>{String(inv.paymentMethod || '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {canMore && <div style={{ display:'flex', justifyContent:'center', marginTop:16 }}><button onClick={() => setPageSize(s => s + 20)} className="period-btn">Cargar más</button></div>}
    </div>
  );
}

function InvoiceDrawer({ open, onClose, invoice }) {
  if (!open || !invoice) return null;
  const flatItems = [];
  for (const o of (invoice.ordersRaw || [])) { flatItems.push(...extractItemsFromOrder(o)); }
  const itemsGrouped = flatItems.reduce((acc, it) => {
    const key = it.name || 'Ítem';
    if (!acc[key]) acc[key] = { name: key, qty: 0, total: 0, unitPrice: it.unitPrice || 0 };
    acc[key].qty += Number(it.qty || 0); acc[key].total += Number(it.total || 0);
    return acc;
  }, {});
  const items = Object.values(itemsGrouped).sort((a,b) => b.total - a.total);
  const { subtotal, discounts, taxes, tip, total } = invoice;
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.35)', zIndex: 40 }} />
      <div role="dialog" style={{ position:'fixed', top:0, right:0, height:'100dvh', width:'min(560px, 95vw)', background:'#fff', zIndex: 41, display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid #e5e7eb' }}>
          <div style={{ fontWeight:800, fontSize:18 }}>Factura {String(invoice.invoiceId).replace(/^fallback:/,'')}</div>
          <button onClick={onClose} className="period-btn">Cerrar</button>
        </div>
        <div style={{ padding:16, overflow:'auto' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <InfoRow label="Mesa" value={String(invoice.table)} />
                <InfoRow label="Pago" value={String(invoice.paymentMethod || '—')} />
                <InfoRow label="Apertura" value={fmtDateTime.format(safeDate(invoice.openedAt))} />
                <InfoRow label="Cierre" value={fmtDateTime.format(safeDate(invoice.closedAt))} />
            </div>
            <div style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:12, marginBottom:16 }}>
                {/* Total breakdown */}
            </div>
            <div>
                <div style={{ fontWeight:700, marginBottom:8 }}>Items</div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr><Th>Producto</Th><Th style={{textAlign:'right'}}>Cant.</Th><Th style={{textAlign:'right'}}>Total</Th></tr></thead>
                    <tbody>
                        {items.map((it, i) => <tr key={i}><td style={{padding: '8px 0'}}>{it.name}</td><td style={{textAlign:'right'}}>{it.qty}</td><td style={{textAlign:'right'}}>{money0(it.total)}</td></tr>)}
                        {!items.length && <tr><td colSpan="3" style={{textAlign:'center', padding: '20px'}}>No hay items.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:'10px 12px' }}>
      <div style={{ color:'#64748b', fontSize:12, marginBottom:4 }}>{label}</div>
      <div style={{ fontWeight:700 }}>{value}</div>
    </div>
  );
}

function TopProductsList({ rows }) {
  if (!rows || !rows.length) return <div style={{ color: '#6b7280' }}>Sin datos de productos.</div>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr><Th>Producto</Th><Th>Cantidad</Th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td style={{ padding: '10px 6px' }}>{r.name}</td>
            <td style={{ padding: '10px 6px', fontWeight: 700 }}>{r.qty}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ children, onClick, style }) {
  return <th onClick={onClick} style={{ textAlign:'left', padding:'10px 6px', cursor: onClick ? 'pointer' : 'default', userSelect:'none', borderBottom: '1px solid #e5e7eb', ...style }}>{children}</th>;
}
