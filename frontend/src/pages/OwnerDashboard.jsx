// src/pages/OwnerDashboard.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRestaurantAccess } from '../hooks/useRestaurantAccess';
import SalesByDayChart from '../components/SalesByDayChart';
import {
  getPaidOrders,
  getTotalOrdersCount,
  getSessionsCount,
  fetchTopProducts,
} from '../api/analytics';

/* ========== Formatos ========== */
const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    .format(Number(n) || 0);
const money0 = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0, minimumFractionDigits: 0 })
    .format(Number(n) || 0);
const fmtDate     = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' });
const fmtTime     = new Intl.DateTimeFormat('es-AR', { timeStyle: 'short' });
const fmtDateTime = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' });

const PERIODS = [
  { key: '7d',  label: '7 días',   computeStart: (end) => addDays(end, -6) },
  { key: '15d', label: '15 días',  computeStart: (end) => addDays(end, -14) },
  { key: '30d', label: '30 días',  computeStart: (end) => addDays(end, -29) },
  { key: '6m',  label: '6 meses',  computeStart: (end) => addMonths(end, -6) },
  { key: '1y',  label: '12 meses', computeStart: (end) => addMonths(end, -12) },
  { key: 'custom', label: 'Personalizado', computeStart: (end) => end },
];

const GATE_PRIMARY_BTN_STYLE = {
  padding: '10px 18px',
  borderRadius: 10,
  border: 'none',
  background: '#0ea5e9',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 12px 24px rgba(14, 165, 233, 0.25)',
};

const GATE_SECONDARY_BTN_STYLE = {
  padding: '10px 18px',
  borderRadius: 10,
  border: '1px solid #cbd5f5',
  background: '#f8fafc',
  color: '#0f172a',
  fontWeight: 600,
  cursor: 'pointer',
};

function addDays(base, d) { const x = new Date(base); x.setDate(x.getDate() + d); x.setHours(0,0,0,0); return x; }
function addMonths(base, m) {
  const x = new Date(base); const day = x.getDate();
  x.setMonth(x.getMonth() + m);
  if (x.getDate() < day) x.setDate(0);
  x.setHours(0,0,0,0);
  return x;
}
const prettyName = (s = '') => String(s || '').replaceAll('-', ' ').toUpperCase();

