// src/pages/OwnerDashboard.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Grid, Typography, Button, ToggleButtonGroup, ToggleButton, Chip } from '@mui/material';
import SalesByDayChart from '../components/SalesByDayChart';
import KpiCardEnhanced from '../components/KpiCardEnhanced';
import PlanGate from '../components/PlanGate';
import HealthCheckPanel from '../components/HealthCheckPanel';
import TablesStatusGrid from '../components/TablesStatusGrid';
import PeakHoursHeatmap from '../components/PeakHoursHeatmap';
import RecentActivityPanel from '../components/RecentActivityPanel';
import ComparisonCard from '../components/ComparisonCard';
import TopProductsChart from '../components/TopProductsChart';
import ExecutiveKPIs from '../components/ExecutiveKPIs';
import ExecutiveCharts from '../components/ExecutiveCharts';
import ExecutiveSummary from '../components/ExecutiveSummary';
import { useRestaurantPlan } from '../hooks/useRestaurantPlan';
import { useViewMode } from '../hooks/useViewMode';
import { calculateTodayVsYesterday, calculateSalesTrend } from '../utils/dashboardMetrics';
import {
  getPaidOrders,
  getTotalOrdersCount,
  getSessionsCount,
  fetchTopProducts,
} from '../api/analytics';
import { fetchTables, fetchActiveOrders } from '../api/tables';
import { fetchCategories } from '../api/menu';
import { client } from '../api/client';
import { createOwnerComment } from '../api/comments';
// Aliases for compatibility with existing code
const api = client;
const http = client;

import { COLORS, MARANA_COLORS } from '../theme';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PeopleIcon from '@mui/icons-material/People';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

/* ========== Formatos ========== */
const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    .format(Number(n) || 0);
const money0 = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0, minimumFractionDigits: 0 })
    .format(Number(n) || 0);
const fmtDate = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' });
const fmtTime = new Intl.DateTimeFormat('es-AR', { timeStyle: 'short' });
const fmtDateTime = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' });

/* ========== Períodos ========== */
const PERIODS = [
  { key: '7d', label: '7 días', computeStart: (end) => addDays(end, -6) },
  { key: '15d', label: '15 días', computeStart: (end) => addDays(end, -14) },
  { key: '30d', label: '30 días', computeStart: (end) => addDays(end, -29) },
  { key: '6m', label: '6 meses', computeStart: (end) => addMonths(end, -6) },
  { key: '1y', label: '12 meses', computeStart: (end) => addMonths(end, -12) },
  { key: 'custom', label: 'Personalizado', computeStart: (end) => end },
];

function addDays(base, d) { const x = new Date(base); x.setDate(x.getDate() + d); x.setHours(0, 0, 0, 0); return x; }
function addMonths(base, m) {
  const x = new Date(base); const day = x.getDate();
  x.setMonth(x.getMonth() + m);
  if (x.getDate() < day) x.setDate(0);
  x.setHours(0, 0, 0, 0);
  return x;
}
const prettyName = (s = '') => String(s || '').replaceAll('-', ' ').toUpperCase();

