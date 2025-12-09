// src/pages/Mostrador.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { closeAccount, openSession } from '../api/tenant';
import { fetchTables, resetTables } from '../api/tables';
import { cleanOldSessions } from '../api/restaurant';
import TablesStatusGridEnhanced from '../components/TablesStatusGridEnhanced';
import {
  Box, Typography, Card, CardContent, List, ListItem, Button,
  Divider, Grid, TextField, InputAdornment, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Chip, Drawer, IconButton, MenuItem, Select, FormControl,
  InputLabel
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import WarningIcon from '@mui/icons-material/Warning';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import FreeBreakfastIcon from '@mui/icons-material/FreeBreakfast';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
    .format(Number(n) || 0);

export default function Mostrador() {
  const { slug } = useParams();

  // ----- estado principal -----
  const [pedidos, setPedidos] = useState([]);
  const [todosPedidosSinPagar, setTodosPedidosSinPagar] = useState([]); // TODOS los pedidos sin pagar (incluyendo "served")
  const [cuentas, setCuentas] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [openSessions, setOpenSessions] = useState([]); // Sesiones abiertas sin pedidos
  const [error, setError] = useState(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyTab, setHistoryTab] = useState(0); // 0: pedidos, 1: cuentas
  const [historyPedidos, setHistoryPedidos] = useState([]);
  const [historyCuentas, setHistoryCuentas] = useState([]);
  const [accountDetailDialog, setAccountDetailDialog] = useState({ open: false, cuenta: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [flashIds, setFlashIds] = useState(new Set());
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'info' });
  const [payDialog, setPayDialog] = useState({ open: false, cuenta: null, loading: false, discount: 0, discountType: 'percent', closeWithoutPayment: false });
  const [orderDetailDialog, setOrderDetailDialog] = useState({ open: false, pedido: null });
  const [completeOrderDialog, setCompleteOrderDialog] = useState({ open: false, pedido: null, staffNotes: '' });
  const [cancelOrderDialog, setCancelOrderDialog] = useState({ open: false, pedido: null, reason: '' });
  const [tableDetailDialog, setTableDetailDialog] = useState({ open: false, mesa: null });
  const [cleanupDialog, setCleanupDialog] = useState({ open: false, loading: false });

  // ----- refs auxiliares (SOLO AQUÍ ARRIBA; no dentro de funciones) -----
  const pedidosRef = useRef([]);
  const servingIdsRef = useRef(new Set());
  const hasLoadedRef = useRef(false);          // para no avisar en 1ª carga
  const seenIdsRef = useRef(new Set());
  const pendingBeforeHistoryRef = useRef(new Set());
  const cachedViewsRef = useRef({
    active: { pedidos: [], cuentas: [] },
    history: { pedidos: [], cuentas: [] },
  });
  const audioCtxRef = useRef(null);            // beep

  const playBeep = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = audioCtxRef.current || new AudioContext();
      const ctx = audioCtxRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.16);
    } catch { }
  };

  const triggerFlash = (documentId) => {
    if (!documentId) return;
    setFlashIds((prev) => {
      const next = new Set(prev);
      next.add(documentId);
      return next;
    });
    setTimeout(() => {
      setFlashIds((prev) => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    }, 2000);
  };

  const handleResetSystem = async () => {
    if (!window.confirm('WARNING: Esto borrará TODAS las mesas y sesiones y las recreará (1-20). ¿Seguro?')) return;
    try {
      setSnack({ open: true, msg: 'Reseteando sistema...', severity: 'info' });
      await resetTables(slug);
      setSnack({ open: true, msg: 'Sistema reseteado. Recargando...', severity: 'success' });
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Error al resetear', severity: 'error' });
    }
  };

  const updateCachedView = (nextPedidos, nextCuentas = null) => {
    const cuentasForCache = nextCuentas ?? cachedViewsRef.current.active?.cuentas ?? cuentas;
    cachedViewsRef.current.active = {
      pedidos: nextPedidos,
      cuentas: cuentasForCache,
    };
  };


  // Cargar historial completo (para el drawer)
  const fetchFullHistory = async () => {
    try {
      const qs =
        `?filters[restaurante][slug][$eq]=${encodeURIComponent(slug)}` +
        `&filters[order_status][$in][0]=served&filters[order_status][$in][1]=paid` +
        `&publicationState=preview` +
        `&fields[0]=id&fields[1]=documentId&fields[2]=order_status&fields[3]=total&fields[4]=createdAt&fields[5]=updatedAt&fields[6]=customerNotes&fields[7]=staffNotes` +
        `&populate[mesa_sesion][populate][mesa]=true` +
        `&sort[0]=updatedAt:desc` +
        `&pagination[pageSize]=100`;

      const res = await api.get(`/pedidos${qs}`);
      const base = res?.data?.data ?? [];
      const planos = base.map(mapPedidoRow);

      // Hidratar mesa_sesion para pedidos que no la tienen
      const planosConMesa = await Promise.all(
        planos.map(async (p) => {
          // Si ya tiene mesa_sesion con mesa y número, no hacer request
          if (p.mesa_sesion?.mesa?.number != null) return p;
          // Intentar hidratar si no tiene mesa_sesion
          if (!p.mesa_sesion) {
            return await hydrateMesaSesionIfMissing(p);
          }
          return p;
        })
      );

      // Cargar items para cada pedido
      const planosConItems = await Promise.all(
        planosConMesa.map(async (p) => {
          try {
            const items = await fetchItemsDePedido(p.id);
            return { ...p, items: items || [] };
          } catch {
            return { ...p, items: [] };
          }
        })
      );

      // Agrupar por sesión o por mesa para cuentas
      const grupos = new Map();
      planosConItems.forEach((p) => {
        let key;
        const mesaNum = p.mesa_sesion?.mesa?.number;

        if (p.mesa_sesion?.id != null) {
          // Priorizar agrupación por sesión
          key = `sesion:${p.mesa_sesion.id}`;
        } else if (mesaNum != null) {
          // Si no hay sesión pero hay mesa, agrupar por mesa
          key = `mesa:${mesaNum}`;
        } else {
          // Si no hay ni sesión ni mesa, agrupar por pedido individual
          key = `pedido:${p.id}`;
        }

        const arr = grupos.get(key) || [];
        arr.push(p);
        grupos.set(key, arr);
      });

      const cuentasArr = Array.from(grupos, ([groupKey, arr]) => {
        const total = arr.reduce((sum, it) => sum + Number(it.total || 0), 0);
        const lastUpdated = arr.reduce((max, it) => Math.max(max, new Date(it.updatedAt).getTime()), 0);
        // Intentar obtener número de mesa de cualquier pedido del grupo
        const mesaNumber = arr.find((x) => Number.isFinite(Number(x.mesa_sesion?.mesa?.number)))?.mesa_sesion?.mesa?.number ?? null;
        return {
          groupKey,
          mesaNumber,
          pedidos: arr.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
          total,
          lastUpdated,
        };
      });

      setHistoryPedidos(planosConItems);
      setHistoryCuentas(cuentasArr.sort((a, b) => b.lastUpdated - a.lastUpdated));
    } catch (err) {
      console.error('Error al obtener historial completo:', err);
    }
  };

  // ---- helpers
  const keyOf = (p) => p?.documentId || String(p?.id);
  const isActive = (st) => !['served', 'paid'].includes(st);

  const ordenar = (arr) => {
    const orden = { pending: 0, preparing: 1 };
    return [...arr].sort((a, b) => {
      const pa = orden[a.order_status] ?? 2;
      const pb = orden[b.order_status] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  };

  const ordenarActivos = (arr) => {
    return [...arr].sort((a, b) => {
      const wa = a.order_status === 'preparing' ? 1 : 0;
      const wb = b.order_status === 'preparing' ? 1 : 0;
      if (wa !== wb) return wa - wb;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  };

  const mapPedidoRow = (row) => {
    const a = row.attributes || row;

    // Extraer mesa_sesion con múltiples variantes de estructura
    let ses = a.mesa_sesion?.data || a.mesa_sesion || null;
    let sesAttrs = ses?.attributes || ses || {};

    // Extraer mesa con múltiples variantes de estructura
    let mesa = sesAttrs?.mesa?.data || sesAttrs?.mesa || null;
    let mesaAttrs = mesa?.attributes || mesa || {};

    // Si mesa está directamente en sesAttrs sin .data
    if (!mesa && sesAttrs.mesa) {
      mesa = sesAttrs.mesa;
      mesaAttrs = mesa?.attributes || mesa || {};
    }

    // Extraer número de mesa con múltiples variantes
    let mesaNumber = mesaAttrs.number || mesaAttrs.numero || mesa?.number || null;

    // Si no encontramos el número, intentar otras rutas
    if (!mesaNumber && mesa) {
      mesaNumber = mesa.number || mesa.numero || null;
    }

    // Extraer items si vienen en la respuesta del backend
    let items = [];
    if (a.items) {
      const itemsData = Array.isArray(a.items?.data) ? a.items.data : Array.isArray(a.items) ? a.items : [];
      items = itemsData.map((it) => {
        const itemAttrs = it.attributes || it;
        const prodData = itemAttrs.product?.data || itemAttrs.product || {};
        const prodAttrs = prodData.attributes || prodData;
        return {
          id: it.id || itemAttrs.id,
          quantity: itemAttrs.quantity,
          notes: itemAttrs.notes,
          UnitPrice: itemAttrs.UnitPrice,
          totalPrice: itemAttrs.totalPrice,
          product: prodData.id
            ? {
              id: prodData.id,
              name: prodAttrs.name || prodAttrs.nombre || null,
            }
            : null,
        };
      }).filter((it) => it.id); // Filtrar items sin ID válido
    }

    // Construir objeto mesa_sesion con toda la información disponible
    const mesaSesionObj = ses
      ? {
        id: ses.id || sesAttrs.id || ses.documentId,
        session_status: sesAttrs.session_status || ses.session_status,
        code: sesAttrs.code || ses.code,
        mesa: mesa && mesaNumber != null
          ? {
            id: mesa.id || mesaAttrs.id || mesa.documentId,
            number: mesaNumber,
          }
          : null,
      }
      : null;

    return {
      id: row.id || a.id,
      documentId: a.documentId,
      order_status: a.order_status,
      customerNotes: a.customerNotes,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      total: a.total,
      items: items, // Incluir items si vienen del backend
      mesa_sesion: mesaSesionObj,
    };
  };

  const hydrateMesaSesionIfMissing = async (pedido) => {
    // Si ya tiene mesa_sesion con mesa y número, no hacer request
    if (pedido.mesa_sesion?.mesa?.number != null) return pedido;
    // Si no tiene ID válido, no intentar cargar
    if (!pedido.id) return pedido;
    // Si el pedido no tiene mesa_sesion.id, probablemente nunca tuvo una, no intentar cargar
    if (!pedido.mesa_sesion?.id && pedido.mesa_sesion === null) {
      // Este pedido claramente no tiene mesa_sesion, no hacer request
      return pedido;
    }

    try {
      const qs =
        `?publicationState=preview` +
        `&fields[0]=id&fields[1]=documentId&fields[2]=order_status&fields[3]=customerNotes&fields[4]=total&fields[5]=createdAt&fields[6]=updatedAt` +
        `&populate[mesa_sesion][populate][mesa]=true`;
      const r = await api.get(`/pedidos/${pedido.id}${qs}`);
      const data = r?.data?.data;
      if (!data) return pedido;
      const filled = mapPedidoRow({ id: data.id, ...(data.attributes ? data : { attributes: data }) });
      return filled.mesa_sesion ? filled : pedido;
    } catch (err) {
      // Solo loggear errores que no sean 404 (pedido no encontrado es esperado en algunos casos)
      if (err?.response?.status !== 404) {
        console.warn(`[Mostrador] No se pudo cargar mesa_sesion para pedido ${pedido.id}:`, err?.response?.status || err?.message);
      }
      // Si es 404, el pedido no existe o no está publicado, simplemente retornar el pedido original
      return pedido;
    }
  };

  const fetchItemsDePedido = async (orderId) => {
    const qs =
      `/item-pedidos?publicationState=preview` +
      `&filters[order][id][$eq]=${orderId}` +
      `&populate[product]=true` +
      `&fields[0]=id&fields[1]=quantity&fields[2]=notes&fields[3]=UnitPrice&fields[4]=totalPrice` +
      `&pagination[pageSize]=100`;
    const r = await api.get(qs);
    const raw = r?.data?.data ?? [];
    return raw.map((it) => {
      const a = it.attributes || it;
      const prodData = a.product?.data || a.product || {};
      const prodAttrs = prodData.attributes || prodData;
      return {
        id: it.id || a.id,
        quantity: a.quantity,
        notes: a.notes,
        UnitPrice: a.UnitPrice,
        totalPrice: a.totalPrice,
        product: { id: prodData.id, name: prodAttrs.name },
      };
    });
  };

  // =================== búsqueda por mesa (parcial) ===================
  const mesaTokens = useMemo(() => {
    const tokens = (searchQuery.match(/\d+/g) || []).map((s) => s.trim()).filter(Boolean);
    return tokens;
  }, [searchQuery]);

  const pedidoMatchesMesaPartial = (p) => {
    if (mesaTokens.length === 0) return true;
    const mesaNum = p?.mesa_sesion?.mesa?.number;
    if (mesaNum == null) return false;
    const mesaStr = String(mesaNum);
    return mesaTokens.some((t) => mesaStr.includes(t));
  };

  const cuentaMatchesMesaPartial = (c) => {
    if (mesaTokens.length === 0) return true;
    const mesaNum = c?.mesaNumber;
    if (mesaNum == null) return false;
    const mesaStr = String(mesaNum);
    return mesaTokens.some((t) => mesaStr.includes(t));
  };

  // =================== carga de pedidos ===================
  const fetchPedidos = async () => {
    try {
      const sort = 'createdAt:asc';
      const statusFilter = `&filters[order_status][$in][0]=pending&filters[order_status][$in][1]=preparing&filters[order_status][$in][2]=served`;

      const listQS =
        `?filters[restaurante][slug][$eq]=${encodeURIComponent(slug)}` +
        statusFilter +
        `&publicationState=preview` +
        `&fields[0]=id&fields[1]=documentId&fields[2]=order_status&fields[3]=customerNotes&fields[4]=staffNotes&fields[5]=total&fields[6]=createdAt&fields[7]=updatedAt` +
        `&populate[mesa_sesion][populate][mesa]=true` +
        `&populate[items][populate][product]=true` +
        `&sort[0]=${encodeURIComponent(sort)}` +
        `&pagination[pageSize]=100`;

      const res = await api.get(`/pedidos${listQS}`);
      const base = res?.data?.data ?? [];

      // Debug: Log primer pedido para ver estructura (solo en primera carga)
      if (base.length > 0 && !hasLoadedRef.current) {
        console.log('[Mostrador] Estructura del primer pedido:', JSON.stringify(base[0], null, 2));
      }

      const planos = base.map(mapPedidoRow);

      // Debug: Log primer pedido mapeado (solo en primera carga)
      if (planos.length > 0 && !hasLoadedRef.current) {
        console.log('[Mostrador] Primer pedido mapeado:', planos[0]);
        console.log('[Mostrador] Mesa número extraído:', planos[0]?.mesa_sesion?.mesa?.number);
        console.log('[Mostrador] Mesa_sesion completa:', planos[0]?.mesa_sesion);
      }

      // Solo hidratar pedidos que realmente necesitan la información
      // (que tienen mesa_sesion.id pero no tienen mesa.number)
      const planosFilled = await Promise.all(
        planos.map(async (p) => {
          // Si ya tiene número de mesa, no hidratar
          if (p.mesa_sesion?.mesa?.number != null) return p;
          // Si tiene mesa_sesion.id pero no mesa.number, intentar hidratar
          if (p.mesa_sesion?.id) {
            return await hydrateMesaSesionIfMissing(p);
          }
          // Si no tiene mesa_sesion para nada, no intentar hidratar (evita 404)
          return p;
        })
      );

      // cargar items (priorizar items del backend, luego intentar cargar si faltan)
      const prevByKey = new Map(pedidosRef.current.map((p) => [keyOf(p), p]));
      const conItems = await Promise.all(
        planosFilled.map(async (p) => {
          const prev = prevByKey.get(keyOf(p));
          const prevItems = prev?.items ?? [];

          // Priorizar: 1) items del backend, 2) items previos del caché, 3) cargar desde API
          let items = p.items && Array.isArray(p.items) && p.items.length > 0
            ? p.items // Items ya vienen del backend
            : prevItems.length > 0
              ? prevItems // Usar items previos como fallback
              : []; // Array vacío por defecto

          // Si no hay items (ni del backend ni previos), intentar cargar
          const shouldFetchItems =
            items.length === 0 && isActive(p.order_status);

          if (shouldFetchItems) {
            try {
              const fetched = await fetchItemsDePedido(p.id);
              // Si la carga es exitosa y hay items, usarlos
              if (fetched && Array.isArray(fetched) && fetched.length > 0) {
                items = fetched;
                console.log(`[Mostrador] Items cargados para pedido ${p.id}: ${fetched.length} items`);
              } else if (fetched && Array.isArray(fetched)) {
                // Array vacío es válido, significa que el pedido no tiene items
                items = [];
              }
            } catch (err) {
              // Si falla la carga y no hay items previos, dejar array vacío
              console.warn(`[Mostrador] No se pudieron cargar items del pedido ${p.id}:`, err);
              // Si hay items previos, mantenerlos (ya están en items)
            }
          } else if (p.items && Array.isArray(p.items) && p.items.length > 0) {
            // Items ya vienen del backend, usarlos directamente
            console.log(`[Mostrador] Items del backend para pedido ${p.id}: ${p.items.length} items`);
          }

          return { ...p, items: items || [] };
        })
      );

      const ordenados = ordenarActivos(conItems);

      // visibles: solo activos
      const visibles = ordenados.filter((p) => isActive(p.order_status) && !servingIdsRef.current.has(p.id));

      if (pendingBeforeHistoryRef.current.size > 0) {
        pendingBeforeHistoryRef.current.forEach((id) => seenIdsRef.current.add(id));
        pendingBeforeHistoryRef.current = new Set();
      }

      // ---- avisos SOLO por pedidos nuevos (ID no visto) y que pasan el filtro de mesa
      const nuevosVisibles = visibles.filter(
        (p) => !seenIdsRef.current.has(p.id) && p.order_status === 'pending'
      );

      const nuevosFiltrados = nuevosVisibles.filter(pedidoMatchesMesaPartial);
      if (hasLoadedRef.current && nuevosFiltrados.length > 0) {
        try { playBeep(); } catch { }
        setSnack({ open: true, msg: `${nuevosFiltrados.length} pedido(s) nuevo(s)`, severity: 'info' });
        nuevosFiltrados.forEach((n) => triggerFlash(n.documentId));
      }
      // sembrar vistos (en 1ª carga: todos, luego: sólo los nuevos)
      const idsAAgregar = hasLoadedRef.current ? nuevosVisibles : visibles;
      idsAAgregar.forEach((p) => seenIdsRef.current.add(p.id));

      // guardar visibles (solo para mostrar en la lista de pedidos activos)
      pedidosRef.current = visibles;
      setPedidos(visibles);

      // CRÍTICO: Guardar TODOS los pedidos sin pagar (incluyendo "served") para el estado de mesas
      // Los pedidos "served" también deben considerarse para determinar si una mesa está ocupada
      const todosLosPedidosSinPagar = conItems.filter((p) => p.order_status !== 'paid' && !isSystemOrder(p));
      setTodosPedidosSinPagar(todosLosPedidosSinPagar);
      console.log(`[Mostrador] Pedidos sin pagar para estado de mesas: ${todosLosPedidosSinPagar.length} (incluyendo served)`);
      console.log(`[Mostrador] Pedidos sin pagar (incluyendo served): ${todosLosPedidosSinPagar.length}`);

      // ---- agrupar cuentas (solo activas, excluyendo pedidos del sistema)
      const grupos = new Map();
      ordenados.forEach((p) => {
        // Ignorar pedidos del sistema (llamar mozo / solicitud de cobro / asistencia)
        if (isSystemOrder(p)) return;

        const mesaNum = p.mesa_sesion?.mesa?.number;
        let key;
        if (mesaNum != null) {
          key = `mesa:${mesaNum}`;
        } else if (p.mesa_sesion?.id != null) {
          key = `sesion:${p.mesa_sesion.id}`;
        } else {
          key = `pedido:${p.id}`;
        }
        const arr = grupos.get(key) || [];
        arr.push(p);
        grupos.set(key, arr);
      });

      const cuentasArr = Array.from(grupos, ([groupKey, arr]) => {
        const hasUnpaid = arr.some((o) => o.order_status !== 'paid');
        const lista = hasUnpaid
          ? arr.filter((o) => o.order_status !== 'paid')
          : arr;
        const total = lista.reduce((sum, it) => sum + Number(it.total || 0), 0);
        const lastUpdated = arr.reduce((max, it) => Math.max(max, new Date(it.updatedAt).getTime()), 0);
        const mesaNumber =
          arr.find((x) => Number.isFinite(Number(x.mesa_sesion?.mesa?.number)))?.mesa_sesion?.mesa?.number ?? null;
        const sesId = arr.find((x) => x.mesa_sesion?.id)?.mesa_sesion.id ?? null;
        return {
          groupKey,
          mesaNumber,
          mesaSesionId: sesId,
          pedidos: ordenar(lista),
          total,
          hasUnpaid,
          lastUpdated,
          mesaSesionCode: arr.find((x) => x?.mesa_sesion?.code)?.mesa_sesion?.code ?? null,
        };
      });

      const filtradas = cuentasArr.filter((c) => c.hasUnpaid).sort((a, b) => {
        const am = Number.isFinite(Number(a.mesaNumber)) ? Number(a.mesaNumber) : 999999;
        const bm = Number.isFinite(Number(b.mesaNumber)) ? Number(b.mesaNumber) : 999999;
        return am - bm;
      });

      updateCachedView(visibles, filtradas);

      setCuentas(filtradas);
      setError(null);
    } catch (err) {
      console.error('Error al obtener pedidos:', err?.response?.data || err);
      setError('No se pudieron cargar los pedidos.');
    }
  };

  // ----- polling -----
  useEffect(() => {
    seenIdsRef.current = new Set(); // reset de vistos al cambiar de restaurante
    cachedViewsRef.current = {
      active: { pedidos: [], cuentas: [] },
    };
  }, [slug]);

  // Cargar mesas
  const fetchMesas = async () => {
    try {
      console.log(`[Mostrador] fetchMesas: Obteniendo mesas para ${slug}...`);
      const mesasData = await fetchTables(slug);
      console.log(`[Mostrador] fetchMesas: Obtenidas ${mesasData.length} mesas`);

      // Log de estados de mesas para debugging
      const estados = mesasData.reduce((acc, m) => {
        acc[m.status] = (acc[m.status] || 0) + 1;
        return acc;
      }, {});
      console.log(`[Mostrador] fetchMesas: Estados de mesas:`, estados);

      setMesas(mesasData);
    } catch (err) {
      console.error('[Mostrador] Error al obtener mesas:', err);
    }
  };

  // Cargar sesiones abiertas (mesas ocupadas sin pedidos)
  const fetchOpenSessions = async () => {
    try {
      // Primero obtener el restaurante por slug para tener su ID
      const restauranteRes = await api.get(`/restaurantes?filters[slug][$eq]=${slug}&fields[0]=id`);
      const restaurante = restauranteRes?.data?.data?.[0];
      if (!restaurante?.id) {
        setOpenSessions([]);
        return;
      }

      const params = new URLSearchParams();
      params.append('filters[restaurante][id][$eq]', restaurante.id);
      // Traer solo sesiones 'open' (ocupadas) - Usar $eq para mayor seguridad
      params.append('filters[session_status][$eq]', 'open');

      // Especificar campos explícitamente para asegurar que session_status y openedAt estén incluidos
      params.append('fields[0]', 'id');
      params.append('fields[1]', 'documentId');
      params.append('fields[2]', 'session_status');
      params.append('fields[3]', 'openedAt');
      params.append('fields[4]', 'closedAt');
      // Poblar mesa
      params.append('populate[mesa]', 'true');
      params.append('pagination[pageSize]', '200');
      params.append('sort[0]', 'updatedAt:desc');
      // CACHE BUSTING: Force fresh request
      params.append('_t', Date.now());

      const { data } = await api.get(`/mesa-sesions?${params.toString()}`);
      const rawSessions = data?.data || [];

      // FILTRO ROBUSTO EN MEMORIA: Descartar cualquier cosa que no sea 'open'
      // Esto protege contra bugs de filtrado en Strapi o caché, y "Zombies" cerrados
      const sessions = rawSessions.filter(s => {
        const status = s.attributes?.session_status || s.session_status;
        return status === 'open';
      });

      if (rawSessions.length !== sessions.length) {
        console.warn(`[Mostrador] ⚠️ fetchOpenSessions: Ignored ${rawSessions.length - sessions.length} non-open sessions (Zombie Protection)`);
      }

      // Incluir sesiones abiertas RECIENTES (últimas 24 horas)
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 horas en milisegundos

      const recentOpenSessions = sessions
        .map((session) => {
          // Manejar diferentes estructuras de respuesta de Strapi
          let mesaNumber = null;
          const sessionAttr = session.attributes || session;

          // Función auxiliar para extraer número de mesa
          const extractMesaNumber = (mesaObj) => {
            if (!mesaObj) return null;
            // Caso 1: mesa.number directamente
            if (typeof mesaObj.number === 'number' || typeof mesaObj.number === 'string') return Number(mesaObj.number);
            // Caso 2: mesa.data
            if (mesaObj.data) {
              const d = Array.isArray(mesaObj.data) ? mesaObj.data[0] : mesaObj.data;
              if (d?.number != null) return Number(d.number);
              if (d?.attributes?.number != null) return Number(d.attributes.number);
            }
            // Caso 3: attributos directos
            if (mesaObj.attributes?.number != null) return Number(mesaObj.attributes.number);
            return null;
          };

          mesaNumber = extractMesaNumber(sessionAttr.mesa);

          if (mesaNumber == null) return null;

          // Check stale
          const openedAt = sessionAttr.openedAt || sessionAttr.createdAt;
          const openedAtTime = openedAt ? new Date(openedAt).getTime() : 0;
          if (openedAtTime > 0 && openedAtTime < oneDayAgo) return null; // Too old

          return {
            id: session.id,
            documentId: session.documentId,
            mesaNumber,
            session_status: sessionAttr.session_status,
            openedAt: sessionAttr.openedAt,
            createdAt: sessionAttr.createdAt,
            mesa: sessionAttr.mesa
          };
        })
        .filter(Boolean);

      // Log resumen de sesiones ignoradas (solo si hay muchas)




      // Eliminar duplicados: mantener solo la sesión más reciente por mesa
      // Todas las sesiones aquí son 'open' (ya filtramos las demás)
      const sessionsByTable = new Map();
      recentOpenSessions.forEach(session => {
        const existing = sessionsByTable.get(session.mesaNumber);
        if (!existing) {
          sessionsByTable.set(session.mesaNumber, session);
        } else {
          // Usar la sesión más reciente (por openedAt)
          const currentTime = session.openedAt ? new Date(session.openedAt).getTime() : 0;
          const existingTime = existing.openedAt ? new Date(existing.openedAt).getTime() : 0;
          if (currentTime > existingTime) {
            sessionsByTable.set(session.mesaNumber, session);
          }
        }
      });

      // Convertir el Map de vuelta a array
      const validSessions = Array.from(sessionsByTable.values());

      // Log si se eliminaron duplicados
      if (recentOpenSessions.length > validSessions.length) {
        console.log(`[fetchOpenSessions] Eliminados ${recentOpenSessions.length - validSessions.length} duplicado(s). De ${recentOpenSessions.length} a ${validSessions.length} sesiones únicas.`);
      }

      // Log solo cuando hay sesiones válidas o cambios significativos
      setOpenSessions(validSessions);


    } catch (err) {
      // Solo loguear errores críticos, no en cada intento
      if (err?.response?.status !== 404 && err?.response?.status !== 403) {
        console.error('[fetchOpenSessions] Error al obtener sesiones abiertas:', err?.response?.data || err);
      }
      setOpenSessions([]);
    }
  };

  // Liberar mesa (cerrar sesión sin pedidos)
  const liberarMesa = async (mesaNumber) => {
    try {
      // Buscar la sesión abierta de esa mesa
      const session = openSessions.find((s) => s.mesaNumber === mesaNumber);
      if (!session) {
        setSnack({ open: true, msg: 'No se encontró sesión abierta para esta mesa', severity: 'warning' });
        return;
      }

      // Cancelar todos los pedidos activos de esta mesa antes de cerrar la sesión
      // Esto evita que la mesa vuelva a aparecer como ocupada después de liberarla
      const pedidosActivos = pedidos.filter(p => {
        // Extraer número de mesa de diferentes estructuras posibles
        const mesaData = p?.mesa_sesion?.mesa || p?.mesa_sesion?.attributes?.mesa || p?.mesa;
        const mesaObj = mesaData?.data || mesaData?.attributes || mesaData;
        const tableNum = mesaObj?.number || mesaData?.number || p?.mesa || p?.tableNumber;

        const isActive = p?.order_status === 'pending' ||
          p?.order_status === 'preparing' ||
          p?.order_status === 'served';
        return tableNum != null && Number(tableNum) === Number(mesaNumber) && isActive;
      });

      if (pedidosActivos.length > 0) {
        try {
          await Promise.all(
            pedidosActivos.map(pedido => putEstado(pedido, 'cancelled'))
          );
          console.log(`[liberarMesa] Cancelados ${pedidosActivos.length} pedido(s) activo(s) de la mesa ${mesaNumber}`);
        } catch (err) {
          console.warn('Error al cancelar algunos pedidos al liberar mesa:', err);
          // Continuar con el cierre de sesión aunque falle la cancelación de pedidos
        }
      }

      // Cerrar la sesión usando el endpoint custom (evita problemas de permisos)
      console.log(`[liberarMesa] Cerrando sesión de Mesa ${mesaNumber}...`, { session });
      const closeResponse = await api.put(`/restaurants/${slug}/close-session`, {
        data: {
          table: mesaNumber,
        },
      });
      console.log(`[liberarMesa] Respuesta del backend al cerrar sesión:`, closeResponse?.data);
      if (closeResponse?.data?.data?.debug) {
        console.log(`[liberarMesa] DEBUG INFO:`, closeResponse.data.data.debug);
      }

      // Actualizar estado inmediatamente para que la UI responda rápido
      setOpenSessions(prev => {
        const filtered = prev.filter(s => s.mesaNumber !== mesaNumber);
        console.log(`[liberarMesa] Estado local actualizado. Antes: ${prev.length} sesiones, Después: ${filtered.length} sesiones`);
        return filtered;
      });

      setSnack({ open: true, msg: `Mesa ${mesaNumber} liberada ✅`, severity: 'success' });

      // Esperar un momento para que el backend procese el cambio y se propague
      // Strapi puede tener caché, así que esperamos un poco más
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Refrescar datos del servidor para verificar que la sesión se cerró
      console.log(`[liberarMesa] Refrescando sesiones después de cerrar...`);
      await fetchOpenSessions();

      // Hacer una verificación adicional: consultar directamente al backend para confirmar
      try {
        const restauranteRes = await api.get(`/restaurantes?filters[slug][$eq]=${slug}&fields[0]=id`);
        const restaurante = restauranteRes?.data?.data?.[0];
        if (restaurante?.id) {
          const verifyParams = new URLSearchParams();
          verifyParams.append('filters[restaurante][id][$eq]', restaurante.id);
          verifyParams.append('filters[session_status][$in][0]', 'open');
          verifyParams.append('populate[mesa][fields][0]', 'number');
          verifyParams.append('pagination[pageSize]', '100');

          const verifyRes = await api.get(`/mesa-sesions?${verifyParams.toString()}`);
          const verifySessions = verifyRes?.data?.data || [];

          // Buscar todas las sesiones de esta mesa
          const mesaSessions = verifySessions.filter((s) => {
            const mesa = s.mesa?.data || s.mesa || s.attributes?.mesa?.data || s.attributes?.mesa;
            const sessionMesaNumber = mesa?.attributes?.number || mesa?.number;
            return Number(sessionMesaNumber) === Number(mesaNumber);
          });

          if (mesaSessions.length > 0) {
            console.warn(`[liberarMesa] ⚠️ ADVERTENCIA: Mesa ${mesaNumber} todavía tiene ${mesaSessions.length} sesión(es) abierta(s) en el backend después de 2 segundos:`, mesaSessions);
          } else {
            console.log(`[liberarMesa] ✅ Confirmado: Mesa ${mesaNumber} ya no tiene sesiones abiertas en el backend`);
          }
        }
      } catch (verifyErr) {
        console.warn('[liberarMesa] Error al verificar sesión en backend:', verifyErr);
      }

      await fetchPedidos();
      await fetchMesas(); // Refrescar mesas para actualizar UI

      // Cerrar el diálogo de detalle de mesa si está abierto
      if (tableDetailDialog.mesa?.number === mesaNumber) {
        setTableDetailDialog({ open: false, mesa: null });
      }
    } catch (err) {
      console.error('Error al liberar mesa:', err);
      setSnack({ open: true, msg: 'No se pudo liberar la mesa ❌', severity: 'error' });
    }
  };

  // Limpiar sesiones antiguas
  const handleCleanupOldSessions = async () => {
    setCleanupDialog({ open: true, loading: false });
  };

  const confirmCleanup = async () => {
    setCleanupDialog({ open: true, loading: true });
    try {
      const result = await cleanOldSessions(slug, { daysOpen: 7, daysClosed: 30 });
      const deleted = result?.deleted || result?.data?.deleted || 0;
      setSnack({
        open: true,
        msg: `✅ Limpieza completada: ${deleted} sesión(es) eliminada(s)`,
        severity: 'success',
      });
      setCleanupDialog({ open: false, loading: false });
      // Refrescar datos
      await fetchOpenSessions();
      await fetchPedidos();
    } catch (err) {
      console.error('Error limpiando sesiones antiguas:', err);
      const errorMsg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Error desconocido';
      const statusCode = err?.response?.status;
      setSnack({
        open: true,
        msg: `❌ Error al limpiar sesiones: ${errorMsg}${statusCode ? ` (${statusCode})` : ''}`,
        severity: 'error',
      });
      setCleanupDialog({ open: false, loading: false });
    }
  };

  // Marcar mesa como disponible después de limpiarla
  const marcarMesaComoDisponible = async (mesaNumber) => {
    try {
      console.log(`[marcarMesaComoDisponible] Limpiando mesa ${mesaNumber}...`);

      // Usar el endpoint robusto del backend que cierra sesiones Y pone la mesa como disponible
      const closeResponse = await api.put(`/restaurants/${slug}/close-session`, {
        data: {
          table: mesaNumber,
        },
      });

      console.log(`[marcarMesaComoDisponible] Respuesta backend:`, closeResponse?.data);

      // Actualizar estado inmediatamente para que la UI responda rápido
      setOpenSessions(prev => prev.filter(s => Number(s.mesaNumber) !== Number(mesaNumber)));

      // Optimista: Actualizar el estado de la mesa localmente también
      setMesas(prev => prev.map(m =>
        Number(m.number) === Number(mesaNumber)
          ? { ...m, status: 'disponible', currentSession: null }
          : m
      ));

      setSnack({ open: true, msg: `Mesa ${mesaNumber} marcada como disponible ✅`, severity: 'success' });

      // Refrescar datos del servidor
      await Promise.all([
        fetchOpenSessions(),
        fetchPedidos(),
        fetchMesas()
      ]);

      // Cerrar el diálogo de detalle de mesa si está abierto
      if (tableDetailDialog.mesa?.number === mesaNumber) {
        setTableDetailDialog({ open: false, mesa: null });
      }
    } catch (err) {
      console.error('Error al marcar mesa como disponible:', err);
      setSnack({ open: true, msg: 'No se pudo marcar la mesa como disponible ❌', severity: 'error' });
    }
  };

  // Abrir sesión manualmente (Ocupar Mesa)
  const handleOpenSession = async (mesaNumber) => {
    try {
      console.log(`[handleOpenSession] Abriendo sesión para Mesa ${mesaNumber}...`);
      await openSession(slug, { table: mesaNumber });

      setSnack({ open: true, msg: `Mesa ${mesaNumber} ocupada ✅`, severity: 'success' });

      // Refrescar datos
      await fetchOpenSessions();
      await fetchMesas();

      // Cerrar el diálogo
      setTableDetailDialog({ open: false, mesa: null });
    } catch (err) {
      console.error('Error al ocupar mesa:', err);
      setSnack({ open: true, msg: 'No se pudo ocupar la mesa ❌', severity: 'error' });
    }
  };

  // Verificar si una mesa necesita limpieza (tiene pedidos pagados recientemente o estado explícito)
  const mesaNecesitaLimpieza = (mesaNumber) => {
    // 1. Verificar estado explícito del backend
    const mesa = mesas.find(m => Number(m.number) === Number(mesaNumber));
    if (mesa && mesa.status === 'por_limpiar') {
      return true;
    }

    // 2. Fallback: lógica antigua por si acaso (pedidos pagados recientemente)
    const mesaPedidos = pedidos.filter(p =>
      !isSystemOrder(p) &&
      p.mesa_sesion?.mesa?.number === mesaNumber
    );

    const activeOrders = mesaPedidos.filter(o =>
      o.order_status === 'pending' ||
      o.order_status === 'preparing' ||
      o.order_status === 'served'
    );

    // Si tiene pedidos activos, no necesita limpieza (está ocupada)
    if (activeOrders.length > 0) return false;

    const paidOrders = mesaPedidos.filter(o => o.order_status === 'paid');

    // Si no hay pedidos pagados y no está en estado 'por_limpiar', no necesita limpieza
    if (paidOrders.length === 0) return false;

    // Verificar si el último pedido pagado fue hace menos de 30 minutos
    const lastPaid = paidOrders.sort((a, b) =>
      new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    )[0];

    if (lastPaid) {
      const paidTime = new Date(lastPaid.updatedAt || lastPaid.createdAt);
      const minutesSincePaid = (Date.now() - paidTime.getTime()) / (1000 * 60);
      return minutesSincePaid < 30;
    }

    return false;
  };

  useEffect(() => {
    const cached = cachedViewsRef.current.active ?? { pedidos: [], cuentas: [] };
    const nextPedidos = Array.isArray(cached.pedidos) ? [...cached.pedidos] : [];
    const nextCuentas = Array.isArray(cached.cuentas) ? [...cached.cuentas] : [];
    pedidosRef.current = nextPedidos;
    setPedidos(nextPedidos);
    setCuentas(nextCuentas);
    fetchPedidos();
    fetchMesas();
    fetchOpenSessions();
    const interval = setInterval(() => {
      fetchPedidos();
      fetchMesas();
      fetchOpenSessions();
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // marcar que ya hubo al menos una carga
  useEffect(() => { hasLoadedRef.current = true; }, []);

  // ---- acciones ----
  const putEstado = async (pedido, estado) => {
    const id = typeof pedido === 'object' ? pedido?.id : pedido;
    const itemIds =
      typeof pedido === 'object'
        ? (pedido?.items || []).map((it) => it?.id).filter(Boolean)
        : [];

    if (id == null) throw new Error('Pedido sin id');

    try {
      await api.patch(`/pedidos/${id}`, { data: { order_status: estado } });
    } catch (err) {
      if (err?.response?.status === 405) {
        const data = { order_status: estado };
        if (itemIds.length > 0) data.items = itemIds;
        await api.put(`/pedidos/${id}`, { data });
        return;
      }
      throw err;
    }
  };

  const refreshItemsDe = async (orderId) => {
    try {
      const items = await fetchItemsDePedido(orderId);
      if (items?.length) {
        setPedidos((prev) => {
          const next = prev.map((p) => (p.id === orderId ? { ...p, items } : p));
          pedidosRef.current = next;
          updateCachedView(next);
          return next;
        });
      }
    } catch { }
  };

  // Marcar como atendidas todas las llamadas de mozo / solicitudes del sistema de una mesa
  const marcarLlamadasAtendidas = async (mesa) => {
    const systemPedidos = mesa?.systemPedidos || [];
    if (!systemPedidos.length) return;

    try {
      await Promise.all(systemPedidos.map((p) => putEstado(p, 'paid')));
      setSnack({
        open: true,
        msg: 'Llamada atendida. La mesa volverá a su estado normal en unos instantes.',
        severity: 'success',
      });
      // Refrescar pedidos para que desaparezca el estado de llamada
      fetchPedidos();
      // Limpiar las llamadas del estado local del diálogo
      setTableDetailDialog((prev) => ({
        ...prev,
        mesa: prev.mesa
          ? { ...prev.mesa, systemPedidos: [] }
          : prev.mesa,
      }));
    } catch (err) {
      console.error('Error al marcar llamadas atendidas:', err?.response?.data || err);
      setSnack({
        open: true,
        msg: 'No se pudo marcar la llamada como atendida. Intentá de nuevo.',
        severity: 'error',
      });
    }
  };

  const marcarComoRecibido = async (pedido) => {
    try {
      setPedidos((prev) => {
        const next = prev.map((p) =>
          keyOf(p) === keyOf(pedido) ? { ...p, order_status: 'preparing' } : p
        );
        pedidosRef.current = next;
        updateCachedView(next);
        return next;
      });
      triggerFlash(pedido.documentId);
      await putEstado(pedido, 'preparing');
      await refreshItemsDe(pedido.id);
    } catch (err) {
      console.error('Error al marcar como Recibido:', err?.response?.data || err);
      setError('No se pudo actualizar el pedido.');
      setPedidos((prev) => {
        const next = prev.map((p) =>
          keyOf(p) === keyOf(pedido) ? { ...p, order_status: 'pending' } : p
        );
        pedidosRef.current = next;
        updateCachedView(next);
        return next;
      });
    }
  };

  const marcarComoServido = async (pedido, staffNotes = '') => {
    try {
      triggerFlash(pedido.documentId);
      servingIdsRef.current.add(pedido.id);
      setPedidos((prev) => {
        const next = prev.filter((p) => keyOf(p) !== keyOf(pedido));
        pedidosRef.current = next;
        return next;
      });

      // Actualizar el pedido con el estado y las notas del staff
      const updateData = { order_status: 'served' };
      if (staffNotes && staffNotes.trim()) {
        updateData.staffNotes = staffNotes.trim();
      }

      try {
        await api.patch(`/pedidos/${pedido.id}`, { data: updateData });
      } catch (patchErr) {
        // Si PATCH falla, intentar PUT
        if (patchErr?.response?.status === 405) {
          await api.put(`/pedidos/${pedido.id}`, { data: updateData });
        } else {
          throw patchErr;
        }
      }

      await fetchPedidos();
      setSnack({
        open: true,
        msg: staffNotes && staffNotes.trim()
          ? 'Pedido completado con observaciones ✅'
          : 'Pedido marcado como servido ✅',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error al marcar como servido:', err?.response?.data || err);
      setError('No se pudo actualizar el pedido.');
      setSnack({
        open: true,
        msg: 'Error al completar el pedido. Intentá de nuevo.',
        severity: 'error'
      });
      servingIdsRef.current.delete(pedido.id);
      setPedidos((prev) => {
        if (prev.some((p) => keyOf(p) === keyOf(pedido))) return prev;
        const next = [pedido, ...prev];
        pedidosRef.current = next;
        updateCachedView(next);
        return next;
      });
    }
  };

  const cancelarPedido = async (pedido, reason = '') => {
    try {
      // Reutilizar la lógica robusta de putEstado (maneja PATCH/PUT y el bug de 405)
      await putEstado(pedido, 'cancelled');

      // Guardar razón de cancelación si viene algo
      const trimmed = (reason || '').trim();
      if (trimmed) {
        try {
          await api.patch(`/pedidos/${pedido.id}`, {
            data: { cancellationReason: trimmed },
          });
        } catch (err) {
          // Si falla solo la razón, lo registramos pero no rompemos la cancelación
          console.warn('No se pudo guardar la razón de cancelación:', err?.response?.data || err);
        }
      }

      setSnack({ open: true, msg: 'Pedido cancelado ✅', severity: 'success' });
      await fetchPedidos();
    } catch (err) {
      console.error('Error al cancelar pedido:', err?.response?.data || err);
      setSnack({ open: true, msg: 'No se pudo cancelar el pedido ❌', severity: 'error' });
    }
  };

  const handleOpenPayDialog = (cuenta) => {
    setPayDialog({ open: true, cuenta, loading: false, discount: 0, discountType: 'percent', closeWithoutPayment: false });
  };

  const marcarCuentaComoPagada = async () => {
    const { cuenta, discount, discountType, closeWithoutPayment } = payDialog;
    if (!cuenta) return;

    setPayDialog((prev) => ({ ...prev, loading: true }));

    try {
      // Calcular total con descuento si aplica
      let totalFinal = cuenta.total;
      if (discount > 0 && !closeWithoutPayment) {
        if (discountType === 'percent') {
          totalFinal = cuenta.total * (1 - discount / 100);
        } else {
          totalFinal = Math.max(0, cuenta.total - discount);
        }
      }

      if (closeWithoutPayment) {
        // Cerrar sin cobrar (invitado)
        if (cuenta.mesaNumber != null) {
          const payload = { table: cuenta.mesaNumber, closeWithoutPayment: true };
          if (cuenta.mesaSesionId) payload.tableSessionId = cuenta.mesaSesionId;
          await closeAccount(slug, payload);
        } else {
          const pendientes = (cuenta.pedidos || []).filter((p) => p.order_status !== 'paid');
          await Promise.all(pendientes.map((pedido) =>
            api.patch(`/pedidos/${pedido.id}`, {
              data: {
                order_status: 'paid',
                payment_status: 'paid',
                closeWithoutPayment: true
              }
            })
          ));
        }
        setSnack({ open: true, msg: 'Cuenta cerrada sin cobro (Invitado) ✅', severity: 'success' });
      } else if (discount > 0) {
        // Aplicar descuento y pagar
        const pendientes = (cuenta.pedidos || []).filter((p) => p.order_status !== 'paid');
        await Promise.all(pendientes.map((pedido) => {
          const pedidoTotal = Number(pedido.total || 0);
          const pedidoDiscount = discountType === 'percent'
            ? pedidoTotal * (discount / 100)
            : (discount * pedidoTotal / cuenta.total);
          const pedidoFinal = Math.max(0, pedidoTotal - pedidoDiscount);

          return api.patch(`/pedidos/${pedido.id}`, {
            data: {
              order_status: 'paid',
              payment_status: 'paid',
              total: pedidoFinal,
              discount: discount,
              discountType: discountType
            }
          });
        }));
        setSnack({ open: true, msg: `Cuenta pagada con ${discount}${discountType === 'percent' ? '%' : '$'} de descuento ✅`, severity: 'success' });
      } else {
        // Pago normal
        if (cuenta.mesaNumber != null) {
          const payload = { table: cuenta.mesaNumber };
          if (cuenta.mesaSesionId) payload.tableSessionId = cuenta.mesaSesionId;
          await closeAccount(slug, payload);
        } else {
          const pendientes = (cuenta.pedidos || []).filter((p) => p.order_status !== 'paid');
          await Promise.all(pendientes.map((pedido) => putEstado(pedido, 'paid')));
        }
        setSnack({ open: true, msg: 'Cuenta marcada como pagada ✅', severity: 'success' });
      }

      handleClosePayDialog();

      // Log para debugging
      console.log(`[Mostrador] Cuenta pagada para mesa ${cuenta.mesaNumber}. Refrescando datos...`);

      // Esperar un momento para que el backend procese el cambio completamente
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refrescar TODO en paralelo para obtener el estado más reciente
      await Promise.all([
        fetchPedidos(),      // Actualizar pedidos (deberían estar todos 'paid' ahora)
        fetchOpenSessions(), // Actualizar sesiones (deberían estar todas 'closed' ahora)
        fetchMesas()         // Actualizar mesas (debería estar 'disponible' ahora)
      ]);

      // Verificar que la mesa se actualizó - hacer una segunda verificación después de un momento
      await new Promise(resolve => setTimeout(resolve, 500));
      const mesasActualizadas = await fetchTables(slug);
      const mesaPagada = mesasActualizadas.find(m => m.number === cuenta.mesaNumber);
      console.log(`[Mostrador] ✅ Mesa ${cuenta.mesaNumber} después del pago - Estado: ${mesaPagada?.status || 'N/A'}`);

      if (mesaPagada?.status !== 'disponible') {
        console.warn(`[Mostrador] ⚠️ ADVERTENCIA: Mesa ${cuenta.mesaNumber} no está en estado 'disponible' después del pago. Estado actual: ${mesaPagada?.status}`);
        // Forzar otro refresh después de 2 segundos más
        setTimeout(async () => {
          await fetchMesas();
          console.log(`[Mostrador] Re-refresh de mesas después de 2 segundos adicionales`);
        }, 2000);
      } else {
        // Forzar actualización del componente de mesas
        await fetchMesas();
      }
    } catch (err) {
      console.error('Error al procesar cuenta:', err?.response?.data || err);
      setSnack({
        open: true,
        msg: 'No se pudo procesar la cuenta ❌',
        severity: 'error',
      });
      setPayDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleClosePayDialog = () => {
    setPayDialog({ open: false, cuenta: null, loading: false, discount: 0, discountType: 'percent', closeWithoutPayment: false });
  };

  // Función para detectar si es un pedido del sistema (debe estar antes de los memos)
  const isSystemOrder = (pedido) => {
    // Check items
    const items = pedido.items || [];
    const hasSystemItem = items.some(item => {
      const prodName = (item?.product?.name || item?.name || '').toUpperCase();
      return prodName.includes('LLAMAR MOZO') || prodName.includes('SOLICITUD DE COBRO') || prodName.includes('💳');
    });

    if (hasSystemItem) return true;

    // Check customer notes for payment requests
    const notes = (pedido.customerNotes || '').toUpperCase();
    const systemNoteKeywords = [
      'SOLICITA COBRAR',
      'SOLICITUD DE COBRO',
      'CUENTA',
      'PAGAR',
      'SOLICITUD DE ASISTENCIA',
      'LLAMAR MOZO',
      'MOZO',
    ];
    if (systemNoteKeywords.some((kw) => notes.includes(kw))) return true;

    return false;
  };

  // ---- memos de filtro ----
  const pedidosFiltrados = useMemo(
    () => pedidos.filter(pedidoMatchesMesaPartial),
    [pedidos, mesaTokens]
  );
  const pedidosPendientes = useMemo(
    () => pedidosFiltrados.filter((p) => p.order_status === 'pending' && !isSystemOrder(p)),
    [pedidosFiltrados]
  );
  const pedidosEnCocina = useMemo(
    () => pedidosFiltrados.filter((p) => p.order_status === 'preparing' && !isSystemOrder(p)),
    [pedidosFiltrados]
  );
  const pedidosSistema = useMemo(
    () => pedidosFiltrados.filter((p) => isSystemOrder(p) && isActive(p.order_status)),
    [pedidosFiltrados]
  );
  const cuentasFiltradas = useMemo(
    () => cuentas.filter(cuentaMatchesMesaPartial),
    [cuentas, mesaTokens]
  );
  const noResultsPedidos =
    !error && pedidos.length > 0 && pedidosFiltrados.length === 0 && mesaTokens.length > 0;
  const noResultsCuentas =
    cuentas.length > 0 && cuentasFiltradas.length === 0 && mesaTokens.length > 0;

  // Función para formatear hora
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Función para obtener color consistente por número de mesa
  const getMesaColor = (mesaNumber) => {
    if (mesaNumber == null) return 'primary';

    // Paleta de colores vibrantes y distinguibles
    const colors = [
      '#1976d2', // azul
      '#d32f2f', // rojo
      '#388e3c', // verde
      '#f57c00', // naranja
      '#7b1fa2', // púrpura
      '#0288d1', // azul claro
      '#c2185b', // rosa
      '#00796b', // verde azulado
      '#e64a19', // rojo oscuro
      '#5d4037', // marrón
      '#455a64', // azul gris
      '#fbc02d', // amarillo
      '#303f9f', // índigo
      '#c62828', // rojo oscuro
      '#2e7d32', // verde oscuro
      '#e91e63', // rosa brillante
      '#00acc1', // cian
      '#8e24aa', // púrpura oscuro
      '#f4511e', // naranja oscuro
      '#0097a7', // turquesa
    ];

    // Usar el número de mesa como índice para obtener un color consistente
    const index = Number(mesaNumber) % colors.length;
    return colors[index];
  };

  const getSystemOrderType = (pedido) => {
    const items = pedido.items || [];
    const hasWaiterCall = items.some(item => {
      const prodName = item?.product?.name || item?.name || '';
      return prodName.includes('LLAMAR MOZO');
    });
    const hasPayRequest = items.some(item => {
      const prodName = item?.product?.name || item?.name || '';
      return prodName.includes('SOLICITUD DE COBRO');
    });

    if (hasWaiterCall) return 'waiter-call';
    if (hasPayRequest) return 'pay-request';
    return null;
  };

  // Función para manejar dismiss de pedidos del sistema
  const handleDismissSystemOrder = async (pedido) => {
    try {
      triggerFlash(pedido.documentId);
      // Marcar como servido para sacarlo de la vista activa
      await putEstado(pedido, 'served');
      await fetchPedidos();
      setSnack({
        open: true,
        msg: 'Solicitud atendida ✅',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error al marcar como atendido:', err);
      setSnack({
        open: true,
        msg: 'No se pudo marcar como atendido',
        severity: 'error'
      });
    }
  };

  // Función para renderizar una tarjeta de pedido del sistema
  const renderSystemOrderCard = (pedido) => {
    const { id, documentId, customerNotes, items = [], createdAt } = pedido;
    const mesaNumero = pedido.mesa_sesion?.mesa?.number;
    const flashing = flashIds.has(documentId);
    const systemType = getSystemOrderType(pedido);

    const isWaiterCall = systemType === 'waiter-call';
    const isPay = systemType === 'pay-request';

    // Extraer info del método de pago si es solicitud de cobro
    let paymentMethod = '';
    if (isPay) {
      const payItem = items.find(item => {
        const prodName = item?.product?.name || item?.name || '';
        return prodName.includes('SOLICITUD DE COBRO');
      });
      paymentMethod = payItem?.notes || customerNotes || '';
    }

    return (
      <Card
        key={documentId || id}
        sx={{
          mb: 1.25,
          bgcolor: flashing
            ? (isWaiterCall ? '#fff3cd' : '#d1ecf1')
            : (isWaiterCall ? '#fff8e1' : '#e3f2fd'),
          transition: 'all 0.2s ease-in-out',
          boxShadow: flashing ? 6 : 2,
          border: '2px solid',
          borderColor: flashing
            ? (isWaiterCall ? '#ffc107' : '#17a2b8')
            : (isWaiterCall ? '#ffa726' : '#29b6f6'),
          borderRadius: 2,
          cursor: 'pointer',
          '&:hover': {
            boxShadow: 8,
            transform: 'translateY(-2px)',
          },
        }}
      >
        <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Chip
              label={`Mesa ${mesaNumero ?? 's/n'}`}
              size="small"
              sx={{
                fontWeight: 600,
                bgcolor: getMesaColor(mesaNumero),
                color: 'white',
                fontSize: '0.75rem',
                height: 22,
              }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              {formatTime(createdAt)}
            </Typography>
          </Box>

          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 1,
            p: 1,
            bgcolor: 'white',
            borderRadius: 1,
            border: '1.5px solid',
            borderColor: isWaiterCall ? '#ff9800' : '#0288d1',
          }}>
            <Typography
              variant="h6"
              sx={{
                fontSize: '1rem',
                fontWeight: 700,
                color: isWaiterCall ? '#f57c00' : '#0277bd',
                flex: 1,
              }}
            >
              {isWaiterCall ? '🔔 LLAMAR MOZO' : '💳 SOLICITUD DE COBRO'}
            </Typography>
          </Box>

          {isPay && paymentMethod && (
            <Typography
              variant="body2"
              sx={{
                mb: 1,
                fontSize: '0.8125rem',
                color: 'text.secondary',
                fontStyle: 'italic',
              }}
            >
              {paymentMethod}
            </Typography>
          )}

          {customerNotes && !isPay && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mb: 0.75,
                p: 0.5,
                bgcolor: '#fff3cd',
                borderRadius: 1,
                border: '1.5px solid',
                borderColor: '#ff9800',
              }}
            >
              <WarningIcon sx={{ fontSize: '0.875rem', color: '#f57c00' }} />
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.75rem',
                  color: '#e65100',
                  fontWeight: 600,
                  flex: 1,
                }}
              >
                {customerNotes}
              </Typography>
            </Box>
          )}

          <Button
            variant="contained"
            color={isWaiterCall ? 'warning' : 'info'}
            onClick={() => handleDismissSystemOrder(pedido)}
            fullWidth
            size="small"
            sx={{
              mt: 0.75,
              borderRadius: 1,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8125rem',
              py: 0.5,
            }}
          >
            Atendido
          </Button>
        </CardContent>
      </Card>
    );
  };

  // Función para renderizar una tarjeta de pedido
  const renderPedidoCard = (pedido, isHistory = false) => {
    // Si es un pedido del sistema, usar el render especial
    if (isSystemOrder(pedido)) {
      return renderSystemOrderCard(pedido);
    }

    const { id, documentId, order_status, customerNotes, items = [], total, createdAt } = pedido;
    const mesaNumero = pedido.mesa_sesion?.mesa?.number;
    const flashing = flashIds.has(documentId);

    return (
      <Card
        key={documentId || id}
        sx={{
          mb: 1.25,
          bgcolor: flashing ? 'warning.light' : 'background.paper',
          transition: 'all 0.2s ease-in-out',
          boxShadow: flashing ? 6 : 1,
          border: flashing ? '2px solid rgba(255,193,7,0.6)' : '1px solid',
          borderColor: flashing ? 'warning.main' : 'divider',
          borderRadius: 2,
          cursor: 'pointer',
          '&:hover': {
            boxShadow: 8,
            bgcolor: flashing ? 'warning.light' : 'rgba(25, 118, 210, 0.04)',
            transform: 'translateY(-2px)',
            borderColor: 'primary.light',
          },
        }}
      >
        <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Chip
              label={`Mesa ${mesaNumero ?? 's/n'}`}
              size="small"
              sx={{
                fontWeight: 600,
                bgcolor: getMesaColor(mesaNumero),
                color: 'white',
                fontSize: '0.75rem',
                height: 22,
                '&:hover': {
                  bgcolor: getMesaColor(mesaNumero),
                  opacity: 0.9,
                },
              }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              {formatTime(createdAt)}
            </Typography>
          </Box>

          {customerNotes && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mb: 0.75,
                p: 0.5,
                bgcolor: '#fff3cd',
                borderRadius: 1,
                border: '1.5px solid',
                borderColor: '#ff9800',
                boxShadow: '0 1px 3px rgba(255, 152, 0, 0.2)',
              }}
            >
              <WarningIcon sx={{ fontSize: '0.875rem', color: '#f57c00' }} />
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.75rem',
                  color: '#e65100',
                  fontWeight: 600,
                  flex: 1,
                }}
              >
                {customerNotes}
              </Typography>
            </Box>
          )}

          {items.length > 0 ? (
            <>
              {items.slice(0, 3).map((item) => {
                const prod = item?.product;
                return (
                  <Typography key={item.id} variant="body2" sx={{ mb: 0.25, fontSize: '0.8125rem' }}>
                    {item.quantity}x {prod?.name || 'Producto sin datos'}
                  </Typography>
                );
              })}
              {items.length > 3 && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                  +{items.length - 3} más...
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
              Sin items detallados
            </Typography>
          )}

          <Typography
            variant="subtitle2"
            sx={{ textAlign: 'right', mt: 1, mb: 0.75, fontWeight: 600, fontSize: '0.9375rem' }}
          >
            {money(total)}
          </Typography>

          {isHistory ? (
            // En historial: solo botón Ver
            <Button
              variant="outlined"
              size="small"
              startIcon={<VisibilityIcon />}
              onClick={(e) => {
                e.stopPropagation();
                setOrderDetailDialog({ open: true, pedido });
              }}
              fullWidth
              sx={{ mt: 0.75, textTransform: 'none', fontSize: '0.75rem' }}
            >
              Ver detalles
            </Button>
          ) : (
            // En vista activa: botones de acción
            <>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<VisibilityIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOrderDetailDialog({ open: true, pedido });
                  }}
                  sx={{ flex: 1, textTransform: 'none', fontSize: '0.75rem' }}
                >
                  Ver
                </Button>
                {(order_status === 'pending' || order_status === 'preparing') && (
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<CancelIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCancelOrderDialog({ open: true, pedido, reason: '' });
                    }}
                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                  >
                    Cancelar
                  </Button>
                )}
              </Box>

              <Button
                variant={order_status === 'pending' ? 'contained' : 'outlined'}
                color={order_status === 'pending' ? 'primary' : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (order_status === 'pending') {
                    marcarComoRecibido(pedido);
                  } else if (order_status === 'preparing') {
                    setCompleteOrderDialog({ open: true, pedido, staffNotes: '' });
                  }
                }}
                fullWidth
                size="small"
                sx={{
                  mt: 0.5,
                  borderRadius: 1,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  py: 0.5,
                  ...(order_status === 'preparing' && {
                    bgcolor: 'white',
                    color: '#f57c00',
                    borderColor: '#f57c00',
                    borderWidth: 1.5,
                    borderStyle: 'solid',
                    '&:hover': {
                      bgcolor: 'rgba(245, 124, 0, 0.08)',
                      borderColor: '#f57c00',
                      borderWidth: 1.5,
                    },
                  }),
                }}
              >
                {order_status === 'pending' ? 'Cocinar' : 'Completado'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  // ---- UI ----
  return (
    <Box
      sx={{
        zoom: 0.9,
        p: { xs: 2, md: 3 },
      }}
    >
      {/* Encabezado minimal + barrita */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography
            component="h1"
            sx={(theme) => ({
              fontSize: { xs: 26, sm: 32 },
              fontWeight: 600,
              lineHeight: 1.2,
              letterSpacing: 0.5,
              fontFamily: theme.typography.fontFamily,
              color: 'text.primary',
              mb: 0.5,
            })}
          >
            Mostrador — {slug?.toUpperCase?.()}
          </Typography>
          <Box sx={{ height: 2, width: 120, bgcolor: 'divider', borderRadius: 1, position: 'relative' }}>
            <Box
              sx={(theme) => ({
                position: 'absolute',
                left: 0,
                top: -1,
                width: 44,
                height: 4,
                borderRadius: 999,
                backgroundColor: theme.palette.primary.main,
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
              })}
            />
          </Box>
        </Box>

        <TextField
          size="small"
          label="Buscar por Nº de mesa"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 320 }, borderRadius: 2 }}
          InputProps={{
            startAdornment: <InputAdornment position="start">🔎</InputAdornment>,
            endAdornment: searchQuery ? (
              <InputAdornment
                position="end"
                sx={{ cursor: 'pointer' }}
                onClick={() => setSearchQuery('')}
                title="Limpiar búsqueda"
              >
                ×
              </InputAdornment>
            ) : null,
          }}
          placeholder="Ej: 3  |  12  |  12 33"
        />

        <Button
          variant="outlined"
          startIcon={<HistoryIcon />}
          onClick={() => {
            setShowHistoryDrawer(true);
            fetchFullHistory();
          }}
          sx={{ borderRadius: 2, px: 2.5 }}
        >
          Historial completo
        </Button>

        <Button
          variant="outlined"
          color="secondary"
          startIcon={<CleaningServicesIcon />}
          onClick={handleCleanupOldSessions}
          sx={{ borderRadius: 2, px: 2.5 }}
          title="Limpiar sesiones antiguas (más de 7 días abiertas o 30 días cerradas)"
        >
          Limpiar sesiones
        </Button>
      </Box>

      {error && <Typography color="error">{error}</Typography>}

      {/* Vista activa - siempre visible */}
      <>
        {/* Sección superior: Pedidos activos */}
        <Grid container spacing={1} sx={{ mb: 3 }}>
          {/* Columna 1: Pedidos Pendientes (primera mitad) */}
          <Grid item xs={12} md={2.25}>
            <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Pendientes ({pedidosPendientes.length})
              </Typography>
            </Box>
            {pedidosPendientes.length === 0 && !noResultsPedidos && (
              <Typography variant="body2" color="text.secondary">
                No hay pedidos pendientes
              </Typography>
            )}
            {noResultsPedidos && pedidosPendientes.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                No hay pedidos pendientes para las mesas buscadas.
              </Typography>
            )}
            <Box>
              {pedidosPendientes
                .filter((_, index) => index % 2 === 0)
                .map((pedido) => renderPedidoCard(pedido))}
            </Box>
          </Grid>

          {/* Columna 2: Pedidos Pendientes (segunda mitad) */}
          <Grid item xs={12} md={2.25}>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, visibility: 'hidden' }}>
              <AccessTimeIcon sx={{ fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Pendientes ({pedidosPendientes.filter((_, index) => index % 2 === 1).length})
              </Typography>
            </Box>
            <Box>
              {pedidosPendientes
                .filter((_, index) => index % 2 === 1)
                .map((pedido) => renderPedidoCard(pedido))}
            </Box>
          </Grid>


          {/* Columna 3: Pedidos en Cocina (primera mitad) */}
          <Grid item xs={12} md={3}>
            <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <RestaurantIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Cocina ({pedidosEnCocina.length})
              </Typography>
            </Box>
            {pedidosEnCocina.length === 0 && !noResultsPedidos && (
              <Typography variant="body2" color="text.secondary">
                No hay pedidos en cocina
              </Typography>
            )}
            {noResultsPedidos && pedidosEnCocina.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                No hay pedidos en cocina para las mesas buscadas.
              </Typography>
            )}
            <Box>
              {pedidosEnCocina
                .filter((_, index) => index % 2 === 0)
                .map((pedido) => renderPedidoCard(pedido))}
            </Box>
          </Grid>

          {/* Columna 4: Pedidos en Cocina (segunda mitad) */}
          <Grid item xs={12} md={3}>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, visibility: 'hidden' }}>
              <RestaurantIcon sx={{ fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Cocina ({pedidosEnCocina.length})
              </Typography>
            </Box>
            <Box>
              {pedidosEnCocina
                .filter((_, index) => index % 2 === 1)
                .map((pedido) => renderPedidoCard(pedido))}
            </Box>
          </Grid>

        </Grid>

        {/* División visual */}
        <Divider sx={{ my: 3, borderWidth: 2 }} />

        {/* Sección inferior: Grid de mesas */}
        <Box sx={{ mt: 3 }}>
          <TablesStatusGridEnhanced
            tables={mesas}
            // CRÍTICO: Usar TODOS los pedidos sin pagar (incluyendo "served") para determinar estado de mesas
            // Los pedidos "served" también hacen que la mesa esté ocupada hasta que se paguen
            orders={todosPedidosSinPagar}
            systemOrders={pedidosSistema}
            openSessions={openSessions}
            onTableClick={(table) => {
              // Abrir modal con detalles de la mesa
              // Solo mostrar en el detalle los pedidos "reales" (no de sistema)
              const mesaPedidos = pedidos.filter(p =>
                !isSystemOrder(p) &&
                p.mesa_sesion?.mesa?.number === table.number
              );
              // Y agrupar también las llamadas del sistema para poder limpiarlas
              const mesaSystemPedidos = pedidos.filter(p =>
                isSystemOrder(p) &&
                p.mesa_sesion?.mesa?.number === table.number
              );
              const mesaCuenta = cuentas.find(c => c.mesaNumber === table.number);
              setTableDetailDialog({
                open: true,
                mesa: {
                  ...table,
                  pedidos: mesaPedidos,
                  cuenta: mesaCuenta,
                  systemPedidos: mesaSystemPedidos,
                }
              });
            }}
          />
        </Box>

      </>

      {/* Drawer de historial completo */}
      <Drawer
        anchor="right"
        open={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        PaperProps={{
          sx: { width: { xs: '100%', sm: '80%', md: '60%' }, maxWidth: 900 }
        }}
      >
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Panel de Control - {slug?.toUpperCase()}
            </Typography>
            <Button color="error" variant="outlined" size="small" onClick={handleResetSystem} sx={{ mr: 2 }}>
              RESET SYSTEM
            </Button>
            <IconButton onClick={() => setShowHistoryDrawer(false)}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant={historyTab === 0 ? 'contained' : 'outlined'}
              startIcon={<RestaurantIcon />}
              onClick={() => setHistoryTab(0)}
              sx={{ textTransform: 'none' }}
            >
              Pedidos ({historyPedidos.length})
            </Button>
            <Button
              variant={historyTab === 1 ? 'contained' : 'outlined'}
              startIcon={<AccountBalanceWalletIcon />}
              onClick={() => setHistoryTab(1)}
              sx={{ textTransform: 'none' }}
            >
              Cuentas ({historyCuentas.length})
            </Button>
          </Box>

          {historyTab === 0 ? (
            <Grid container spacing={2}>
              {historyPedidos.map((pedido) => (
                <Grid item key={pedido.documentId || pedido.id} xs={12} sm={6} md={4}>
                  {renderPedidoCard(pedido, true)}
                </Grid>
              ))}
            </Grid>
          ) : (
            <Grid container spacing={2}>
              {historyCuentas.map((c) => {
                const fechaHora = new Date(c.lastUpdated);
                const fecha = fechaHora.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const hora = fechaHora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

                return (
                  <Grid item key={c.groupKey} xs={12} sm={6} md={4}>
                    <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
                      <CardContent sx={{ p: 2 }}>
                        <Chip
                          label={`Mesa ${c.mesaNumber ?? 's/n'}`}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            mb: 1.5,
                            bgcolor: getMesaColor(c.mesaNumber),
                            color: 'white'
                          }}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          {fecha}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                          {hora}
                        </Typography>
                        <Divider sx={{ my: 1.5 }} />
                        <Typography variant="h6" sx={{ textAlign: 'right', fontWeight: 700, mb: 2 }}>
                          Total: {money(c.total)}
                        </Typography>
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<VisibilityIcon />}
                          onClick={() => setAccountDetailDialog({ open: true, cuenta: c })}
                          sx={{ textTransform: 'none' }}
                        >
                          Ver detalles
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Box>
      </Drawer>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
      {/* Dialog de pago mejorado */}
      <Dialog
        open={payDialog.open}
        onClose={() => (!payDialog.loading ? handleClosePayDialog() : null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalanceWalletIcon />
            Cerrar cuenta - Mesa {payDialog.cuenta?.mesaNumber ?? 's/n'}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Total: {money(payDialog.cuenta?.total || 0)}
            </Typography>
            {payDialog.cuenta?.pedidos && (
              <List dense>
                {payDialog.cuenta.pedidos.map((p) => (
                  <ListItem key={p.id} sx={{ px: 0 }}>
                    <Typography variant="body2">
                      Pedido {p.id} — {money(p.total)}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Opción de cierre</InputLabel>
            <Select
              value={payDialog.closeWithoutPayment ? 'free' : 'paid'}
              onChange={(e) => setPayDialog(prev => ({ ...prev, closeWithoutPayment: e.target.value === 'free' }))}
              disabled={payDialog.loading}
            >
              <MenuItem value="paid">Pagar cuenta</MenuItem>
              <MenuItem value="free">Cerrar sin cobrar (Invitado)</MenuItem>
            </Select>
          </FormControl>

          {!payDialog.closeWithoutPayment && (
            <>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel>Tipo de descuento</InputLabel>
                  <Select
                    value={payDialog.discountType}
                    onChange={(e) => setPayDialog(prev => ({ ...prev, discountType: e.target.value, discount: 0 }))}
                    disabled={payDialog.loading}
                  >
                    <MenuItem value="percent">Porcentaje (%)</MenuItem>
                    <MenuItem value="fixed">Monto fijo ($)</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label={payDialog.discountType === 'percent' ? 'Descuento %' : 'Descuento $'}
                  type="number"
                  value={payDialog.discount}
                  onChange={(e) => setPayDialog(prev => ({ ...prev, discount: Number(e.target.value) || 0 }))}
                  disabled={payDialog.loading}
                  sx={{ flex: 1 }}
                  inputProps={{ min: 0, max: payDialog.discountType === 'percent' ? 100 : payDialog.cuenta?.total }}
                />
              </Box>
              {payDialog.discount > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Total con descuento: {money(
                    payDialog.discountType === 'percent'
                      ? payDialog.cuenta?.total * (1 - payDialog.discount / 100)
                      : Math.max(0, payDialog.cuenta?.total - payDialog.discount)
                  )}
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePayDialog} disabled={payDialog.loading}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color={payDialog.closeWithoutPayment ? 'warning' : 'success'}
            onClick={marcarCuentaComoPagada}
            disabled={payDialog.loading}
            startIcon={payDialog.closeWithoutPayment ? <FreeBreakfastIcon /> : <LocalOfferIcon />}
          >
            {payDialog.loading ? 'Procesando...' : payDialog.closeWithoutPayment ? 'Cerrar sin cobrar' : 'Confirmar pago'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de detalles de pedido */}
      <Dialog
        open={orderDetailDialog.open}
        onClose={() => setOrderDetailDialog({ open: false, pedido: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RestaurantIcon />
              Pedido #{orderDetailDialog.pedido?.id}
            </Box>
            <Chip
              label={`Mesa ${orderDetailDialog.pedido?.mesa_sesion?.mesa?.number ?? 's/n'}`}
              size="small"
              sx={{ bgcolor: getMesaColor(orderDetailDialog.pedido?.mesa_sesion?.mesa?.number), color: 'white' }}
            />
          </Box>
        </DialogTitle>
        <DialogContent>
          {orderDetailDialog.pedido && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {new Date(orderDetailDialog.pedido.createdAt).toLocaleString('es-AR')}
              </Typography>

              {orderDetailDialog.pedido.customerNotes && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Notas del cliente:</Typography>
                  {orderDetailDialog.pedido.customerNotes}
                </Alert>
              )}

              {orderDetailDialog.pedido.staffNotes && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Observaciones del staff:</Typography>
                  {orderDetailDialog.pedido.staffNotes}
                </Alert>
              )}

              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Items del pedido:
              </Typography>
              <List>
                {orderDetailDialog.pedido.items?.map((item) => {
                  const prod = item?.product;
                  return (
                    <ListItem key={item.id} sx={{ px: 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <Typography variant="body2">
                          {item.quantity}x {prod?.name || 'Producto sin datos'}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {money(item.totalPrice || item.UnitPrice * item.quantity)}
                        </Typography>
                      </Box>
                      {item.notes && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2, fontStyle: 'italic' }}>
                          Nota: {item.notes}
                        </Typography>
                      )}
                    </ListItem>
                  );
                })}
              </List>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Total:</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {money(orderDetailDialog.pedido.total)}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderDetailDialog({ open: false, pedido: null })}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para completar pedido con notas */}
      <Dialog
        open={completeOrderDialog.open}
        onClose={() => setCompleteOrderDialog({ open: false, pedido: null, staffNotes: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Completar pedido</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            ¿Deseas agregar alguna observación al completar este pedido? (opcional)
          </DialogContentText>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Observaciones del staff"
            placeholder="Ej: Sin lechuga, sin cebolla, etc."
            value={completeOrderDialog.staffNotes}
            onChange={(e) => setCompleteOrderDialog(prev => ({ ...prev, staffNotes: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteOrderDialog({ open: false, pedido: null, staffNotes: '' })}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              marcarComoServido(completeOrderDialog.pedido, completeOrderDialog.staffNotes);
              setCompleteOrderDialog({ open: false, pedido: null, staffNotes: '' });
            }}
          >
            Completar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para cancelar pedido */}
      <Dialog
        open={cancelOrderDialog.open}
        onClose={() => setCancelOrderDialog({ open: false, pedido: null, reason: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main' }}>Cancelar pedido</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            ¿Estás seguro que deseas cancelar este pedido? Esta acción no se puede deshacer.
          </DialogContentText>
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Razón de cancelación (opcional)"
            placeholder="Ej: Cliente se fue, error en pedido, etc."
            value={cancelOrderDialog.reason}
            onChange={(e) => setCancelOrderDialog(prev => ({ ...prev, reason: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOrderDialog({ open: false, pedido: null, reason: '' })}>
            No cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              cancelarPedido(cancelOrderDialog.pedido, cancelOrderDialog.reason);
              setCancelOrderDialog({ open: false, pedido: null, reason: '' });
            }}
          >
            Confirmar cancelación
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de detalles de mesa */}
      <Drawer
        anchor="right"
        open={tableDetailDialog.open}
        onClose={() => setTableDetailDialog({ open: false, mesa: null })}
        PaperProps={{
          sx: { width: { xs: '100%', sm: '80%', md: '50%' }, maxWidth: 600 }
        }}
      >
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TableRestaurantIcon />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Mesa {tableDetailDialog.mesa?.number ?? 's/n'}
              </Typography>
            </Box>
            <IconButton onClick={() => setTableDetailDialog({ open: false, mesa: null })}>
              <CloseIcon />
            </IconButton>
          </Box>

          {tableDetailDialog.mesa && (
            <>
              {/* Llamadas del sistema (mozo / pago / asistencia) */}
              {tableDetailDialog.mesa.systemPedidos && tableDetailDialog.mesa.systemPedidos.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    Llamadas de la mesa
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Esta mesa hizo una llamada al mozo o una solicitud especial. Marcala como atendida cuando ya la hayas gestionado.
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {tableDetailDialog.mesa.systemPedidos.map((pedido) => (
                      <Card key={pedido.id}>
                        <CardContent sx={{ p: 1.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              Llamada #{pedido.id}
                            </Typography>
                            <Chip
                              label="Atención requerida"
                              size="small"
                              color="error"
                            />
                          </Box>
                          {pedido.customerNotes && (
                            <Typography variant="body2" color="text.secondary">
                              {pedido.customerNotes}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                  <Button
                    variant="contained"
                    color="error"
                    fullWidth
                    sx={{ mt: 2 }}
                    onClick={() => marcarLlamadasAtendidas(tableDetailDialog.mesa)}
                  >
                    Marcar llamadas como atendidas
                  </Button>
                  <Divider sx={{ my: 3 }} />
                </Box>
              )}

              {/* Pedidos activos de la mesa */}
              {tableDetailDialog.mesa.pedidos && tableDetailDialog.mesa.pedidos.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Pedidos activos ({tableDetailDialog.mesa.pedidos.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {tableDetailDialog.mesa.pedidos.map((pedido) => (
                      <Card key={pedido.id} sx={{ cursor: 'pointer' }} onClick={() => {
                        setOrderDetailDialog({ open: true, pedido });
                        setTableDetailDialog({ open: false, mesa: null });
                      }}>
                        <CardContent sx={{ p: 1.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              Pedido #{pedido.id}
                            </Typography>
                            <Chip
                              label={pedido.order_status === 'pending' ? 'Pendiente' : pedido.order_status === 'preparing' ? 'En cocina' : 'Servido'}
                              size="small"
                              color={pedido.order_status === 'pending' ? 'warning' : pedido.order_status === 'preparing' ? 'info' : 'success'}
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {pedido.items?.length || 0} items
                          </Typography>
                          <Typography variant="h6" sx={{ textAlign: 'right', fontWeight: 700 }}>
                            {money(pedido.total)}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Cuenta de la mesa */}
              {tableDetailDialog.mesa.cuenta && (
                <Box sx={{ mb: 3 }}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Cuenta
                  </Typography>
                  <Card sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                    <CardContent>
                      <List>
                        {tableDetailDialog.mesa.cuenta.pedidos.map((p) => (
                          <ListItem key={p.id} sx={{ px: 0, py: 0.5 }}>
                            <Typography variant="body2" sx={{ flex: 1 }}>
                              Pedido {p.id}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {money(p.total)}
                            </Typography>
                          </ListItem>
                        ))}
                      </List>
                      <Divider sx={{ my: 1, bgcolor: 'rgba(255,255,255,0.3)' }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          Total:
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {money(tableDetailDialog.mesa.cuenta.total)}
                        </Typography>
                      </Box>
                      {tableDetailDialog.mesa.cuenta.hasUnpaid && (
                        <Button
                          variant="contained"
                          color="success"
                          fullWidth
                          onClick={() => {
                            handleOpenPayDialog(tableDetailDialog.mesa.cuenta);
                            setTableDetailDialog({ open: false, mesa: null });
                          }}
                          sx={{ mt: 2 }}
                        >
                          Cerrar cuenta
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              )}

              {/* Botón para marcar mesa como disponible si necesita limpieza */}
              {mesaNecesitaLimpieza(tableDetailDialog.mesa?.number) && (
                <Box sx={{ mb: 3 }}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    Mesa por limpiar
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Esta mesa fue pagada recientemente y necesita limpieza. Marcala como disponible una vez que esté lista.
                  </Typography>
                  <Button
                    variant="contained"
                    color="success"
                    fullWidth
                    startIcon={<CheckCircleIcon />}
                    onClick={() => marcarMesaComoDisponible(tableDetailDialog.mesa.number)}
                  >
                    Marcar como Disponible
                  </Button>
                </Box>
              )}

              {(!tableDetailDialog.mesa.pedidos || tableDetailDialog.mesa.pedidos.length === 0) &&
                !tableDetailDialog.mesa.cuenta &&
                !mesaNecesitaLimpieza(tableDetailDialog.mesa?.number) && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                      Esta mesa no tiene pedidos activos ni cuenta abierta
                    </Typography>
                    {/* Botón para liberar mesa si tiene sesión abierta */}
                    {openSessions.some((s) => s.mesaNumber === tableDetailDialog.mesa?.number) && (
                      <Button
                        variant="contained"
                        color="warning"
                        onClick={() => liberarMesa(tableDetailDialog.mesa.number)}
                        sx={{ mt: 2 }}
                      >
                        Liberar Mesa
                      </Button>
                    )}
                  </Box>
                )}

              {/* Botón para Ocupar Mesa si está disponible (sin pedidos ni sesión) */}
              {(!tableDetailDialog.mesa.pedidos || tableDetailDialog.mesa.pedidos.length === 0) &&
                !tableDetailDialog.mesa.cuenta &&
                !openSessions.some((s) => Number(s.mesaNumber) === Number(tableDetailDialog.mesa?.number)) && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      onClick={() => handleOpenSession(tableDetailDialog.mesa.number)}
                    >
                      Ocupar Mesa
                    </Button>
                  </Box>
                )}
            </>
          )}
        </Box>
      </Drawer>

      {/* Dialog de detalles de cuenta (historial) */}
      <Dialog
        open={accountDetailDialog.open}
        onClose={() => setAccountDetailDialog({ open: false, cuenta: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountBalanceWalletIcon />
              Cuenta - Mesa {accountDetailDialog.cuenta?.mesaNumber ?? 's/n'}
            </Box>
            {accountDetailDialog.cuenta && (
              <Typography variant="caption" color="text.secondary">
                {new Date(accountDetailDialog.cuenta.lastUpdated).toLocaleString('es-AR')}
              </Typography>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {accountDetailDialog.cuenta && (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Pedidos de la cuenta
                </Typography>
                <List>
                  {accountDetailDialog.cuenta.pedidos.map((pedido) => (
                    <ListItem
                      key={pedido.id}
                      sx={{
                        px: 0,
                        py: 1.5,
                        mb: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        flexDirection: 'column',
                        alignItems: 'flex-start'
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Pedido #{pedido.id}
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {money(pedido.total)}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        {new Date(pedido.createdAt || pedido.updatedAt).toLocaleString('es-AR')}
                      </Typography>
                      {pedido.items && pedido.items.length > 0 ? (
                        <Box sx={{ width: '100%', mb: 1 }}>
                          {pedido.items.map((item) => {
                            const prod = item?.product;
                            return (
                              <Typography key={item.id} variant="body2" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
                                {item.quantity}x {prod?.name || 'Producto sin datos'} — {money(item.totalPrice || item.UnitPrice * item.quantity)}
                              </Typography>
                            );
                          })}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 1 }}>
                          Sin items detallados
                        </Typography>
                      )}
                      {pedido.customerNotes && (
                        <Box sx={{ mb: 1, p: 1, bgcolor: '#fff3cd', borderRadius: 1, width: '100%' }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                            Nota del cliente:
                          </Typography>
                          <Typography variant="caption">
                            {pedido.customerNotes}
                          </Typography>
                        </Box>
                      )}
                      {pedido.staffNotes && (
                        <Box sx={{ mb: 1, p: 1, bgcolor: '#e3f2fd', borderRadius: 1, width: '100%' }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                            Observación del staff:
                          </Typography>
                          <Typography variant="caption">
                            {pedido.staffNotes}
                          </Typography>
                        </Box>
                      )}
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<VisibilityIcon />}
                        onClick={() => {
                          setAccountDetailDialog({ open: false, cuenta: null });
                          setOrderDetailDialog({ open: true, pedido });
                        }}
                        sx={{ mt: 1, textTransform: 'none' }}
                      >
                        Ver detalle completo
                      </Button>
                    </ListItem>
                  ))}
                </List>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Total de la cuenta:
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {money(accountDetailDialog.cuenta.total)}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccountDetailDialog({ open: false, cuenta: null })}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de limpieza de sesiones antiguas */}
      <Dialog
        open={cleanupDialog.open}
        onClose={() => !cleanupDialog.loading && setCleanupDialog({ open: false, loading: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CleaningServicesIcon />
            Limpiar sesiones antiguas
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Esta acción eliminará permanentemente las sesiones antiguas:
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>Sesiones abiertas con más de <strong>7 días</strong></li>
              <li>Sesiones cerradas con más de <strong>30 días</strong></li>
            </ul>
            <Typography variant="body2" color="warning.main" sx={{ mt: 2, fontWeight: 600 }}>
              ⚠️ Esta acción no se puede deshacer
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCleanupDialog({ open: false, loading: false })}
            disabled={cleanupDialog.loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={confirmCleanup}
            variant="contained"
            color="secondary"
            startIcon={cleanupDialog.loading ? null : <CleaningServicesIcon />}
            disabled={cleanupDialog.loading}
          >
            {cleanupDialog.loading ? 'Limpiando...' : 'Confirmar limpieza'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