/* ========== Fechas locales y rango para API ========== */
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function fromISODateInputLocal(yyyyMmDd) {
  const [y, m, d] = String(yyyyMmDd).split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function toDateInputStr(d) {
  const x = new Date(d); const y = x.getFullYear();
  const m = String(x.getMonth()+1).padStart(2,'0');
  const dd = String(x.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
/** Envía a la API ISO strings y hace to exclusivo (+1 ms) para no perder “hoy”. */
function buildRangeForApi(start, end) {
  const fromIso = startOfDay(start).toISOString();
  const endExclusive = new Date(endOfDay(end).getTime() + 1); // exclusivo
  const toIso = endExclusive.toISOString();
  return { fromIso, toIso };
}

/* ========== Helpers de facturas/mesa ========== */
function safeDate(x) { const d = new Date(x); return isNaN(d.getTime()) ? new Date() : d; }
function makeFallbackSessionKey(o) {
  const mesaGuess =
    o.tableNumber ?? o.table_name ?? o.tableName ??
    (o.table && (o.table.number || o.table.name || o.table.label)) ??
    o.mesaNumero ?? o.mesa ?? o.tableId ?? o.table_id ?? 'mesa?';
  const d = safeDate(o.createdAt);
  const ymd = d.toISOString().slice(0,10);
  return `fallback:${mesaGuess}|${ymd}`;
}
/** Lector robusto de mesa: prioriza Mesa.number y evita devolver slugs de sesión */
function readTableLabelFromOrder(o, sessionKey) {
  // 1) intentar leer explícitamente un número de mesa
  const pickNumber = () => {
    if (o?.mesa?.number != null) return String(o.mesa.number);
    if (o?.mesa?.data?.attributes?.number != null) return String(o.mesa.data.attributes.number);
    if (o?.meta?.mesa?.number != null) return String(o.meta.mesa.number);
    if (o?.meta?.mesaNumber != null) return String(o.meta.mesaNumber);

    if (o?.table?.number != null) return String(o.table.number);
    if (o?.table?.data?.attributes?.number != null) return String(o.table.data.attributes.number);
    if (o?.tableNumber != null) return String(o.tableNumber);
    if (o?.mesaNumero != null) return String(o.mesaNumero);
    return null;
  };

  let label = pickNumber();

  // 2) si vino un string plano (mesa/table) que NO sea slug, usarlo (o extraer dígitos)
  if (!label) {
    const cand =
      (typeof o?.mesa === 'string' && o.mesa) ||
      (typeof o?.table === 'string' && o.table) ||
      o?.table_name || o?.tableName || null;

    if (cand && !looksLikeSessionSlug(cand)) {
      const n = String(cand).match(/\d+/)?.[0];
      label = n || String(cand);
    }
  }

  // 3) fallback de sessionKey, pero evitando slugs
  if (!label && typeof sessionKey === 'string' && sessionKey.startsWith('fallback:')) {
    const maybeMesa = sessionKey.slice('fallback:'.length).split('|')[0];
    if (maybeMesa && !looksLikeSessionSlug(maybeMesa)) label = maybeMesa;
  }

  // 4) último recurso: no mostrar ids ni slugs
  return label || '—';
}


function pickPaymentMethodFromOrder(o) {
  return (
    o.paymentMethod ||
    (o.payment && (o.payment.method || o.payment.type)) ||
    (Array.isArray(o.payments) && o.payments[0] && (o.payments[0].method || o.payments[0].type)) ||
    '—'
  );
}
function extractItemsFromOrder(order) {
  const out = [];
  if (Array.isArray(order?.items)) {
    for (const it of order.items) {
      const name = it?.name || it?.product?.name || it?.product_name || 'Ítem';
      const qty  = Number(it?.qty ?? it?.quantity ?? 1);
      const up   = Number(it?.unitPrice ?? it?.price ?? it?.product?.price ?? 0);
      out.push({ name, qty, unitPrice: up, total: up * qty });
    }
  }
  if (Array.isArray(order?.itemPedidos)) {
    for (const it of order.itemPedidos) {
      const name = it?.name || it?.producto?.name || it?.producto?.nombre || 'Ítem';
      const qty  = Number(it?.qty ?? it?.cantidad ?? 1);
      const up   = Number(it?.unitPrice ?? it?.precio ?? it?.producto?.price ?? it?.producto?.precio ?? 0);
      out.push({ name, qty, unitPrice: up, total: up * qty });
    }
  }
  if (!out.length) {
    const t = Number(order?.total ?? order?.amount ?? 0);
    if (t > 0) out.push({ name: 'Consumo', qty: 1, unitPrice: t, total: t });
  }
  return out;
}
function groupOrdersToInvoices(orders = []) {
  const byKey = new Map();
  for (const o of orders) {
    const sessionKey = o.tableSessionId || makeFallbackSessionKey(o);
    const created = safeDate(o.createdAt || o.updatedAt);
    const updated = safeDate(o.updatedAt || o.createdAt);
    const payMethod = pickPaymentMethodFromOrder(o);
    const tableLabel = readTableLabelFromOrder(o, sessionKey);
    const itemsArr   = extractItemsFromOrder(o);
    const itemsCount = Math.max(1, itemsArr.reduce((s, it) => s + (Number(it.qty) || 0), 0));
    const total      = Number(o.total ?? o.amount ?? 0);

    if (!byKey.has(sessionKey)) {
      byKey.set(sessionKey, {
        invoiceId: sessionKey,
        table: tableLabel,
        openedAt: created,
        closedAt: updated,
        orders: [],
        ordersRaw: [],
        items: 0,
        subtotal: 0, discounts: 0, taxes: 0, tip: 0,
        total: 0,
        paymentMethod: payMethod,
      });
    }
    const inv = byKey.get(sessionKey);
    inv.orders.push({ id: o.id, createdAt: created, status: o.status || o.estado || '—', total });
    inv.ordersRaw.push(o);
    inv.items    += itemsCount;
    inv.subtotal += total;
    inv.total    += total;

    if (created < inv.openedAt) inv.openedAt = created;
    if (updated > inv.closedAt) inv.closedAt = updated;
    if (payMethod !== '—') inv.paymentMethod = payMethod;
    if ((inv.table === '—' || inv.table === 'mesa?') && tableLabel && tableLabel !== '—') inv.table = tableLabel;
  }
  return Array.from(byKey.values()).sort((a,b) => b.closedAt - a.closedAt);
}

/* ========== Componente ========== */
export default function OwnerDashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const access = useRestaurantAccess(slug, isAuthenticated ? user : null);
  const restaurantTitle = access.restaurantName || prettyName(slug);
  const canViewDashboard = access.status === 'allowed';

  const [periodKey, setPeriodKey] = useState('30d');
  const [periodTotal, setPeriodTotal] = useState(0);

  // rango personalizado
  const [customStart, setCustomStart] = useState(toDateInputStr(addDays(new Date(), -6)));
  const [customEnd,   setCustomEnd]   = useState(toDateInputStr(new Date()));
  const isCustom = periodKey === 'custom';

  const [periodOrders, setPeriodOrders] = useState([]);
  const [lifetimeOrders, setLifetimeOrders] = useState(0);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [filters, setFilters] = useState({ query: '', paymentMethod: '' });

  const end = useMemo(() => {
    return isCustom ? endOfDay(fromISODateInputLocal(customEnd)) : endOfDay(new Date());
  }, [periodKey, customEnd, isCustom]);

  const start = useMemo(() => {
    if (isCustom) return startOfDay(fromISODateInputLocal(customStart));
    const def = PERIODS.find(p => p.key === periodKey) || PERIODS[0];
    return startOfDay(def.computeStart(end));
  }, [periodKey, end, customStart, isCustom]);

   useEffect(() => {
    if (!slug || !canViewDashboard) return;
    setIsLoading(true);

    // 👉 rango en ISO + to exclusivo␊
    const { fromIso, toIso } = buildRangeForApi(start, end);

    Promise.all([
      getPaidOrders({ slug, from: fromIso, to: toIso }),
      getTotalOrdersCount({ slug }),
      getSessionsCount({ slug, from: fromIso, to: toIso }),
      fetchTopProducts({ slug, from: fromIso, to: toIso, limit: 5 }),
    ])
      .then(([orders, totalOrd, sessions, topProd]) => {
        const list = Array.isArray(orders) ? orders : [];
        setPeriodOrders(list);
        setLifetimeOrders(Number(totalOrd) || 0);
        setSessionsCount(Number(sessions) || 0);
        setTopProducts(topProd || []);
        setInvoices(groupOrdersToInvoices(list));
      })
        .catch(() => { setPeriodOrders([]); setInvoices([]); setTopProducts([]); })
      .finally(() => setIsLoading(false));
  }, [slug, canViewDashboard, periodKey, start.getTime(), end.getTime()]);


  const derivedKpis = useMemo(() => {
    const today = new Date();
    const sameLocalDay = (d) => {
      const a = safeDate(d);
      return a.getFullYear() === today.getFullYear() &&
             a.getMonth() === today.getMonth() &&
             a.getDate() === today.getDate();
    };
    const ingresosHoy = periodOrders
      .filter((o) => o.createdAt && sameLocalDay(o.createdAt))
      .reduce((s, o) => s + (Number(o.total) || 0), 0);

    const ticketPromedio = periodOrders.length ? (periodTotal / periodOrders.length) : 0;

    const paymentMixCount = invoices.reduce((acc, inv) => {
      const m = inv.paymentMethod || '—';
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {});
    const totalInv = invoices.length || 1;
    const paymentMix = Object.fromEntries(
      Object.entries(paymentMixCount).map(([k, v]) => [k, Math.round((v * 100) / totalInv) + '%'])
    );

    return { ingresosHoy, ticketPromedio, paymentMix };
  }, [periodOrders, periodTotal, invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const q = (filters.query || '').toLowerCase();
      const byText = !q
        || String(inv.invoiceId).toLowerCase().includes(q)
        || String(inv.table).toLowerCase().includes(q);
      const byPay  = filters.paymentMethod ? (inv.paymentMethod === filters.paymentMethod) : true;
      return byText && byPay;
    });
  }, [invoices, filters]);

  const handleExport = useCallback(() => {
    if (!filteredInvoices.length) {
      alert('No hay facturas para exportar con los filtros seleccionados.');
      return;
    }
    const headers = 'Factura;Cierre;Mesa;Items;Total;Pago\n';
    const rows = filteredInvoices.map(inv => ([
      String(inv.invoiceId).replace(/^fallback:/, ''),
      fmtDateTime.format(safeDate(inv.closedAt)),
      inv.table,
      inv.items,
      String(inv.total).replace('.', ','),
      inv.paymentMethod || '—',
    ].join(';'))).join('\n');

    const blob = new Blob([`\uFEFF${headers}${rows}`], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facturas_${slug}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [filteredInvoices, slug]);

   useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpenDrawer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  let gate = null;

  if (!slug) {
    gate = {
      title: 'Seleccioná un restaurante',
      description: 'Elegí un restaurante válido para acceder al panel de control.',
      actions: (
        <button
          style={GATE_PRIMARY_BTN_STYLE}
          onClick={() => navigate('/restaurantes')}
        >
          Ver restaurantes
        </button>
      ),
    };
  } else if (!isAuthenticated) {
    gate = {
      title: 'Iniciá sesión',
      description: 'Necesitás iniciar sesión con una cuenta habilitada como owner o staff para ver este panel.',
      actions: (
        <button
          style={GATE_PRIMARY_BTN_STYLE}
          onClick={() => navigate('/login')}
        >
          Ir al login
        </button>
      ),
    };
  } else if (access.status === 'idle' || access.status === 'loading') {
    gate = {
      title: 'Verificando permisos…',
      description: `Estamos comprobando tu acceso a ${restaurantTitle}.`,
      isLoading: true,
    };
  } else if (access.status === 'unauthorized') {
    gate = {
      title: 'Sesión expirada',
      description: 'Tu sesión ya no es válida. Volvé a iniciar sesión para continuar.',
      actions: (
        <button
          style={GATE_PRIMARY_BTN_STYLE}
          onClick={() => navigate('/login')}
        >
          Iniciar sesión
        </button>
      ),
    };
  } else if (access.status === 'forbidden') {
    gate = {
      title: 'Acceso restringido',
      description: `Tu usuario no tiene rol de owner o staff en ${restaurantTitle}. Pedile acceso al administrador del restaurante.`,
      actions: (
        <button
          style={GATE_PRIMARY_BTN_STYLE}
          onClick={() => navigate('/restaurantes')}
        >
          Elegir otro restaurante
        </button>
      ),
    };
  } else if (access.status === 'error') {
    gate = {
      title: 'No pudimos verificar tus permisos',
      description: 'Ocurrió un problema al validar tu acceso. Actualizá la página o volvé a intentarlo en unos instantes.',
      actions: [
        <button
          key="back"
          style={GATE_SECONDARY_BTN_STYLE}
          onClick={() => navigate('/restaurantes')}
        >
          Ir al listado
        </button>,
        <button
          key="retry"
          style={GATE_PRIMARY_BTN_STYLE}
          onClick={() => window.location.reload()}
        >
          Reintentar
        </button>,
      ],
    };
  } else if (!canViewDashboard) {
    gate = {
      title: 'Acceso restringido',
      description: 'No contás con los permisos necesarios para ver este restaurante.',
    };
  }

  if (gate) {
    return <AccessGateMessage {...gate} />;
  }

  const paymentMixString = Object.entries(derivedKpis.paymentMix).map(([k,v]) => `${k}: ${v}`).join(' / ');

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header + períodos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Dashboard — {restaurantTitle}</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap:'wrap' }}>
          {PERIODS.filter(p => p.key !== 'custom').map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodKey(p.key)}
              className={`period-btn ${p.key === periodKey ? 'active' : ''}`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setPeriodKey('custom')}
            className={`period-btn ${periodKey === 'custom' ? 'active' : ''}`}
          >
            Personalizado
          </button>
          {periodKey === 'custom' && (
            <div style={{ display:'flex', gap:8, alignItems:'center', marginLeft:8 }}>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff' }}
              />
              <span style={{ color:'#64748b' }}>—</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* fila 1 */}
      <div className="grid-layout-row">
        <div className="card">
          <SalesByDayChart
            slug={slug}
            start={start}
            end={end}
            periodKey={periodKey + (isCustom ? ` ${customStart}-${customEnd}` : '')}
            onTotalChange={setPeriodTotal}
          />
        </div>
        <div className="card kpi-grid-container">
          <KpiBox title="Ingresos del Día"   value={derivedKpis.ingresosHoy}       formatter={money} resetKey={periodKey} />
          <KpiBox title="Ticket Promedio"    value={derivedKpis.ticketPromedio}    formatter={money} resetKey={periodKey} />
          <KpiBox title="Pedidos Históricos" value={lifetimeOrders}                formatter={(n)=>String(Math.round(n))} resetKey={periodKey} />
          <KpiBox title="Clientes Atendidos" value={sessionsCount}                 formatter={(n)=>String(Math.round(n))} resetKey={periodKey} />
          <KpiBox title="Mix de Pagos"       value={paymentMixString || 'N/D'}     formatter={(s)=>s} isText resetKey={periodKey+paymentMixString} />
        </div>
      </div>

      {/* fila 2 */}
      <div className="grid-layout-row" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ margin:0 }}>Facturas del período</h3>
            <div style={{ color:'#64748b' }}>Mostrando: <b>{filteredInvoices.length}</b> de {invoices.length}</div>
          </div>
          <FiltersBar
            filters={filters}
            onFiltersChange={setFilters}
            onExport={handleExport}
            paymentMethods={Object.keys(derivedKpis.paymentMix)}
          />
          {isLoading
            ? <div className="loading-placeholder">Cargando facturas...</div>
            : <InvoicesTable rows={filteredInvoices} onRowClick={(inv) => { setSelectedInvoice(inv); setOpenDrawer(true); }} />
          }
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Top productos del período</h3>
          {isLoading ? <div className="loading-placeholder">Cargando productos...</div> : <TopProductsList rows={topProducts} />}
        </div>
      </div>

      <InvoiceDrawer open={openDrawer} onClose={() => setOpenDrawer(false)} invoice={selectedInvoice} />

      <style>{`
        .card { border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; padding: 20px; box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05); }
        .grid-layout-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; align-items: start; }
        @media (max-width: 900px) { .grid-layout-row { grid-template-columns: 1fr; } }
        .period-btn { padding: 8px 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; cursor: pointer; font-weight: 600; transition: all 0.2s; }
        .period-btn:hover { background-color: #f9fafb; border-color: #a1a1aa; }
        .period-btn.active { border-color: #0ea5e9; background: #e0f2fe; color: #0c4a6e; }
        .loading-placeholder { text-align: center; padding: 40px; color: #6b7280; font-size: 14px; }
        .kpi-grid-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }
      `}</style>
    </div>
  );
}