/* ========== Fechas locales y rango para API ========== */
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function fromISODateInputLocal(yyyyMmDd) {
  const [y, m, d] = String(yyyyMmDd).split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function toDateInputStr(d) {
  const x = new Date(d); const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
/** Envía a la API ISO strings y hace to exclusivo (+1 ms) para no perder "hoy". */
function buildRangeForApi(start, end) {
  const fromIso = startOfDay(start).toISOString();
  const endExclusive = new Date(endOfDay(end).getTime() + 1); // exclusivo
  const toIso = endExclusive.toISOString();
  return { fromIso, toIso };
}

/* ========== Helpers de facturas/mesa ========== */
function safeDate(x) { const d = new Date(x); return isNaN(d.getTime()) ? new Date() : d; }

/** Detecta si un string parece un slug de sesión (ej: "hdz08q-otw1") */
function looksLikeSessionSlug(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[a-z0-9]+[-_][a-z0-9]+/i.test(str) || str.includes('_') || str.length > 20;
}

function makeFallbackSessionKey(o) {
  const mesaGuess =
    o.tableNumber ?? o.table_name ?? o.tableName ??
    (o.table && (o.table.number || o.table.name || o.table.label)) ??
    o.mesaNumero ?? o.mesa ?? o.tableId ?? o.table_id ?? 'mesa?';
  const d = safeDate(o.createdAt);
  const ymd = d.toISOString().slice(0, 10);
  return `fallback:${mesaGuess}|${ymd}`;
}

/** Lector robusto de mesa: prioriza mesa_sesion.mesa.number (estructura anidada) y luego campo mesa procesado */
function readTableLabelFromOrder(o, sessionKey) {
  const processMesaSesion = (ms) => {
    if (!ms) return null;
    const ses = ms?.data || ms;
    const sesAttrs = ses?.attributes || ses || {};
    const mesa = sesAttrs?.mesa?.data || sesAttrs?.mesa || null;
    const mesaAttrs = mesa?.attributes || mesa || {};
    return mesaAttrs?.number ?? mesaAttrs?.numero ?? mesa?.number ?? mesa?.numero ?? null;
  };

  const mesaSesionNumber = processMesaSesion(o?.mesa_sesion) ?? processMesaSesion(o?.mesaSesion);
  if (mesaSesionNumber != null) {
    return String(mesaSesionNumber);
  }

  const flatMesaSesionNumber =
    o?.mesa_sesion?.mesa?.number ??
    o?.mesa_sesion?.mesa?.numero ??
    o?.mesa_sesion?.mesa?.data?.attributes?.number ??
    o?.mesa_sesion?.mesa?.data?.attributes?.numero ??
    o?.mesa_sesion?.mesa?.data?.number ??
    o?.mesa_sesion?.attributes?.mesa?.number ??
    o?.mesa_sesion?.attributes?.mesa?.data?.attributes?.number ??
    o?.mesaSesion?.mesa?.number ??
    o?.mesaSesion?.mesa?.numero ??
    o?.mesaSesion?.mesa?.data?.attributes?.number ??
    o?.mesaSesion?.mesa?.data?.attributes?.numero ??
    o?.mesaSesion?.mesa?.data?.number ??
    o?.mesaSesion?.attributes?.mesa?.number ??
    o?.mesaSesion?.attributes?.mesa?.data?.attributes?.number;
  if (flatMesaSesionNumber != null) {
    return String(flatMesaSesionNumber);
  }

  if (o?.mesa != null) {
    const mesaValue = o.mesa;
    if (typeof mesaValue === 'number' || (typeof mesaValue === 'string' && /^\d+$/.test(mesaValue))) {
      return String(mesaValue);
    }
    if (typeof mesaValue === 'string' && mesaValue !== '—' && !looksLikeSessionSlug(mesaValue)) {
      const numMatch = mesaValue.match(/\d+/);
      if (numMatch) return numMatch[0];
      if (mesaValue.length < 20 && !mesaValue.includes('-') && !mesaValue.includes('_')) {
        return mesaValue;
      }
    }
  }

  const nestedNumber =
    o?.mesa?.number ??
    o?.mesa?.data?.attributes?.number ??
    o?.mesa?.data?.number ??
    o?.meta?.mesa?.number ??
    o?.meta?.mesaNumber ??
    o?.table?.number ??
    o?.table?.data?.attributes?.number ??
    o?.table?.data?.number ??
    o?.tableNumber ??
    o?.mesaNumero;
  if (nestedNumber != null) {
    return String(nestedNumber);
  }

  const stringCandidates = [
    (typeof o?.mesa === 'string' && o.mesa) ||
    (typeof o?.table === 'string' && o.table) ||
    o?.table_name || o?.tableName || null
  ].filter(Boolean);

  for (const cand of stringCandidates) {
    if (cand && !looksLikeSessionSlug(cand)) {
      const numMatch = String(cand).match(/\d+/);
      if (numMatch) return numMatch[0];
      if (cand.length < 20 && !cand.includes('-') && !cand.includes('_')) {
        return String(cand);
      }
    }
  }

  if (typeof sessionKey === 'string' && sessionKey.startsWith('fallback:')) {
    const maybeMesa = sessionKey.slice('fallback:'.length).split('|')[0];
    if (maybeMesa && !looksLikeSessionSlug(maybeMesa)) {
      const numMatch = maybeMesa.match(/\d+/);
      if (numMatch) return numMatch[0];
      return maybeMesa;
    }
  }

  return '—';
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
      const qty = Number(it?.qty ?? it?.quantity ?? 1);
      const up = Number(it?.unitPrice ?? it?.price ?? it?.product?.price ?? 0);
      out.push({ name, qty, unitPrice: up, total: up * qty });
    }
  }
  if (Array.isArray(order?.itemPedidos)) {
    for (const it of order.itemPedidos) {
      const name = it?.name || it?.producto?.name || it?.producto?.nombre || 'Ítem';
      const qty = Number(it?.qty ?? it?.cantidad ?? 1);
      const up = Number(it?.unitPrice ?? it?.precio ?? it?.producto?.price ?? it?.producto?.precio ?? 0);
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

  const readMesaSesionId = (o) =>
    o?.mesa_sesion?.data?.id ??
    o?.mesa_sesion?.id ??
    o?.mesaSesion?.data?.id ??
    o?.mesaSesion?.id ??
    o?.mesa_sesion_id ??
    o?.mesaSessionId ??
    null;

  for (const o of orders) {
    const msId = readMesaSesionId(o);
    const sessionKey = msId ? `ms:${msId}` : `order:${o.id}`;

    const created = safeDate(o.createdAt || o.updatedAt);
    const updated = safeDate(o.updatedAt || o.createdAt);
    const payMethod = pickPaymentMethodFromOrder(o);
    const tableLabel = readTableLabelFromOrder(o, sessionKey);
    const itemsArr = extractItemsFromOrder(o);
    const itemsCount = Math.max(1, itemsArr.reduce((s, it) => s + (Number(it.qty) || 0), 0));
    const total = Number(o.total ?? o.amount ?? 0);

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
    inv.items += itemsCount;
    inv.subtotal += total;
    inv.total += total;

    if (created < inv.openedAt) inv.openedAt = created;
    if (updated > inv.closedAt) inv.closedAt = updated;
    if (payMethod !== '—') inv.paymentMethod = payMethod;
    if ((inv.table === '—' || inv.table === 'mesa?') && tableLabel && tableLabel !== '—') inv.table = tableLabel;
  }

  return Array.from(byKey.values()).sort((a, b) => b.closedAt - a.closedAt);
}


/* ========== Componente ========== */
export default function OwnerDashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { plan, loading: planLoading } = useRestaurantPlan(slug);
  const { viewMode, isOperativa, isEjecutiva, setViewMode } = useViewMode(slug);

  const [periodKey, setPeriodKey] = useState('30d');
  const [periodTotal, setPeriodTotal] = useState(0);

  // rango personalizado
  const [customStart, setCustomStart] = useState(toDateInputStr(addDays(new Date(), -6)));
  const [customEnd, setCustomEnd] = useState(toDateInputStr(new Date()));
  const isCustom = periodKey === 'custom';

  const [periodOrders, setPeriodOrders] = useState([]);
  const [ordersToday, setOrdersToday] = useState([]);
  const [ordersYesterday, setOrdersYesterday] = useState([]);
  const [lifetimeOrders, setLifetimeOrders] = useState(0);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // Nuevos estados para Health Check y Mesas
  const [tables, setTables] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);

  // Métricas para Health Check
  const [restaurantMetrics, setRestaurantMetrics] = useState({
    productsWithoutImage: 0,
    totalProducts: 0,
    outdatedPrices: 0,
    missingTables: 0,
    totalTables: 0,
    hasLogo: false,
    totalCategories: 0,
    productsWithoutCategory: 0
  });

  const [isLoading, setIsLoading] = useState(true);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [filters, setFilters] = useState({ query: '', paymentMethod: '' });

  // Estados para comentarios
  const [restaurantInfo, setRestaurantInfo] = useState({ id: null, name: '' });
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentSuccess, setCommentSuccess] = useState(false);
  const [commentError, setCommentError] = useState(null);

  const end = useMemo(() => {
    return isCustom ? endOfDay(fromISODateInputLocal(customEnd)) : endOfDay(new Date());
  }, [periodKey, customEnd, isCustom]);

  const start = useMemo(() => {
    if (isCustom) return startOfDay(fromISODateInputLocal(customStart));
    const def = PERIODS.find(p => p.key === periodKey) || PERIODS[0];
    return startOfDay(def.computeStart(end));
  }, [periodKey, end, customStart, isCustom]);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);

    const { fromIso, toIso } = buildRangeForApi(start, end);

    const today = new Date();
    const yesterday = addDays(today, -1);
    const todayStart = startOfDay(today).toISOString();
    const todayEnd = endOfDay(today).toISOString();
    const yesterdayStart = startOfDay(yesterday).toISOString();
    const yesterdayEnd = endOfDay(yesterday).toISOString();

    Promise.all([
      getPaidOrders({ slug, from: fromIso, to: toIso }),
      getPaidOrders({ slug, from: todayStart, to: todayEnd }),
      getPaidOrders({ slug, from: yesterdayStart, to: yesterdayEnd }),
      getTotalOrdersCount({ slug }),
      getSessionsCount({ slug, from: fromIso, to: toIso }),
      fetchTopProducts({ slug, from: fromIso, to: toIso, limit: 5 }),
      (async () => {
        try {
          console.log('🔍 [OwnerDashboard] Iniciando obtención de productos para slug:', slug);
          const restauranteRes = await api.get(`/restaurantes?filters[slug][$eq]=${slug}`);
          const restaurante = restauranteRes?.data?.data?.[0];
          if (!restaurante) {
            console.warn('⚠️ [OwnerDashboard] Restaurante no encontrado para slug:', slug);
            return [];
          }

          const restauranteId = restaurante.id || restaurante.documentId || restaurante.attributes?.id;
          if (!restauranteId) {
            console.warn('⚠️ [OwnerDashboard] No se pudo obtener restauranteId del restaurante:', restaurante);
            return [];
          }

          console.log('🔍 [OwnerDashboard] Obteniendo productos para restauranteId:', restauranteId);
          const productosRes = await api.get(
            `/productos?filters[restaurante][id][$eq]=${restauranteId}&populate[image,categoria]&sort[0]=name:asc`,
            { headers: { Authorization: `Bearer ${localStorage.getItem('jwt') || localStorage.getItem('strapi_jwt') || ''}` } }
          );

          const productos = productosRes?.data?.data || [];
          console.log('✅ [OwnerDashboard] Productos obtenidos de API directa (TODOS, incluidos no disponibles):', productos.length);
          
          const disponibles = productos.filter(p => {
            const attr = p.attributes || p;
            return attr.available !== false;
          }).length;
          const noDisponibles = productos.length - disponibles;
          console.log(`✅ [OwnerDashboard] Productos disponibles: ${disponibles}, No disponibles: ${noDisponibles}`);
          
          if (productos.length > 0) {
            console.log('✅ [OwnerDashboard] Ejemplo de producto (primer producto):', {
              id: productos[0].id,
              name: productos[0].attributes?.name,
              available: productos[0].attributes?.available,
              availableType: typeof productos[0].attributes?.available
            });
          }

          return productos.map(p => {
            const attr = p.attributes || p;
            const categoria = attr.categoria?.data || attr.categoria;
            const availableValue = attr.available !== undefined ? attr.available : true;
            return {
              id: p.id || p.documentId,
              name: attr.name || '',
              price: Number(attr.price || 0),
              image: attr.image?.data?.attributes?.url || attr.image?.url || null,
              available: availableValue,
              categoriaId: categoria ? (categoria.id || categoria.documentId) : null,
              categoriaName: categoria ? (categoria.attributes?.name || categoria.name) : null
            };
          });
        } catch (err) {
          console.error('❌ [OwnerDashboard] Error obteniendo productos:', err);
          console.error('❌ [OwnerDashboard] Error details:', err?.response?.data || err?.message);
          return [];
        }
      })(),
      api.get(`/restaurantes?filters[slug][$eq]=${slug}&populate[mesas]=true&populate[categorias]=true&populate[logo]=true`).catch(() => ({ data: { data: [] } })),
      fetchCategories(slug).catch(() => []),
      fetchTables(slug).catch((e) => { console.warn('Error fetching tables:', e); return []; }),
      fetchActiveOrders(slug).catch((e) => { console.warn('Error fetching active orders:', e); return []; }),
    ])
      .then(([orders, todayOrders, yesterdayOrders, totalOrd, sessions, topProd, productosActivos, restaurantRes, categoriesData, tablesData, activeOrdersData]) => {
        const list = Array.isArray(orders) ? orders : [];
        const todayList = Array.isArray(todayOrders) ? todayOrders : [];
        const yesterdayList = Array.isArray(yesterdayOrders) ? yesterdayOrders : [];

        setPeriodOrders(list);
        setOrdersToday(todayList);
        setOrdersYesterday(yesterdayList);
        setLifetimeOrders(Number(totalOrd) || 0);
        setSessionsCount(Number(sessions) || 0);
        setTopProducts(topProd || []);
        setInvoices(groupOrdersToInvoices(list));

        setTables(Array.isArray(tablesData) ? tablesData : []);
        setActiveOrders(Array.isArray(activeOrdersData) ? activeOrdersData : []);

        const restaurant = restaurantRes?.data?.data?.[0];
        const productos = Array.isArray(productosActivos) ? productosActivos : [];

        if (restaurant) {
          const attr = restaurant.attributes || restaurant;
          const mesas = attr.mesas?.data || attr.mesas || [];
          const categoriasFromPopulate = attr.categorias?.data || attr.categorias || [];
          const totalCategories =
            (Array.isArray(categoriesData) && categoriesData.length >= 0)
              ? categoriesData.length
              : (categoriasFromPopulate?.length || 0);

          const restaurantId = restaurant.id || restaurant.documentId;
          const restaurantName = attr.name || restaurant.name || prettyName(slug);
          setRestaurantInfo({ id: restaurantId, name: restaurantName });

          const productsWithoutImage = productos.filter(p => !p.image).length;
          const productsWithoutCategory = productos.filter(p => !p.categoriaId).length;

          setRestaurantMetrics({
            productsWithoutImage,
            totalProducts: productos.length,
            outdatedPrices: 0,
            missingTables: 0,
            totalTables: mesas.length,
            hasLogo: !!(attr.logo?.data || attr.logo),
            totalCategories,
            productsWithoutCategory
          });
        } else {
          const productsWithoutImage = productos.filter(p => !p.image).length;
          const productsWithoutCategory = productos.filter(p => !p.categoriaId).length;

          setRestaurantMetrics({
            productsWithoutImage,
            totalProducts: productos.length,
            outdatedPrices: 0,
            missingTables: 0,
            totalTables: 0,
            hasLogo: false,
            totalCategories: 0,
            productsWithoutCategory
          });
        }
      })
      .catch((err) => {
        console.error('Error loading dashboard data:', err);
        setPeriodOrders([]);
        setOrdersToday([]);
        setOrdersYesterday([]);
        setInvoices([]);
        setTopProducts([]);
        setTables([]);
        setActiveOrders([]);
      })
      .finally(() => setIsLoading(false));
  }, [slug, periodKey, start.getTime(), end.getTime()]);

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

    const todayVsYesterday = calculateTodayVsYesterday(ordersToday, ordersYesterday);

    const recent7Days = periodOrders.filter(o => {
      const orderDate = safeDate(o.createdAt);
      const daysAgo = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));
      return daysAgo <= 7;
    });
    const previous7Days = periodOrders.filter(o => {
      const orderDate = safeDate(o.createdAt);
      const daysAgo = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));
      return daysAgo > 7 && daysAgo <= 14;
    });
    const salesTrend = calculateSalesTrend(recent7Days, previous7Days);

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setTime(lastWeekEnd.getTime() - 1);

    const thisWeekOrders = periodOrders.filter(o => {
      const orderDate = safeDate(o.createdAt);
      return orderDate >= thisWeekStart;
    });
    const lastWeekOrders = periodOrders.filter(o => {
      const orderDate = safeDate(o.createdAt);
      return orderDate >= lastWeekStart && orderDate < thisWeekStart;
    });

    const thisWeekTotal = thisWeekOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const lastWeekTotal = lastWeekOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    return {
      ingresosHoy,
      ticketPromedio,
      paymentMix,
      todayVsYesterday,
      salesTrend,
      weeklyComparison: {
        thisWeek: thisWeekTotal,
        lastWeek: lastWeekTotal
      }
    };
  }, [periodOrders, periodTotal, invoices, ordersToday, ordersYesterday]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const q = (filters.query || '').toLowerCase();
      const byText = !q
        || String(inv.invoiceId).toLowerCase().includes(q)
        || String(inv.table).toLowerCase().includes(q);
      const byPay = filters.paymentMethod ? (inv.paymentMethod === filters.paymentMethod) : true;
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facturas_${slug}_${new Date().toISOString().slice(0, 10)}.csv`;
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

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !restaurantInfo.id) {
      setCommentError('Por favor, completa el comentario');
      return;
    }

    setIsSubmittingComment(true);
    setCommentError(null);
    setCommentSuccess(false);

    try {
      await createOwnerComment({
        restaurantId: restaurantInfo.id,
        restaurantName: restaurantInfo.name,
        comment: commentText.trim(),
      });
      setCommentText('');
      setCommentSuccess(true);
      setTimeout(() => setCommentSuccess(false), 3000);
    } catch (error) {
      console.error('Error al enviar comentario:', error);
      const errorMessage = 
        error.response?.data?.error?.message || 
        error.response?.data?.message ||
        error.message ||
        'Error al enviar el comentario. Por favor, intenta nuevamente.';
      setCommentError(errorMessage);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (!slug) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Seleccioná un restaurante</h2>
        <button onClick={() => navigate('/owner/mcdonalds/dashboard')}>Ir a McDonalds (ejemplo)</button>
      </div>
    );
  }

  const paymentMixString = Object.entries(derivedKpis.paymentMix).map(([k, v]) => `${k}: ${v}`).join(' / ');

  return (
    <Box 
      sx={{ 
        p: isEjecutiva ? 4 : 3,
        borderRadius: 3,
        bgcolor: 'background.default',
        border: `1px solid ${COLORS.border}`,
        boxShadow: '0 1px 3px rgba(9,9,11,0.08), 0 1px 2px rgba(9,9,11,0.04)',
        minHeight: '100vh',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        mb: isEjecutiva ? 4 : 4, 
        gap: 0,
        pb: isEjecutiva ? 3 : 0,
        borderBottom: `1px solid ${COLORS.border}`
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {isEjecutiva ? 'Vista Ejecutiva' : 'Dashboard'} — {prettyName(slug)}
              </Typography>
              <Chip 
                label={isEjecutiva ? 'Vista Ejecutiva' : 'Vista Operativa'}
                color={isEjecutiva ? 'secondary' : 'primary'}
                size="small"
                sx={{ fontWeight: 600 }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Plan: <strong>{plan || 'BASIC'}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0, ml: 'auto' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<OpenInNewIcon />}
            onClick={() => window.open(`/${slug}/menu`, '_blank', 'noopener,noreferrer')}
            sx={{ textTransform: 'none' }}
          >
            Ver menú
          </Button>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => {
              if (newMode !== null) setViewMode(newMode);
            }}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontWeight: 600,
                px: 2,
                border: `1px solid ${COLORS.border}`,
                '&.Mui-selected': {
                  bgcolor: COLORS.primary,
                  color: COLORS.white,
                  '&:hover': {
                    bgcolor: COLORS.primaryLight,
                  }
                }
              }
            }}
          >
            <ToggleButton value="operativa">Vista Operativa</ToggleButton>
            <ToggleButton value="ejecutiva">Vista Ejecutiva</ToggleButton>
          </ToggleButtonGroup>
          </Box>
        </Box>

        <Box sx={{ mt: 3, width: '100%' }}>
          <Box sx={{ 
            display: 'flex', 
            gap: 1, 
            alignItems: 'center', 
            flexWrap: 'nowrap', 
            overflowX: 'auto',
            pb: 0.5,
            '&::-webkit-scrollbar': { height: 6 },
            '&::-webkit-scrollbar-thumb': { borderRadius: 3, bgcolor: 'action.hover' }
          }}>
            {PERIODS.filter(p => p.key !== 'custom').map((p) => (
              <Button
                key={p.key}
                onClick={() => setPeriodKey(p.key)}
                variant={p.key === periodKey ? 'contained' : 'outlined'}
                size="small"
                sx={{
                  minWidth: 'auto',
                  flexShrink: 0,
                  px: 2,
                  textTransform: 'none',
                  ...(p.key === periodKey && {
                    bgcolor: COLORS.primary,
                    '&:hover': { bgcolor: COLORS.primaryLight }
                  })
                }}
              >
                {p.label}
              </Button>
            ))}
            <Button
              onClick={() => setPeriodKey('custom')}
              variant={periodKey === 'custom' ? 'contained' : 'outlined'}
              size="small"
              sx={{
                minWidth: 'auto',
                flexShrink: 0,
                px: 2,
                textTransform: 'none',
                ...(periodKey === 'custom' && {
                  bgcolor: COLORS.primary,
                  '&:hover': { bgcolor: COLORS.primaryLight }
                })
              }}
            >
              Personalizado
            </Button>
            {periodKey === 'custom' && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 1, flexShrink: 0 }}>
                <input
                  type="date"
                  value={customStart}
                  max={customEnd}
                  onChange={(e) => setCustomStart(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    background: COLORS.white,
                    fontFamily: 'inherit'
                  }}
                />
                <Typography variant="body2" color="text.secondary">—</Typography>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    background: COLORS.white,
                    fontFamily: 'inherit'
                  }}
                />
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {isOperativa ? (
        <>
          {/* ========== VISTA OPERATIVA ========== */}
          <Grid
            container
            spacing={2}
            sx={{
              mt: 4,
              mb: 3,
            }}
          >
            <Grid item xs={12} sm={6} md={3}>
              <KpiCardEnhanced
                title="Ingresos del Día"
                value={derivedKpis.ingresosHoy}
                formatter={money}
                trend={derivedKpis.todayVsYesterday && Math.abs(derivedKpis.todayVsYesterday.percentChange) > 0.1 ? {
                  value: Math.round(derivedKpis.todayVsYesterday.percentChange * 10) / 10,
                  label: 'vs ayer'
                } : undefined}
                icon={<AttachMoneyIcon />}
                color={COLORS.primary}
                loading={isLoading}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCardEnhanced
                title="Ticket Promedio"
                value={derivedKpis.ticketPromedio}
                formatter={money}
                icon={<ShoppingCartIcon />}
                color={COLORS.secondary}
                loading={isLoading}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCardEnhanced
                title="Pedidos Históricos"
                value={lifetimeOrders}
                formatter={(n) => String(Math.round(n))}
                icon={<TrendingUpIcon />}
                color={COLORS.primary}
                loading={isLoading}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCardEnhanced
                title="Clientes Atendidos"
                value={sessionsCount}
                formatter={(n) => String(Math.round(n))}
                icon={<PeopleIcon />}
                color={COLORS.accent}
                loading={isLoading}
              />
            </Grid>
          </Grid>

          <Box sx={{ mb: 3 }}>
            <SalesByDayChart
              slug={slug}
              start={start}
              end={end}
              periodKey={periodKey + (isCustom ? ` ${customStart}-${customEnd}` : '')}
              onTotalChange={setPeriodTotal}
            />
          </Box>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={4}>
              <ComparisonCard
                title="HOY vs AYER"
                currentValue={derivedKpis.todayVsYesterday?.today || 0}
                previousValue={derivedKpis.todayVsYesterday?.yesterday || 0}
                formatter={money}
                currentLabel="Hoy"
                previousLabel="Ayer"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <ComparisonCard
                title="Esta Semana vs Semana Pasada"
                currentValue={derivedKpis.weeklyComparison?.thisWeek || 0}
                previousValue={derivedKpis.weeklyComparison?.lastWeek || 0}
                formatter={money}
                currentLabel="Esta semana"
                previousLabel="Semana pasada"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <ComparisonCard
                title="Tendencia 7 días"
                currentValue={derivedKpis.salesTrend?.recent || 0}
                previousValue={derivedKpis.salesTrend?.previous || 0}
                formatter={money}
                currentLabel="Últimos 7 días"
                previousLabel="Anteriores 7 días"
              />
            </Grid>
          </Grid>

          <Box sx={{ mb: 3 }}>
            <HealthCheckPanel
              metrics={restaurantMetrics}
              onActionClick={(actionId) => {
                if (actionId === 'images' || actionId === 'categories') {
                  navigate(`/owner/${slug}/menu`);
                } else if (actionId === 'tables') {
                  navigate(`/owner/${slug}/tables`);
                } else if (actionId === 'logo') {
                  navigate(`/owner/${slug}/settings`);
                }
              }}
            />
          </Box>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} lg={6}>
              <TablesStatusGrid
                tables={tables}
                orders={activeOrders}
                onTableClick={(table) => {
                  navigate(`/staff/${slug}/orders?table=${table.number}`);
                }}
              />
            </Grid>
            <Grid item xs={12} lg={6}>
              <PeakHoursHeatmap orders={periodOrders} />
            </Grid>
          </Grid>

          {/* Sección de Comentarios */}
          <Box
            sx={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 3,
              bgcolor: 'background.paper',
              p: 3,
              boxShadow: COLORS.shadow2,
              mb: 3
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Enviar Comentario al Administrador
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Comparte tus comentarios, sugerencias o solicitudes con el equipo de administración.
            </Typography>
            <form onSubmit={handleSubmitComment}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Restaurante: <strong>{restaurantInfo.name || prettyName(slug)}</strong>
                </Typography>
                <textarea
                  value={commentText}
                  onChange={(e) => {
                    setCommentText(e.target.value);
                    setCommentError(null);
                  }}
                  placeholder="Escribe tu comentario, feedback, solicitud o sugerencia aquí..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 8,
                    border: `1px solid ${commentError ? COLORS.error : COLORS.border}`,
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                  disabled={isSubmittingComment}
                />
                {commentError && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    {commentError}
                  </Typography>
                )}
                {commentSuccess && (
                  <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block' }}>
                    ✓ Comentario enviado correctamente
                  </Typography>
                )}
              </Box>
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmittingComment || !commentText.trim()}
              >
                {isSubmittingComment ? 'Enviando...' : 'Enviar Comentario'}
              </Button>
            </form>
          </Box>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} lg={6}>
              <RecentActivityPanel
                recentOrders={periodOrders.slice(0, 5)}
                recentInvoices={invoices.slice(0, 5)}
              />
            </Grid>
            <Grid item xs={12} lg={6}>
              <TopProductsChart products={topProducts} limit={5} />
            </Grid>
          </Grid>

          {/* Facturas del período */}
          <Box
            sx={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 3,
              bgcolor: 'background.paper',
              p: 3,
              boxShadow: COLORS.shadow1,
              mb: 3
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Facturas del período
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Mostrando: <strong>{filteredInvoices.length}</strong> de {invoices.length}
              </Typography>
            </Box>
            <FiltersBar
              filters={filters}
              onFiltersChange={setFilters}
              onExport={handleExport}
              paymentMethods={Object.keys(derivedKpis.paymentMix)}
            />
            {isLoading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">Cargando facturas...</Typography>
              </Box>
            ) : (
              <InvoicesTable rows={filteredInvoices} onRowClick={(inv) => { setSelectedInvoice(inv); setOpenDrawer(true); }} />
            )}
          </Box>
        </>
      ) : (
        <>
          {/* ========== VISTA EJECUTIVA ========== */}
          <Box sx={{ mb: 4, p: 2.5, borderRadius: 3, bgcolor: 'background.paper', border: `1px solid ${COLORS.border}` }}>
            <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              Vista Ejecutiva: Análisis estratégico enfocado en métricas de negocio, rentabilidad y tendencias. 
              Ideal para toma de decisiones de alto nivel y planificación estratégica.
            </Typography>
          </Box>

          <ExecutiveKPIs
            periodTotal={periodTotal}
            ticketPromedio={derivedKpis.ticketPromedio}
            sessionsCount={sessionsCount}
            lifetimeOrders={lifetimeOrders}
            todayVsYesterday={derivedKpis.todayVsYesterday}
            weeklyComparison={derivedKpis.weeklyComparison}
            salesTrend={derivedKpis.salesTrend}
            loading={isLoading}
          />

          <ExecutiveSummary
            periodTotal={periodTotal}
            ticketPromedio={derivedKpis.ticketPromedio}
            sessionsCount={sessionsCount}
            lifetimeOrders={lifetimeOrders}
            invoices={invoices}
            periodOrders={periodOrders}
            todayVsYesterday={derivedKpis.todayVsYesterday}
            weeklyComparison={derivedKpis.weeklyComparison}
          />

          <ExecutiveCharts
            slug={slug}
            start={start}
            end={end}
            periodKey={periodKey + (isCustom ? ` ${customStart}-${customEnd}` : '')}
            periodTotal={periodTotal}
            onTotalChange={setPeriodTotal}
            topProducts={topProducts}
            periodOrders={periodOrders}
            todayVsYesterday={derivedKpis.todayVsYesterday}
            weeklyComparison={derivedKpis.weeklyComparison}
            salesTrend={derivedKpis.salesTrend}
          />
        </>
      )}

      <InvoiceDrawer open={openDrawer} onClose={() => setOpenDrawer(false)} invoice={selectedInvoice} />
    </Box>
  );
}


/* ========== UI Aux ========== */
function FiltersBar({ filters, onFiltersChange, onExport, paymentMethods }) {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onFiltersChange(prev => ({ ...prev, [name]: value }));
  };
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <input type="text" name="query" placeholder="Buscar por ID o mesa…" value={filters.query}
        onChange={handleInputChange}
        style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, minWidth: 200 }} />
      <select name="paymentMethod" value={filters.paymentMethod} onChange={handleInputChange}
        style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.white }}>
        <option value="">Todo Pago</option>
        {paymentMethods.map(method => <option key={method} value={method}>{method}</option>)}
      </select>
      <button
        onClick={() => onFiltersChange({ query: '', paymentMethod: '' })}
        style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.white, cursor: 'pointer', fontWeight: 600, color: COLORS.textSecondary }}
      >
        Limpiar
      </button>
      <button 
        onClick={onExport}
        style={{ 
          marginLeft: 'auto', 
          padding: '8px 16px', 
          borderRadius: 8, 
          border: 'none', 
          background: COLORS.success, 
          color: COLORS.white, 
          fontWeight: 600, 
          cursor: 'pointer' 
        }}
      >
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
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: COLORS.white }}>
      <div style={{ color: COLORS.textSecondary, fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{title}</div>
      <div style={{ fontWeight: 800, lineHeight: 1.1, fontSize: isText ? 14 : 'clamp(24px, 4vw, 28px)', color: COLORS.text }} title={String(value)}>{show}</div>
    </div>
  );
}

function InvoicesTable({ rows, onRowClick }) {
  const [sort, setSort] = useState({ key: 'closedAt', dir: 'desc' });
  const [pageSize, setPageSize] = useState(20);
  if (!rows || !rows.length) return <div style={{ textAlign: 'center', padding: 24, color: COLORS.textMuted }}>Sin facturas para los filtros seleccionados.</div>;

  const sorted = [...rows].sort((a, b) => {
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
          <tr style={{ textAlign: 'left', color: COLORS.textSecondary }}>
            <Th onClick={() => toggle('invoiceId')}>Factura {sort.key === 'invoiceId' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</Th>
            <Th onClick={() => toggle('closedAt')}>Cierre {sort.key === 'closedAt' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</Th>
            <Th onClick={() => toggle('table')}>Mesa {sort.key === 'table' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</Th>
            <Th onClick={() => toggle('items')} style={{ textAlign: 'right' }}>Items {sort.key === 'items' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</Th>
            <Th onClick={() => toggle('total')} style={{ textAlign: 'right' }}>Total {sort.key === 'total' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</Th>
            <Th>Pago</Th>
          </tr>
        </thead>
        <tbody>
          {page.map((inv) => (
            <tr key={inv.invoiceId} onClick={() => onRowClick && onRowClick(inv)} style={{ cursor: 'pointer', borderBottom: `1px solid ${COLORS.border}` }}>
              <td style={{ padding: '12px 8px', fontFamily: 'ui-monospace, monospace' }}>{shortId(inv.invoiceId)}</td>
              <td style={{ padding: '12px 8px' }}>{fmtDateTime.format(safeDate(inv.closedAt))}</td>
              <td style={{ padding: '12px 8px' }}>{String(inv.table)}</td>
              <td style={{ padding: '12px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{inv.items}</td>
              <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700 }}>{money0(inv.total)}</td>
              <td style={{ padding: '12px 8px' }}>{String(inv.paymentMethod || '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {canMore && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        <button
          onClick={() => setPageSize(s => s + 20)}
          style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.white, cursor: 'pointer', fontWeight: 600, color: COLORS.textSecondary }}
        >
          Cargar más
        </button>
      </div>}
    </div>
  );
}

function InvoiceDrawer({ open, onClose, invoice }) {
  if (!open || !invoice) return null;
  const flatItems = [];
  for (const o of (invoice.ordersRaw || [])) flatItems.push(...extractItemsFromOrder(o));
  const orderTimeline = Array.isArray(invoice.ordersRaw) ? invoice.ordersRaw : [];
  const itemsGrouped = flatItems.reduce((acc, it) => {
    const key = it.name || 'Ítem';
    if (!acc[key]) acc[key] = { name: key, qty: 0, total: 0, unitPrice: it.unitPrice || 0 };
    acc[key].qty += Number(it.qty || 0);
    acc[key].total += Number(it.total || 0);
    return acc;
  }, {});
  const items = Object.values(itemsGrouped).sort((a, b) => b.total - a.total);

  const subtotal = invoice.subtotal || items.reduce((s, i) => s + i.total, 0);
  const discounts = invoice.discounts || 0;
  const taxes = invoice.taxes || 0;
  const tip = invoice.tip || 0;
  const total = invoice.total || (subtotal - discounts + taxes + tip);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.35)', zIndex: 40 }} />
      <div role="dialog" aria-modal="true" style={{ position: 'fixed', top: 0, right: 0, height: '100dvh', width: 'min(560px, 95vw)', background: COLORS.white, borderLeft: `1px solid ${COLORS.border}`, zIndex: 41, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: COLORS.text }}>Factura {String(invoice.invoiceId).replace(/^fallback:/, '')}</div>
          <button onClick={onClose} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '6px 10px', background: COLORS.white, cursor: 'pointer' }}>Cerrar</button>
        </div>
        <div style={{ padding: 16, overflow: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <InfoRow label="Mesa" value={String(invoice.table)} />
            <InfoRow label="Pago" value={String(invoice.paymentMethod || '—')} />
            <InfoRow label="Apertura" value={`${fmtDate.format(invoice.openedAt)} ${fmtTime.format(invoice.openedAt)}`} />
            <InfoRow label="Cierre" value={`${fmtDate.format(invoice.closedAt)} ${fmtTime.format(invoice.closedAt)}`} />
          </div>
          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <div style={{ color: COLORS.textSecondary }}>Subtotal</div><div style={{ textAlign: 'right', fontWeight: 600 }}>{money0(subtotal)}</div>
              <div style={{ color: COLORS.textSecondary }}>Descuentos</div><div style={{ textAlign: 'right', fontWeight: 600 }}>{discounts ? `- ${money0(discounts)}` : money0(0)}</div>
              <div style={{ color: COLORS.textSecondary }}>Impuestos</div><div style={{ textAlign: 'right', fontWeight: 600 }}>{money0(taxes)}</div>
              <div style={{ color: COLORS.textSecondary }}>Propina</div><div style={{ textAlign: 'right', fontWeight: 600 }}>{money0(tip)}</div>
              <div style={{ borderTop: `1px dashed ${COLORS.border}`, marginTop: 6 }}></div><div style={{ borderTop: `1px dashed ${COLORS.border}`, marginTop: 6 }}></div>
              <div style={{ fontWeight: 800, color: COLORS.text }}>Total</div><div style={{ textAlign: 'right', fontWeight: 800, color: COLORS.text }}>{money0(total)}</div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: COLORS.text }}>Timeline</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Abierta: {fmtDateTime.format(invoice.openedAt)}</li>
              {orderTimeline.map((order) => (
                <li key={order.id} style={{ marginBottom: 8 }}>
                  Pedido #{order.id} — {order.order_status || order.status || '—'} — {fmtDateTime.format(safeDate(order.createdAt))} — {money0(order.total)}
                  {order.customerNotes && (
                    <div style={{ marginTop: 4, color: COLORS.error }}>
                      Cliente: {String(order.customerNotes)}
                    </div>
                  )}
                  {order.staffNotes && (
                    <div style={{ marginTop: 4, color: COLORS.info, whiteSpace: 'pre-wrap' }}>
                      Staff: {String(order.staffNotes)}
                    </div>
                  )}
                </li>
              ))}
              <li>Cerrada: {fmtDateTime.format(invoice.closedAt)}</li>
            </ul>
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8, color: COLORS.text }}>Items</div>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: COLORS.textSecondary }}>
                    <th style={{ padding: '8px 6px', borderBottom: `1px solid ${COLORS.border}` }}>Producto</th>
                    <th style={{ padding: '8px 6px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>Cant.</th>
                    <th style={{ padding: '8px 6px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>Precio</th>
                    <th style={{ padding: '8px 6px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.name + '_' + i}>
                      <td style={{ padding: '10px 6px', borderBottom: `1px solid ${COLORS.border}` }}>{it.name}</td>
                      <td style={{ padding: '10px 6px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{it.qty}</td>
                      <td style={{ padding: '10px 6px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>{money0(it.unitPrice)}</td>
                      <td style={{ padding: '10px 6px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', fontWeight: 700 }}>{money0(it.total)}</td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr><td colSpan={4} style={{ padding: 12, textAlign: 'center', color: COLORS.textMuted }}>Sin desglose de items para esta factura.</td></tr>
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
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '10px 12px', background: COLORS.white }}>
      <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, color: COLORS.text }}>{value}</div>
    </div>
  );
}

function TopProductsList({ rows }) {
  if (!rows || !rows.length) return <div style={{ color: COLORS.textSecondary }}>Sin datos de productos en este período.</div>;
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: COLORS.textSecondary }}>
            <th style={{ padding: '8px 6px', borderBottom: `1px solid ${COLORS.border}` }}>Producto</th>
            <th style={{ padding: '8px 6px', borderBottom: `1px solid ${COLORS.border}` }}>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.name || 'producto') + '-' + i}>
              <td style={{ padding: '10px 6px', borderBottom: `1px solid ${COLORS.border}` }}>{r.name}</td>
              <td style={{ padding: '10px 6px', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 700 }}>
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
        textAlign: 'left',
        padding: '10px 6px',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        fontSize: 13,
        color: COLORS.textSecondary,
        borderBottom: `1px solid ${COLORS.border}`,
        ...style
      }}
    >
      {children}
    </th>
  );
}