/* ========== UI Aux ========== */
function AccessGateMessage({ title, description, actions, isLoading }) {
  const actionItems = Array.isArray(actions)
    ? actions.filter(Boolean)
    : actions
    ? [actions]
    : [];

  return (
    <div
      style={{
        padding: 24,
        background: '#f8fafc',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 18,
          padding: '32px 28px',
          textAlign: 'center',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h2>
        {description && (
          <p style={{ margin: '0 0 24px', color: '#475569', lineHeight: 1.5 }}>{description}</p>
        )}
        {isLoading && (
          <div style={{ marginBottom: actionItems.length ? 24 : 0, color: '#0ea5e9', fontWeight: 600 }}>
            Verificando…
          </div>
        )}
        {actionItems.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            {actionItems.map((node, idx) => (
              <span key={idx} style={{ display: 'inline-flex' }}>
                {node}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FiltersBar({ filters, onFiltersChange, onExport, paymentMethods }) {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onFiltersChange(prev => ({ ...prev, [name]: value }));
  };
    return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <input type="text" name="query" placeholder="Buscar por ID o mesa…" value={filters.query}
        onChange={handleInputChange}
        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', minWidth: 200 }} />
      <select name="paymentMethod" value={filters.paymentMethod} onChange={handleInputChange}
        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff' }}>
        <option value="">Todo Pago</option>
        {paymentMethods.map(method => <option key={method} value={method}>{method}</option>)}
      </select>
      <button onClick={() => onFiltersChange({ query: '', paymentMethod: '' })} className="period-btn">Limpiar</button>
      <button onClick={onExport}
        style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
        Exportar CSV
      </button>
    </div>
  );
}

function KpiBox({ title, value, formatter, resetKey, isText }) {
  const [display, setDisplay] = useState(isText ? '' : 0);
  useEffect(() => {
    if (isText) { setDisplay(value); return; }
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
  const show = isText ? String(value) : (formatter ? formatter(display) : String(Math.round(display)));
  return (
    <div style={{ border: '1px solid #f0f0f0', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#fff' }}>
      <div style={{ color: '#6b7280', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{title}</div>
      <div style={{ fontWeight: 800, lineHeight: 1.1, fontSize: isText ? 14 : 'clamp(24px, 4vw, 28px)' }} title={String(value)}>{show}</div>
    </div>
  );
}

function InvoicesTable({ rows, onRowClick }) {
  const [sort, setSort] = useState({ key: 'closedAt', dir: 'desc' });
  const [pageSize, setPageSize] = useState(20);
  if (!rows || !rows.length) return <div className="loading-placeholder">Sin facturas para los filtros seleccionados.</div>;

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
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
        <thead>
          <tr style={{ textAlign:'left', color:'#6b7280' }}>
            <Th onClick={() => toggle('invoiceId')}>Factura {sort.key==='invoiceId' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
            <Th onClick={() => toggle('closedAt')}>Cierre {sort.key==='closedAt' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
            <Th onClick={() => toggle('table')}>Mesa {sort.key==='table' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
            <Th onClick={() => toggle('items')} style={{ textAlign:'right' }}>Items {sort.key==='items' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
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
              <td style={{ padding: '12px 8px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{inv.items}</td>
              <td style={{ padding: '12px 8px', textAlign:'right', fontWeight:700 }}>{money0(inv.total)}</td>
              <td style={{ padding: '12px 8px' }}>{String(inv.paymentMethod || '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {canMore && <div style={{ display:'flex', justifyContent:'center', marginTop:16 }}>
        <button onClick={() => setPageSize(s => s + 20)} className="period-btn">Cargar más</button>
      </div>}
    </div>
  );
}

function InvoiceDrawer({ open, onClose, invoice }) {
  if (!open || !invoice) return null;
  const flatItems = [];
  for (const o of (invoice.ordersRaw || [])) flatItems.push(...extractItemsFromOrder(o));
  const itemsGrouped = flatItems.reduce((acc, it) => {
    const key = it.name || 'Ítem';
    if (!acc[key]) acc[key] = { name: key, qty: 0, total: 0, unitPrice: it.unitPrice || 0 };
    acc[key].qty += Number(it.qty || 0);
    acc[key].total += Number(it.total || 0);
    return acc;
  }, {});
  const items = Object.values(itemsGrouped).sort((a,b) => b.total - a.total);

  const subtotal = invoice.subtotal || items.reduce((s, i) => s + i.total, 0);
  const discounts = invoice.discounts || 0;
  const taxes = invoice.taxes || 0;
  const tip = invoice.tip || 0;
  const total = invoice.total || (subtotal - discounts + taxes + tip);

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.35)', zIndex: 40 }} />
      <div role="dialog" aria-modal="true" style={{ position:'fixed', top:0, right:0, height:'100dvh', width:'min(560px, 95vw)', background:'#fff', borderLeft:'1px solid #e5e7eb', zIndex: 41, display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid #e5e7eb' }}>
          <div style={{ fontWeight:800, fontSize:18 }}>Factura {String(invoice.invoiceId).replace(/^fallback:/,'')}</div>
          <button onClick={onClose} style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:'6px 10px', background:'#fff', cursor:'pointer' }}>Cerrar</button>
        </div>
        <div style={{ padding:16, overflow:'auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <InfoRow label="Mesa" value={String(invoice.table)} />
            <InfoRow label="Pago" value={String(invoice.paymentMethod || '—')} />
            <InfoRow label="Apertura" value={`${fmtDate.format(invoice.openedAt)} ${fmtTime.format(invoice.openedAt)}`} />
            <InfoRow label="Cierre"   value={`${fmtDate.format(invoice.closedAt)} ${fmtTime.format(invoice.closedAt)}`} />
          </div>
          <div style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:12, marginBottom:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
              <div style={{ color:'#64748b' }}>Subtotal</div><div style={{ textAlign:'right', fontWeight:600 }}>{money0(subtotal)}</div>
              <div style={{ color:'#64748b' }}>Descuentos</div><div style={{ textAlign:'right', fontWeight:600 }}>{discounts ? `- ${money0(discounts)}` : money0(0)}</div>
              <div style={{ color:'#64748b' }}>Impuestos</div><div style={{ textAlign:'right', fontWeight:600 }}>{money0(taxes)}</div>
              <div style={{ color:'#64748b' }}>Propina</div><div style={{ textAlign:'right', fontWeight:600 }}>{money0(tip)}</div>
              <div style={{ borderTop:'1px dashed #e5e7eb', marginTop:6 }}></div><div style={{ borderTop:'1px dashed #e5e7eb', marginTop:6 }}></div>
              <div style={{ fontWeight:800 }}>Total</div><div style={{ textAlign:'right', fontWeight:800 }}>{money0(total)}</div>
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontWeight:700, marginBottom:8 }}>Timeline</div>
            <ul style={{ margin:0, paddingLeft:18 }}>
              <li>Abierta: {fmtDateTime.format(invoice.openedAt)}</li>
              {Array.isArray(invoice.orders) && invoice.orders.map((o) => (
                <li key={o.id}>Pedido #{o.id} — {o.status} — {fmtDateTime.format(o.createdAt)} — {money0(o.total)}</li>
              ))}
              <li>Cerrada: {fmtDateTime.format(invoice.closedAt)}</li>
            </ul>
          </div>
          <div>
            <div style={{ fontWeight:700, marginBottom:8 }}>Items</div>
            <div style={{ overflow:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ textAlign:'left', color:'#6b7280' }}>
                    <th style={{ padding:'8px 6px', borderBottom:'1px solid #e5e7eb' }}>Producto</th>
                    <th style={{ padding:'8px 6px', borderBottom:'1px solid #e5e7eb', textAlign:'right' }}>Cant.</th>
                    <th style={{ padding:'8px 6px', borderBottom:'1px solid #e5e7eb', textAlign:'right' }}>Precio</th>
                    <th style={{ padding:'8px 6px', borderBottom:'1px solid #e5e7eb', textAlign:'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.name + '_' + i}>
                      <td style={{ padding:'10px 6px', borderBottom:'1px solid #f1f5f9' }}>{it.name}</td>
                      <td style={{ padding:'10px 6px', borderBottom:'1px solid #f1f5f9', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{it.qty}</td>
                      <td style={{ padding:'10px 6px', borderBottom:'1px solid #f1f5f9', textAlign:'right' }}>{money0(it.unitPrice)}</td>
                      <td style={{ padding:'10px 6px', borderBottom:'1px solid #f1f5f9', textAlign:'right', fontWeight:700 }}>{money0(it.total)}</td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr><td colSpan={4} style={{ padding:12, textAlign:'center', color:'#64748b' }}>Sin desglose de items para esta factura.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:'10px 12px', background:'#fff' }}>
      <div style={{ color:'#64748b', fontSize:12, marginBottom:4 }}>{label}</div>
      <div style={{ fontWeight:700 }}>{value}</div>
    </div>
  );
}

function TopProductsList({ rows }) {
  if (!rows || !rows.length) return <div style={{ color: '#6b7280' }}>Sin datos de productos en este período.</div>;
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#6b7280' }}>
            <th style={{ padding: '8px 6px', borderBottom: '1px solid #e5e7eb' }}>Producto</th>
            <th style={{ padding: '8px 6px', borderBottom: '1px solid #e5e7eb' }}>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.name || 'producto') + '-' + i}>
              <td style={{ padding: '10px 6px', borderBottom: '1px solid #f1f5f9' }}>{r.name}</td>
              <td style={{ padding: '10px 6px', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>
                {r.qty}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, onClick, style }) {
  return (
    <th
      onClick={onClick}
      style={{
        textAlign:'left',
        padding:'10px 6px',
        cursor: onClick ? 'pointer' : 'default',
        userSelect:'none',
        whiteSpace:'nowrap',
        fontSize:13,
        color:'#475569',
        borderBottom: '1px solid #e5e7eb',
        ...style
      }}
    >
      {children}
    </th>
  );
}
