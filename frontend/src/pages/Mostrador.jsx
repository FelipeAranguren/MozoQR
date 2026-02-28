// src/pages/Mostrador.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { closeAccount, openSession } from '../api/tenant';
import { fetchTables, fetchActiveOrders } from '../api/tables';
import TablesStatusGridEnhanced from '../components/TablesStatusGridEnhanced';
import {
  Box, Typography, Card, CardContent, List, ListItem, Button,
  Divider, Grid, TextField, InputAdornment, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Chip, Drawer, IconButton, MenuItem, Select, FormControl,
  InputLabel, Tooltip, CircularProgress
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
import ReceiptIcon from '@mui/icons-material/Receipt';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ReceiptDialog from '../components/ReceiptDialog';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
    .format(Number(n) || 0);

/** Parsea customerNotes: si empieza con "Cliente:" la primera línea es nombre y el resto comentario. */
const parseCustomerNotes = (customerNotes) => {
  const rawNotes = (customerNotes || '').trim();
  if (!rawNotes) return { clientLine: null, commentLine: null };
  let clientLine = null;
  let commentLine = null;
  if (rawNotes.startsWith('Cliente:')) {
    const idx = rawNotes.indexOf('\n');
    clientLine = idx >= 0 ? rawNotes.slice(0, idx).trim() : rawNotes.trim();
    commentLine = idx >= 0 ? rawNotes.slice(idx).trim() : '';
  } else {
    commentLine = rawNotes;
  }
  return { clientLine, commentLine };
};

export default function Mostrador() {
  const { slug } = useParams();

  // ----- estado principal ----
  const [pedidos, setPedidos] = useState([]);
  const [todosPedidosSinPagar, setTodosPedidosSinPagar] = useState([]); // TODOS los pedidos sin pagar (incluyendo "served")
  const [activeOrders, setActiveOrders] = useState([]); // Pedidos activos (no pagados) - usado para determinar estado de mesas
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
  const [completeOrderDialog, setCompleteOrderDialog] = useState({ open: false, pedido: null, staffNotes: '', loading: false });
  const [cancelOrderDialog, setCancelOrderDialog] = useState({ open: false, pedido: null, reason: '' });
  const [tableDetailDialog, setTableDetailDialog] = useState({ open: false, mesa: null });
  const [cleanupDialog, setCleanupDialog] = useState({ open: false, loading: false });
  const [receiptDialog, setReceiptDialog] = useState({ open: false, data: null });
  const [lastUpdateAt, setLastUpdateAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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
        `&fields[0]=id&fields[1]=documentId&fields[2]=order_status&fields[3]=total&fields[4]=createdAt&fields[5]=updatedAt&fields[6]=customerNotes&fields[7]=staffNotes&fields[8]=mesaNumber` +
        `&populate[mesa_sesion][populate][mesa]=true` +
        `&populate[items][populate][product]=true` +
        `&sort[0]=updatedAt:desc` +
        `&pagination[pageSize]=196`;

      const res = await api.get(`/pedidos${qs}`);
      const base = res?.data?.data ?? [];
      
      // Mapear inicialmente todos los pedidos para extraer mesaNumber de la consulta inicial
      const planos = base.map(mapPedidoRow);

      // IMPORTANTE: Ahora que el backend guarda mesaNumber directamente en el modelo Pedido,
      // ya no necesitamos consultar sesiones cerradas ni hacer sincronización compleja.
      // El campo mesaNumber viene directamente del backend y es más confiable.
      
      // Sincronizar mesaNumber con mesa_sesion.mesa.number solo para mantener consistencia en el objeto
      // (el campo mesaNumber del backend es la fuente de verdad)
      const planosConMesa = planos.map(p => {
        // Si tiene mesaNumber del backend, asegurar que también esté en mesa_sesion.mesa.number para compatibilidad
        if (p.mesaNumber && !p.mesa_sesion?.mesa?.number) {
          return {
            ...p,
            mesa_sesion: {
              ...(p.mesa_sesion || {}),
              mesa: { number: p.mesaNumber }
            }
          };
        }
        return p;
      });

      // Cargar items para TODOS los pedidos - SIEMPRE intentar cargar para asegurar que estén disponibles
      // IMPORTANTE: Preservar explícitamente mesaNumber y mesa_sesion al cargar items
      const planosConItems = await Promise.all(
        planosConMesa.map(async (p) => {
          // Preservar mesaNumber y mesa_sesion explícitamente
          const mesaNumPreservado = p.mesaNumber;
          const mesaSesionPreservada = p.mesa_sesion;
          
          // SIEMPRE intentar cargar items para asegurar que todos los pedidos los tengan
          try {
            const items = await fetchItemsDePedido(p.id);
            // Si se cargaron items, usarlos (sobreescribir los que venían)
            if (items && Array.isArray(items) && items.length > 0) {
              return { 
                ...p, 
                items,
                mesaNumber: mesaNumPreservado, // Preservar explícitamente
                mesa_sesion: mesaSesionPreservada // Preservar explícitamente
              };
            }
            // Si no hay items cargados pero venían en la respuesta inicial, usarlos
            if (p.items && Array.isArray(p.items) && p.items.length > 0) {
              return {
                ...p,
                mesaNumber: mesaNumPreservado, // Preservar explícitamente
                mesa_sesion: mesaSesionPreservada // Preservar explícitamente
              };
            }
            // Si no hay items en ningún lado, usar array vacío
            return { 
              ...p, 
              items: [],
              mesaNumber: mesaNumPreservado, // Preservar explícitamente
              mesa_sesion: mesaSesionPreservada // Preservar explícitamente
            };
          } catch {
            // Si falla la carga, usar items que ya tenía o array vacío
            return { 
              ...p, 
              items: p.items || [],
              mesaNumber: mesaNumPreservado, // Preservar explícitamente
              mesa_sesion: mesaSesionPreservada // Preservar explícitamente
            };
          }
        })
      );

      // Filtrar pedidos del sistema (solicitud de cobro, llamar mozo, etc.)
      const pedidosFiltrados = planosConItems.filter(p => !isSystemOrder(p));

      // Deduplicar pedidos usando documentId (un pedido puede aparecer con estados served y paid)
      const pedidosUnicosMap = new Map();
      pedidosFiltrados.forEach(p => {
        const key = keyOf(p); // documentId o id
        const existente = pedidosUnicosMap.get(key);
        // Si ya existe, mantener el que tiene estado 'paid' (más reciente/final) o el más reciente por updatedAt
        if (!existente) {
          pedidosUnicosMap.set(key, p);
        } else {
          // Preferir 'paid' sobre 'served', o el más reciente
          // IMPORTANTE: Preservar mesaNumber e items del pedido que los tiene, sin importar cuál se mantiene
          const mesaNumPreservado = p.mesaNumber || existente.mesaNumber;
          const itemsPreservados = (p.items && Array.isArray(p.items) && p.items.length > 0) 
            ? p.items 
            : ((existente.items && Array.isArray(existente.items) && existente.items.length > 0) ? existente.items : []);
          
          // Construir mesa_sesion preservando el número de mesa
          const construirMesaSesion = (mesaSesionOriginal, mesaNum) => {
            if (!mesaNum) return mesaSesionOriginal;
            // Si ya tiene mesa_sesion, asegurar que tenga mesa.number
            if (mesaSesionOriginal) {
              return {
                ...mesaSesionOriginal,
                mesa: {
                  ...mesaSesionOriginal.mesa,
                  number: mesaNum
                }
              };
            }
            // Si no tiene mesa_sesion, crearlo
            return { mesa: { number: mesaNum } };
          };

          if (p.order_status === 'paid' && existente.order_status !== 'paid') {
            // Preferir el 'paid', pero preservar mesaNumber e items del que los tiene
            const nuevoPedido = {
              ...p,
              mesaNumber: mesaNumPreservado,
              mesa_sesion: construirMesaSesion(p.mesa_sesion || existente.mesa_sesion, mesaNumPreservado),
              items: itemsPreservados
            };
            pedidosUnicosMap.set(key, nuevoPedido);
          } else if (p.order_status === existente.order_status) {
            // Si tienen el mismo estado, mantener el más reciente pero preservar información de ambos
            const pTime = new Date(p.updatedAt).getTime();
            const existenteTime = new Date(existente.updatedAt).getTime();
            if (pTime > existenteTime) {
              const nuevoPedido = {
                ...p,
                mesaNumber: mesaNumPreservado,
                mesa_sesion: construirMesaSesion(p.mesa_sesion || existente.mesa_sesion, mesaNumPreservado),
                items: itemsPreservados
              };
              pedidosUnicosMap.set(key, nuevoPedido);
            } else {
              // Mantener el existente pero preservar mesaNumber e items del nuevo si los tiene
              const nuevoExistente = {
                ...existente,
                mesaNumber: mesaNumPreservado,
                mesa_sesion: construirMesaSesion(existente.mesa_sesion || p.mesa_sesion, mesaNumPreservado),
                items: itemsPreservados
              };
              pedidosUnicosMap.set(key, nuevoExistente);
            }
          } else {
            // Si el existente es 'paid' y el nuevo no, mantener el existente pero preservar mesaNumber
            const nuevoExistente = {
              ...existente,
              mesaNumber: mesaNumPreservado,
              mesa_sesion: construirMesaSesion(existente.mesa_sesion || p.mesa_sesion, mesaNumPreservado),
              items: itemsPreservados
            };
            pedidosUnicosMap.set(key, nuevoExistente);
          }
        }
      });
      const pedidosUnicos = Array.from(pedidosUnicosMap.values())
        // Ordenar por updatedAt descendente (más reciente primero) - orden de llegada al historial
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        // Paso final: Asegurar que todos los pedidos tengan mesaNumber (prioridad) y mesa_sesion reconstruida si es necesario
        .map(p => {
          // Priorizar mesaNumber del backend sobre mesa_sesion.mesa.number
          const mesaNum = p.mesaNumber || p.mesa_sesion?.mesa?.number;
          if (mesaNum) {
            // Si tenemos mesaNumber del backend pero no está en mesa_sesion, reconstruirlo para compatibilidad
            if (p.mesaNumber && !p.mesa_sesion?.mesa?.number) {
              return {
                ...p,
                mesa_sesion: {
                  ...(p.mesa_sesion || {}),
                  mesa: { number: p.mesaNumber }
                }
              };
            }
            // Si no tenemos mesaNumber pero sí mesa_sesion.mesa.number, usar ese (solo para datos antiguos)
            if (!p.mesaNumber && p.mesa_sesion?.mesa?.number) {
              return { ...p, mesaNumber: p.mesa_sesion.mesa.number };
            }
          }
          return p;
        });

      // Agrupar por sesión o por mesa para cuentas (usando pedidos únicos)
      const grupos = new Map();
      pedidosUnicos.forEach((p) => {
        let key;
        // Priorizar mesaNumber del backend sobre mesa_sesion.mesa.number
        const mesaNum = p.mesaNumber || p.mesa_sesion?.mesa?.number;

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
        // Intentar obtener número de mesa de cualquier pedido del grupo (priorizar mesaNumber del backend)
        const mesaNumber = arr.find((x) => Number.isFinite(Number(x.mesaNumber)))?.mesaNumber ||
                          arr.find((x) => Number.isFinite(Number(x.mesa_sesion?.mesa?.number)))?.mesa_sesion?.mesa?.number ||
                          null;
        return {
          groupKey,
          mesaNumber,
          pedidos: arr.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
          total,
          lastUpdated,
        };
      });

      // Los pedidos ya están ordenados por updatedAt descendente (línea 205-207)
      setHistoryPedidos(pedidosUnicos);
      setHistoryCuentas(cuentasArr.sort((a, b) => b.lastUpdated - a.lastUpdated));
    } catch (err) {
    }
  };

  // ---- helpers
  const keyOf = (p) => p?.documentId || String(p?.id);
  /** Identificador exclusivo para rutas API de pedidos (Strapi v5: solo documentId) */
  const getPedidoApiId = (p) => (p && p.documentId) ? p.documentId : null;
  const isActive = (st) => !['served', 'paid'].includes(st);

  /** Elimina un pedido del estado local cuando la API devuelve 404 (recurso borrado) */
  const removePedidoFromState = (pedido) => {
    const key = keyOf(pedido);
    if (!key) return;
    setPedidos((prev) => {
      const next = prev.filter((p) => keyOf(p) !== key);
      pedidosRef.current = next;
      updateCachedView(next);
      return next;
    });
    setTodosPedidosSinPagar((prev) => prev.filter((p) => keyOf(p) !== key));
    servingIdsRef.current.delete(pedido.id);
    seenIdsRef.current.delete(pedido.id);
  };

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

    // Extraer número de mesa - PRIMERO usar el campo mesaNumber directo del backend (más confiable)
    // Luego usar mesa_sesion.mesa.number como fallback para compatibilidad con datos antiguos
    let mesaNumber = a.mesaNumber || null;
    
    // Si no viene en el campo directo, intentar extraer de mesa_sesion.mesa.number
    if (!mesaNumber) {
      mesaNumber = mesaAttrs.number || mesaAttrs.numero || mesa?.number || null;
      if (!mesaNumber && mesa) {
        mesaNumber = mesa.number || mesa.numero || null;
      }
    }

    // Extraer items si vienen en la respuesta del backend
    let items = [];
    if (a.items) {
      const itemsData = Array.isArray(a.items?.data) ? a.items.data : Array.isArray(a.items) ? a.items : [];
      items = itemsData.map((it) => {
        const itemAttrs = it.attributes || it;
        const prodData = itemAttrs.product?.data || itemAttrs.product || {};
        const prodAttrs = prodData.attributes || prodData;
        
        // For system products (sys-waiter-call, sys-pay-request), product may be null
        // but the name is stored in notes. Extract it if it starts with the system product name.
        const itemNotes = itemAttrs.notes || '';
        const hasSystemProductName = itemNotes.includes('🔔 LLAMAR MOZO') || 
                                     itemNotes.includes('LLAMAR MOZO') ||
                                     itemNotes.includes('💳 SOLICITUD DE COBRO') ||
                                     itemNotes.includes('SOLICITUD DE COBRO');
        
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
            : (hasSystemProductName ? { id: null, name: itemNotes.split(' - ')[0] } : null),
          // Also include name directly for system products
          name: hasSystemProductName ? itemNotes.split(' - ')[0] : (prodAttrs.name || prodAttrs.nombre || null),
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
      // Preservar número de mesa directamente en el pedido para que no se pierda cuando se cierra la sesión
      mesaNumber: mesaNumber,
    };
  };

  const hydrateMesaSesionIfMissing = async (pedido) => {
    const docId = pedido?.documentId;
    if (!docId) return pedido;

    const mesaNumberPreservado = pedido.mesaNumber || pedido.mesa_sesion?.mesa?.number;

    try {
      const qs =
        `?publicationState=preview` +
        `&fields[0]=id&fields[1]=documentId&fields[2]=order_status&fields[3]=customerNotes&fields[4]=total&fields[5]=createdAt&fields[6]=updatedAt` +
        `&populate[mesa_sesion][populate][mesa]=true` +
        `&populate[items][populate][product]=true`;
      const r = await api.get(`/pedidos/${docId}${qs}`);
      const data = r?.data?.data;
      if (!data) {
        // Si falla, preservar mesaNumber si lo teníamos
        if (mesaNumberPreservado && !pedido.mesa_sesion?.mesa?.number) {
          return {
            ...pedido,
            mesaNumber: mesaNumberPreservado,
            mesa_sesion: pedido.mesa_sesion || {
              mesa: { number: mesaNumberPreservado }
            }
          };
        }
        return pedido;
      }
      const filled = mapPedidoRow({ id: data.id, ...(data.attributes ? data : { attributes: data }) });
      
      // Preservar items si el pedido original ya los tenía y están completos
      // Si no, usar los items del pedido hidratado
      let itemsFinales = filled.items || [];
      if (pedido.items && Array.isArray(pedido.items) && pedido.items.length > 0) {
        const itemsCompletos = pedido.items.every(item => item.product?.name || item.name);
        if (itemsCompletos) {
          itemsFinales = pedido.items;
        }
      }
      
      // Preservar mesaNumber si el pedido hidratado no lo tiene pero lo teníamos antes
      const mesaNumberFinal = filled.mesaNumber || filled.mesa_sesion?.mesa?.number || mesaNumberPreservado;
      
      // Construir mesa_sesion con el número preservado si es necesario
      let mesaSesionFinal = filled.mesa_sesion;
      if (!mesaSesionFinal?.mesa?.number && mesaNumberFinal) {
        mesaSesionFinal = {
          mesa: { number: mesaNumberFinal }
        };
      }
      
      return {
        ...filled,
        items: itemsFinales,
        mesaNumber: mesaNumberFinal,
        mesa_sesion: mesaSesionFinal || filled.mesa_sesion,
      };
    } catch (err) {
      if (err?.response?.status === 404) return null;
      // Si falla la hidratación, preservar mesaNumber si lo teníamos
      if (mesaNumberPreservado && !pedido.mesa_sesion?.mesa?.number) {
        return {
          ...pedido,
          mesaNumber: mesaNumberPreservado,
          mesa_sesion: pedido.mesa_sesion || {
            mesa: { number: mesaNumberPreservado }
          }
        };
      }
      return pedido;
    }
  };

  const fetchItemsDePedido = async (orderIdOrDocId) => {
    const qs =
      `/item-pedidos?publicationState=live` +
      `&filters[order][id][$eq]=${encodeURIComponent(orderIdOrDocId)}` +
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
        product: { id: prodData.id, name: prodAttrs.name || prodAttrs.nombre || null },
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
      let rawList = res?.data?.data ?? [];
      // Solo ítems con documentId y sin duplicados (evitar pedidos fantasma no identificables)
      const seenDocIds = new Set();
      rawList = rawList.filter((item) => {
        const docId = item?.documentId ?? item?.attributes?.documentId;
        if (!docId) return false;
        if (seenDocIds.has(docId)) return false;
        seenDocIds.add(docId);
        return true;
      });

      const planos = rawList.map(mapPedidoRow);

      // Solo hidratar pedidos que realmente necesitan la información
      const planosFilled = (await Promise.all(
        planos.map(async (p) => {
          if (p.mesa_sesion?.mesa?.number != null) return p;
          if (p.mesa_sesion?.id) {
            const filled = await hydrateMesaSesionIfMissing(p);
            return filled; // puede ser null si 404
          }
          return p;
        })
      )).filter(Boolean);

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
              const docId = getPedidoApiId(p);
              if (docId) {
                const fetched = await fetchItemsDePedido(docId);
                if (fetched && Array.isArray(fetched) && fetched.length > 0) {
                  items = fetched;
                } else if (fetched && Array.isArray(fetched)) {
                  items = [];
                }
              }
            } catch (err) {
              if (err?.response?.status === 404) removePedidoFromState(p);
            }
          }

          return { ...p, items: items || [] };
        })
      );

      const ordenados = ordenarActivos(conItems);

      // Solo pedidos con documentId (evitar fantasma que no se puede identificar en el API)
      const conDocId = ordenados.filter((p) => p?.documentId != null);

      // visibles: activos + served (para mostrar en columnas Pendientes, Cocina y Listos)
      const visibles = conDocId.filter((p) =>
        (isActive(p.order_status) || p.order_status === 'served') &&
        !servingIdsRef.current.has(p.id)
      );

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

      // CRÍTICO: Guardar TODOS los pedidos sin pagar (solo con documentId)
      const todosLosPedidosSinPagar = conDocId.filter((p) => p.order_status !== 'paid' && !isSystemOrder(p));
      setTodosPedidosSinPagar(todosLosPedidosSinPagar);

      // ---- agrupar cuentas (solo pedidos con documentId, excluyendo sistema)
      const grupos = new Map();
      conDocId.forEach((p) => {
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
      setLastUpdateAt(new Date());

      // Revalidar en segundo plano: si algún pedido ya no existe en el API (404), quitarlo del estado
      visibles.forEach((p) => {
        const docId = p?.documentId;
        if (!docId) return;
        api.get(`/pedidos/${docId}?fields[0]=documentId`).catch((err) => {
          if (err?.response?.status === 404) removePedidoFromState(p);
        });
      });
    } catch (err) {
      setError('No se pudieron cargar los pedidos.');
      // Limpiar estado para no mostrar datos obsoletos o pedidos fantasma
      pedidosRef.current = [];
      setPedidos([]);
      setTodosPedidosSinPagar([]);
      updateCachedView([], []);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPedidos(), fetchMesas(), fetchOpenSessions(), fetchActiveOrdersForTables()]);
    setRefreshing(false);
    setSnack({ open: true, msg: 'Datos actualizados', severity: 'info' });
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
      const mesasData = await fetchTables(slug);
      // Filtrar duplicados: si hay múltiples mesas con el mismo número, usar solo la primera (más antigua)
      const mesasUnicas = mesasData.reduce((acc, mesa) => {
        const mesaNum = mesa.number;
        // Si ya existe una mesa con este número, no agregar (mantener la primera)
        if (!acc.find(m => m.number === mesaNum)) {
          acc.push(mesa);
        } else {
          console.warn(`[Mostrador] Mesa duplicada detectada y filtrada: Mesa ${mesaNum} (ID: ${mesa.id})`);
        }
        return acc;
      }, []);
      setMesas(mesasUnicas);
    } catch (err) {
      // Error silencioso
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

      // Filtrar sesiones no abiertas (Zombie Protection)

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
        // Eliminar duplicados
      }

      // Log solo cuando hay sesiones válidas o cambios significativos
      setOpenSessions(validSessions);


    } catch (err) {
      // Solo loguear errores críticos, no en cada intento
      if (err?.response?.status !== 404 && err?.response?.status !== 403) {
      }
      setOpenSessions([]);
    }
  };

  // Liberar mesa (cerrar sesión sin pedidos)
  const liberarMesa = async (mesaNumber) => {
    try {
      // Verificar que la mesa esté realmente ocupada antes de intentar liberarla
      const mesaActual = mesas.find(m => Number(m.number) === Number(mesaNumber));
      if (mesaActual?.status !== 'ocupada') {
        console.warn(`[liberarMesa] Mesa ${mesaNumber} no está ocupada (status: ${mesaActual?.status}). No se puede liberar.`);
        setSnack({ open: true, msg: `La mesa ${mesaNumber} no está ocupada`, severity: 'warning' });
        // Refrescar mesas por si acaso el estado está desactualizado
        await fetchMesas();
        return;
      }

      // Cancelar todos los pedidos activos de esta mesa antes de cerrar la sesión
      const pedidosActivos = pedidos.filter(p => {
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
        } catch (err) {
          // Continuar aunque falle la cancelación
        }
      }

      // Cerrar la sesión usando el endpoint custom
      // Este endpoint cierra todas las sesiones activas y marca la mesa como 'disponible'
      await api.put(`/restaurants/${slug}/close-session`, {
        data: {
          table: mesaNumber,
        },
      });

      // Actualizar estado local inmediatamente para que la UI responda rápido (optimista)
      setOpenSessions(prev => prev.filter(s => Number(s.mesaNumber) !== Number(mesaNumber)));
      setMesas(prev => prev.map(m =>
        Number(m.number) === Number(mesaNumber)
          ? { ...m, status: 'disponible', currentSession: null }
          : m
      ));

      // Actualizar todosPedidosSinPagar para remover pedidos de esta mesa
      setTodosPedidosSinPagar(prev => prev.filter(p => {
        const mesaNum = p?.mesa_sesion?.mesa?.number;
        return mesaNum == null || Number(mesaNum) !== Number(mesaNumber);
      }));

      setSnack({ open: true, msg: `Mesa ${mesaNumber} liberada ✅`, severity: 'success' });

      // Esperar un momento para que el backend procese el cambio
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refrescar datos del servidor para obtener el estado real
      await Promise.all([
        fetchOpenSessions(),
        fetchPedidos(),
        fetchMesas(),
        fetchActiveOrdersForTables()
      ]);

      // Cerrar el diálogo de detalle de mesa si está abierto
      if (tableDetailDialog.mesa?.number === mesaNumber) {
        setTableDetailDialog({ open: false, mesa: null });
      }
    } catch (err) {
      console.error(`[liberarMesa] Error:`, err);
      const status = err?.response?.status;
      const msg = status === 403
        ? 'Sin permiso para liberar mesas. Verificá que tu usuario sea owner o staff del restaurante.'
        : (err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || 'Error desconocido');
      setSnack({ open: true, msg: `No se pudo liberar la mesa ❌: ${msg}`, severity: 'error' });
      await fetchMesas();
    }
  };

  // Liberar todas las mesas (sin tocar pedidos) - usa close-session como el cleanup
  const cuentaToReceiptData = (cuenta) => {
    if (!cuenta) return null;
    const items = [];
    (cuenta.pedidos || []).forEach((p) => {
      (p.items || []).forEach((it) => {
        const qty = Number(it.quantity || it.qty || 1) || 1;
        const total = Number(it.totalPrice ?? it.total ?? 0) || 0;
        const name = it.product?.name || it.productName || 'Producto';
        items.push({ name, quantity: qty, totalPrice: total, unitPrice: total / qty });
      });
    });
    return {
      restaurant: { name: slug || 'Restaurante' },
      mesaNumber: cuenta.mesaNumber,
      items: items.length > 0 ? items : [{ name: 'Cuenta', quantity: 1, totalPrice: cuenta.total, unitPrice: cuenta.total }],
      subtotal: cuenta.total,
      discount: 0,
      total: cuenta.total,
      paidAt: cuenta.lastUpdated || new Date(),
      paymentMethod: '—',
    };
  };

  // Limpiar sesiones antiguas
  const handleCleanupOldSessions = async () => {
    setCleanupDialog({ open: true, loading: false });
  };

  const confirmCleanup = async () => {
    setCleanupDialog({ open: true, loading: true });
    try {
      // 1. Obtener TODOS los pedidos del restaurante que no estén como "paid" o "cancelled"
      // Usar $in para incluir solo los estados activos (pending, preparing, served)
      const qs =
        `?filters[restaurante][slug][$eq]=${encodeURIComponent(slug)}` +
        `&filters[order_status][$in][0]=pending` +
        `&filters[order_status][$in][1]=preparing` +
        `&filters[order_status][$in][2]=served` +
        `&publicationState=live` +
        `&fields[0]=id&fields[1]=documentId&fields[2]=order_status` +
        `&pagination[pageSize]=1000`;

      const pedidosRes = await api.get(`/pedidos${qs}`, {
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      let todosLosPedidos = pedidosRes?.data?.data ?? [];
      
      // Si hay más páginas, obtenerlas todas
      const totalPages = pedidosRes?.data?.meta?.pagination?.pageCount || 1;
      if (totalPages > 1) {
        const pedidosAdicionales = [];
        for (let page = 2; page <= totalPages; page++) {
          const qsPage = qs + `&pagination[page]=${page}`;
          const resPage = await api.get(`/pedidos${qsPage}`);
          pedidosAdicionales.push(...(resPage?.data?.data ?? []));
        }
        todosLosPedidos = [...todosLosPedidos, ...pedidosAdicionales];
      }

      // 2. Marcar todos los pedidos como "paid"
      let pedidosMarcados = 0;
      const pedidosConDocId = todosLosPedidos.filter((p) => {
        const raw = p.attributes || p;
        return p.documentId ?? raw.documentId;
      });

      if (pedidosConDocId.length > 0) {
        await Promise.all(
          pedidosConDocId.map(async (pedido) => {
            try {
              const raw = pedido.attributes || pedido;
              const apiId = pedido.documentId ?? raw.documentId;
              if (apiId) {
                try {
                  await api.patch(`/pedidos/${apiId}`, { data: { order_status: 'paid' } });
                  pedidosMarcados++;
                } catch (err) {
                  if (err?.response?.status === 404) removePedidoFromState({ documentId: apiId, id: pedido.id ?? raw.id });
                  else if (err?.response?.status === 405) {
                    await api.put(`/pedidos/${apiId}`, { data: { order_status: 'paid' } });
                    pedidosMarcados++;
                  }
                }
              }
            } catch (err) {
              // Ignorar errores individuales y continuar con los demás
            }
          })
        );
      }

      // 3. Obtener todas las mesas del restaurante
      const todasLasMesas = await fetchTables(slug);

      // 4. Cerrar todas las sesiones de todas las mesas
      let mesasLiberadas = 0;
      for (const mesa of todasLasMesas) {
        try {
          await api.put(`/restaurants/${slug}/close-session`, {
            data: {
              table: mesa.number,
            },
          });
          mesasLiberadas++;
        } catch (err) {
          // Continuar aunque falle alguna mesa
        }
      }

      // 5. Limpiar estado local
      setPedidos([]);
      setCuentas([]);
      setTodosPedidosSinPagar([]);
      setActiveOrders([]);
      setOpenSessions([]);
      pedidosRef.current = [];
      servingIdsRef.current = new Set();
      seenIdsRef.current = new Set();

      setSnack({
        open: true,
        msg: `✅ Limpieza completada: ${pedidosMarcados} pedido(s) marcado(s) como pagados, ${mesasLiberadas} mesa(s) liberada(s)`,
        severity: 'success',
      });
      setCleanupDialog({ open: false, loading: false });

      // 6. Esperar un momento para que el backend procese los cambios
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 7. Refrescar todos los datos
      await Promise.all([
        fetchPedidos(),
        fetchMesas(),
        fetchOpenSessions(),
        fetchActiveOrdersForTables(),
      ]);
    } catch (err) {
      const errorMsg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Error desconocido';
      const statusCode = err?.response?.status;
      setSnack({
        open: true,
        msg: `❌ Error al limpiar: ${errorMsg}${statusCode ? ` (${statusCode})` : ''}`,
        severity: 'error',
      });
      setCleanupDialog({ open: false, loading: false });
    }
  };

  // Marcar mesa como disponible después de limpiarla
  const marcarMesaComoDisponible = async (mesaNumber) => {
    try {
      // CRÍTICO: Primero marcar todos los pedidos de esta mesa como 'paid'
      // Esto es necesario porque el frontend fuerza el estado a 'ocupada' si hay pedidos sin pagar
      // Igual que hace closeAccount cuando se paga una cuenta
      const pedidosDeMesa = todosPedidosSinPagar.filter(p => {
        const mesaNum = p?.mesa_sesion?.mesa?.number;
        return mesaNum != null && Number(mesaNum) === Number(mesaNumber);
      });

      if (pedidosDeMesa.length > 0) {
        try {
          const pedidosKeys = new Set(pedidosDeMesa.map((p) => keyOf(p)).filter(Boolean));

          await Promise.all(
            pedidosDeMesa.map((pedido) => putEstado(pedido, 'paid'))
          );

          setTodosPedidosSinPagar((prev) =>
            prev.filter((p) => !pedidosKeys.has(keyOf(p)))
          );
        } catch (err) {
          // Continuar aunque falle, el backend también puede hacerlo
        }
      }

      // Usar el endpoint robusto del backend que cierra sesiones Y pone la mesa como disponible
      // Este es el mismo patrón que se usa cuando se paga una cuenta (closeAccount)
      const closeResponse = await api.put(`/restaurants/${slug}/close-session`, {
        data: {
          table: mesaNumber,
        },
      });

      // Actualizar estado inmediatamente para que la UI responda rápido
      setOpenSessions(prev => prev.filter(s => Number(s.mesaNumber) !== Number(mesaNumber)));

      // NOTA: todosPedidosSinPagar ya se actualizó arriba cuando marcamos los pedidos como 'paid'

      // Optimista: Actualizar el estado de la mesa localmente también
      // Igual que cuando se paga una cuenta, actualizamos el estado a 'disponible'
      setMesas(prev => prev.map(m =>
        Number(m.number) === Number(mesaNumber)
          ? { ...m, status: 'disponible', currentSession: null }
          : m
      ));

      setSnack({ open: true, msg: `Mesa ${mesaNumber} marcada como disponible ✅`, severity: 'success' });

      // Cerrar el diálogo de detalle de mesa si está abierto
      if (tableDetailDialog.mesa?.number === mesaNumber) {
        setTableDetailDialog({ open: false, mesa: null });
      }

      // Esperar un momento para que el backend procese el cambio completamente
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Refrescar TODO en paralelo para obtener el estado más reciente
      await Promise.all([
        fetchPedidos(),      // Actualizar pedidos (deberían estar todos 'paid' ahora)
        fetchOpenSessions(), // Actualizar sesiones (deberían estar todas 'closed' ahora)
        fetchMesas(),        // Actualizar mesas (debería estar 'disponible' ahora)
        fetchActiveOrdersForTables() // CRÍTICO: Actualizar pedidos activos para estado de mesas
      ]);

      // CRÍTICO: Asegurarnos de que los pedidos de esta mesa NO estén en todosPedidosSinPagar
      // Esto es necesario porque fetchPedidos() puede traer pedidos con estado anterior si el backend aún no los actualizó
      setTodosPedidosSinPagar(prev => {
        const filtrados = prev.filter(p => {
          const mesaNum = p?.mesa_sesion?.mesa?.number;
          // Remover pedidos de esta mesa O pedidos que ya están marcados como 'paid'
          return (mesaNum == null || Number(mesaNum) !== Number(mesaNumber)) && p.order_status !== 'paid';
        });
        return filtrados;
      });

      // Verificar que la mesa se actualizó - hacer una segunda verificación después de un momento
      await new Promise(resolve => setTimeout(resolve, 500));
      const mesasActualizadas = await fetchTables(slug);
      const mesaActualizada = mesasActualizadas.find(m => Number(m.number) === Number(mesaNumber));

      if (mesaActualizada?.status !== 'disponible') {
        // Forzar otro refresh después de 2 segundos más
        setTimeout(async () => {
          await fetchMesas();
          // Asegurarnos de que los pedidos de esta mesa no estén en todosPedidosSinPagar
          setTodosPedidosSinPagar(prev => prev.filter(p => {
            const mesaNum = p?.mesa_sesion?.mesa?.number;
            return mesaNum == null || Number(mesaNum) !== Number(mesaNumber);
          }));
        }, 2000);
      }
    } catch (err) {
      setSnack({ open: true, msg: 'No se pudo marcar la mesa como disponible ❌', severity: 'error' });
    }
  };

  // Abrir sesión manualmente (Ocupar Mesa)
  const handleOpenSession = async (mesaNumber) => {
    try {
      // Staff override: ocupar mesa con una sesión "técnica" (no es sesión de cliente).
      // Esto evita que el backend cree sesiones sin identificador y mantiene consistencia.
      const staffSessionId = `staff_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await openSession(slug, { table: mesaNumber, tableSessionId: staffSessionId });

      // Actualizar estado inmediatamente para que la UI responda rápido
      // Optimista: Actualizar el estado de la mesa localmente también
      setMesas(prev => prev.map(m =>
        Number(m.number) === Number(mesaNumber)
          ? { ...m, status: 'ocupada' }
          : m
      ));

      setSnack({ open: true, msg: `Mesa ${mesaNumber} ocupada ✅`, severity: 'success' });

      // Cerrar el diálogo
      setTableDetailDialog({ open: false, mesa: null });

      // Esperar un momento para que el backend procese el cambio completamente
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refrescar TODO en paralelo para obtener el estado más reciente
      await Promise.all([
        fetchPedidos(),      // Actualizar pedidos
        fetchOpenSessions(), // Actualizar sesiones (debería tener una sesión 'open' ahora)
        fetchMesas(),        // Actualizar mesas (debería estar 'ocupada' ahora)
        fetchActiveOrdersForTables() // Actualizar pedidos activos para estado de mesas
      ]);

      // Verificar que la mesa se actualizó - hacer una segunda verificación después de un momento
      await new Promise(resolve => setTimeout(resolve, 500));
      const mesasActualizadas = await fetchTables(slug);
      const mesaActualizada = mesasActualizadas.find(m => Number(m.number) === Number(mesaNumber));

      if (mesaActualizada?.status !== 'ocupada') {
        // Forzar otro refresh después de 2 segundos más
        setTimeout(async () => {
          await fetchMesas();
        }, 2000);
      }
    } catch (err) {
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

  // Función para obtener pedidos activos (no pagados) - usado para determinar estado de mesas
  // Esta función usa fetchActiveOrders que solo trae pedidos que NO están pagados,
  // igual que OwnerDashboard.jsx, asegurando que una vez que un pedido se marca como "paid",
  // ya no aparece en la lista y la mesa se muestra como libre
  const fetchActiveOrdersForTables = async () => {
    try {
      const orders = await fetchActiveOrders(slug);
      console.log('[Mostrador] fetchActiveOrdersForTables - Pedidos activos recibidos:', orders.length, orders);
      
      // CRÍTICO: Filtrar pedidos cancelados - no deben contarse como activos
      // Los pedidos cancelados no deben aparecer en el contador de pedidos activos de las mesas
      const activeOrdersFiltered = orders.filter(order => order.order_status !== 'cancelled');
      console.log('[Mostrador] fetchActiveOrdersForTables - Pedidos después de filtrar cancelados:', activeOrdersFiltered.length, activeOrdersFiltered);
      
      // Convertir a formato compatible con TablesStatusGridEnhanced
      const formattedOrders = activeOrdersFiltered.map(order => ({
        id: order.id,
        order_status: order.order_status,
        total: order.total,
        createdAt: order.createdAt,
        mesa_sesion: {
          mesa: {
            number: order.mesa || order.tableNumber
          }
        },
        mesa: order.mesa || order.tableNumber,
        tableNumber: order.mesa || order.tableNumber
      }));
      console.log('[Mostrador] fetchActiveOrdersForTables - Pedidos formateados:', formattedOrders.length, formattedOrders);
      setActiveOrders(formattedOrders);
    } catch (err) {
      console.warn('Error fetching active orders for tables:', err);
      setActiveOrders([]);
    }
  };

  useEffect(() => {
    // No restaurar desde caché: la única fuente de verdad es el API (evita pedidos fantasma)
    pedidosRef.current = [];
    setPedidos([]);
    setCuentas([]);
    setTodosPedidosSinPagar([]);
    setActiveOrders([]);
    fetchPedidos();
    fetchMesas();
    fetchOpenSessions();
    fetchActiveOrdersForTables();
    const interval = setInterval(() => {
      fetchPedidos();
      fetchMesas();
      fetchOpenSessions();
      fetchActiveOrdersForTables();
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Revalidar al volver a la pestaña para evitar mostrar datos obsoletos o fantasma
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && slug) {
        fetchPedidos();
        fetchActiveOrdersForTables();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // marcar que ya hubo al menos una carga
  useEffect(() => { hasLoadedRef.current = true; }, []);

  // ---- acciones ----
  const putEstado = async (pedido, estado) => {
    const apiId = typeof pedido === 'object' ? getPedidoApiId(pedido) : (pedido != null ? String(pedido) : null);
    const itemIds =
      typeof pedido === 'object'
        ? (pedido?.items || []).map((it) => it?.id).filter(Boolean)
        : [];

    if (apiId == null) throw new Error('Pedido sin id');

    try {
      await api.patch(`/pedidos/${apiId}`, { data: { order_status: estado } });
    } catch (err) {
      if (err?.response?.status === 404) {
        if (typeof pedido === 'object') removePedidoFromState(pedido);
        return;
      }
      if (err?.response?.status === 405) {
        const data = { order_status: estado };
        if (itemIds.length > 0) data.items = itemIds;
        await api.put(`/pedidos/${apiId}`, { data });
        return;
      }
      throw err;
    }
  };

  const refreshItemsDe = async (pedido) => {
    const apiId = getPedidoApiId(pedido);
    if (!apiId) return;
    try {
      const items = await fetchItemsDePedido(apiId);
      if (items?.length) {
        const key = keyOf(pedido);
        setPedidos((prev) => {
          const next = prev.map((p) => (keyOf(p) === key ? { ...p, items } : p));
          pedidosRef.current = next;
          updateCachedView(next);
          return next;
        });
      }
    } catch { }
  };

  const refreshItemsDeBackground = (pedido) => {
    refreshItemsDe(pedido).catch(() => {});
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
      setSnack({
        open: true,
        msg: 'No se pudo marcar la llamada como atendida. Intentá de nuevo.',
        severity: 'error',
      });
    }
  };

  const marcarComoRecibido = async (pedido) => {
    // Evitar procesar el mismo pedido múltiples veces simultáneamente
    const pedidoKey = keyOf(pedido);
    const currentPedidos = pedidosRef.current;
    const currentPedido = currentPedidos.find(p => keyOf(p) === pedidoKey);
    
    // Si ya está en 'preparing', no hacer nada (evita duplicados)
    if (currentPedido?.order_status === 'preparing') {
      return;
    }

    // Actualización optimista inmediata
    setPedidos((prev) => {
      const next = prev.map((p) =>
        keyOf(p) === pedidoKey ? { ...p, order_status: 'preparing' } : p
      );
      pedidosRef.current = next;
      updateCachedView(next);
      return next;
    });
    
    triggerFlash(pedido.documentId);
    
    // Actualizar en backend sin bloquear (ejecutar en background)
    putEstado(pedido, 'preparing').catch((err) => {
      // Si falla, revertir el estado
      setError('No se pudo actualizar el pedido.');
      setPedidos((prev) => {
        const next = prev.map((p) =>
          keyOf(p) === pedidoKey ? { ...p, order_status: 'pending' } : p
        );
        pedidosRef.current = next;
        updateCachedView(next);
        return next;
      });
    });
    
    // Refrescar items en background sin bloquear
    refreshItemsDeBackground(pedido);
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

      const apiId = getPedidoApiId(pedido);
      try {
        await api.patch(`/pedidos/${apiId}`, { data: updateData });
      } catch (patchErr) {
        if (patchErr?.response?.status === 404) {
          removePedidoFromState(pedido);
          return;
        }
        if (patchErr?.response?.status === 405) {
          await api.put(`/pedidos/${apiId}`, { data: updateData });
        } else {
          throw patchErr;
        }
      }

      await fetchPedidos();
      await fetchActiveOrdersForTables();
      setSnack({
        open: true,
        msg: staffNotes && staffNotes.trim()
          ? 'Pedido completado con observaciones ✅'
          : 'Pedido marcado como servido ✅',
        severity: 'success'
      });
    } catch (err) {
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
      throw err;
    }
  };

  const cancelarPedido = async (pedido, reason = '') => {
    try {
      await putEstado(pedido, 'cancelled');

      const trimmed = (reason || '').trim();
      if (trimmed) {
        try {
          const apiId = getPedidoApiId(pedido);
          if (apiId) {
            await api.patch(`/pedidos/${apiId}`, {
              data: { cancellationReason: trimmed },
            });
          }
        } catch (err) {
          if (err?.response?.status === 404) removePedidoFromState(pedido);
        }
      }

      setSnack({ open: true, msg: 'Pedido cancelado ✅', severity: 'success' });
      await fetchPedidos();
      await fetchActiveOrdersForTables();
    } catch (err) {
      if (err?.response?.status === 404) removePedidoFromState(pedido);
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
        // Cerrar sin cobrar (invitado) - cierre manual desde mostrador, sin validar pasarela
        if (cuenta.mesaNumber != null) {
          const payload = { table: cuenta.mesaNumber, closeWithoutPayment: true, isManualSettlement: true };
          if (cuenta.mesaSesionId) payload.tableSessionId = cuenta.mesaSesionId;
          await closeAccount(slug, payload);
        } else {
          const pendientes = (cuenta.pedidos || []).filter((p) => p.order_status !== 'paid' && getPedidoApiId(p));
          await Promise.all(pendientes.map((pedido) =>
            api.patch(`/pedidos/${getPedidoApiId(pedido)}`, {
              data: {
                order_status: 'paid',
                payment_status: 'paid',
                closeWithoutPayment: true
              }
            }).catch((err) => {
              if (err?.response?.status === 404) removePedidoFromState(pedido);
            })
          ));
        }
        setSnack({ open: true, msg: 'Cuenta cerrada sin cobro (Invitado) ✅', severity: 'success' });
      } else if (discount > 0) {
        // Aplicar descuento y pagar
        const pendientes = (cuenta.pedidos || []).filter((p) => p.order_status !== 'paid' && getPedidoApiId(p));
        await Promise.all(pendientes.map((pedido) => {
          const pedidoTotal = Number(pedido.total || 0);
          const pedidoDiscount = discountType === 'percent'
            ? pedidoTotal * (discount / 100)
            : (discount * pedidoTotal / cuenta.total);
          const pedidoFinal = Math.max(0, pedidoTotal - pedidoDiscount);

          return api.patch(`/pedidos/${getPedidoApiId(pedido)}`, {
            data: {
              order_status: 'paid',
              payment_status: 'paid',
              total: pedidoFinal,
              discount: discount,
              discountType: discountType
            }
          }).catch((err) => {
            if (err?.response?.status === 404) removePedidoFromState(pedido);
          });
        }));
        setSnack({ open: true, msg: `Cuenta pagada con ${discount}${discountType === 'percent' ? '%' : '$'} de descuento ✅`, severity: 'success' });
      } else {
        // Pago normal - cierre manual desde mostrador, sin validar pasarela (Mobbex/MP)
        if (cuenta.mesaNumber != null) {
          const payload = { table: cuenta.mesaNumber, isManualSettlement: true };
          if (cuenta.mesaSesionId) payload.tableSessionId = cuenta.mesaSesionId;
          await closeAccount(slug, payload);
        } else {
          const pendientes = (cuenta.pedidos || []).filter((p) => p.order_status !== 'paid' && getPedidoApiId(p));
          await Promise.all(pendientes.map((p) => putEstado(p, 'paid')));
        }
        setSnack({ open: true, msg: 'Cuenta marcada como pagada ✅', severity: 'success' });
      }

      handleClosePayDialog();

      // Log para debugging

      // Esperar un momento para que el backend procese el cambio completamente
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refrescar TODO en paralelo para obtener el estado más reciente
      await Promise.all([
        fetchPedidos(),      // Actualizar pedidos (deberían estar todos 'paid' ahora)
        fetchOpenSessions(), // Actualizar sesiones (deberían estar todas 'closed' ahora)
        fetchMesas(),        // Actualizar mesas (debería estar 'disponible' ahora)
        fetchActiveOrdersForTables() // CRÍTICO: Actualizar pedidos activos para estado de mesas
      ]);

      // Verificar que la mesa se actualizó - hacer una segunda verificación después de un momento
      await new Promise(resolve => setTimeout(resolve, 500));
      const mesasActualizadas = await fetchTables(slug);
      const mesaPagada = mesasActualizadas.find(m => m.number === cuenta.mesaNumber);
      if (mesaPagada?.status !== 'disponible') {
        // Forzar otro refresh después de 2 segundos más
        setTimeout(async () => {
          await fetchMesas();
          await fetchActiveOrdersForTables();
        }, 2000);
      } else {
        // Forzar actualización del componente de mesas
        await fetchMesas();
        await fetchActiveOrdersForTables();
      }
    } catch (err) {
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
      // El nombre del producto del sistema puede estar en:
      // 1. item.product.name (producto real)
      // 2. item.name (campo directo)
      // 3. item.notes (para productos del sistema, el nombre se guarda en notes)
      const prodName = (item?.product?.name || item?.name || item?.notes || '').toUpperCase();
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

  // Validación: no mostrar pedidos sin campos esenciales (evitar cards rotas). Permitir sin mesa (ej. recién creados).
  const isValidPedidoForDisplay = (p) =>
    (p?.documentId || p?.id != null) &&
    (p?.order_status != null && p?.order_status !== '');

  // ---- memos de filtro ----
  const pedidosFiltrados = useMemo(
    () => pedidos
      .filter((p) => isValidPedidoForDisplay(p))
      .filter(pedidoMatchesMesaPartial),
    [pedidos, mesaTokens]
  );
  const pedidosPendientes = useMemo(
    () => pedidosFiltrados
      .filter((p) => p.order_status === 'pending' && !isSystemOrder(p))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), // Más reciente primero
    [pedidosFiltrados]
  );
  const pedidosEnCocina = useMemo(
    () => pedidosFiltrados
      .filter((p) => p.order_status === 'preparing' && !isSystemOrder(p))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), // Más reciente primero
    [pedidosFiltrados]
  );
  const pedidosSistema = useMemo(
    () => pedidosFiltrados.filter((p) => isSystemOrder(p) && isActive(p.order_status)),
    [pedidosFiltrados]
  );
  const pedidosListos = useMemo(
    () => pedidosFiltrados
      .filter((p) => p.order_status === 'served' && !isSystemOrder(p))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)), // Más antiguo primero (FIFO para servir)
    [pedidosFiltrados]
  );
  const cuentasFiltradas = useMemo(
    () => cuentas.filter(cuentaMatchesMesaPartial),
    [cuentas, mesaTokens]
  );

  // Pedidos activos para el grid de mesas: misma fuente que Pendientes/Cocinando (evita que el círculo rojo no aparezca)
  const ordersForGrid = useMemo(() => {
    const unpaid = pedidos.filter(
      (p) =>
        !isSystemOrder(p) &&
        p.order_status !== 'paid' &&
        p.order_status !== 'cancelled'
    );
    const mesaNum = (p) => p.mesaNumber ?? p.mesa_sesion?.mesa?.number ?? null;
    return unpaid
      .filter((p) => mesaNum(p) != null)
      .map((p) => ({
        id: p.id,
        documentId: p.documentId,
        order_status: p.order_status,
        total: p.total,
        createdAt: p.createdAt,
        mesa_sesion: { mesa: { number: mesaNum(p) } },
        mesa: mesaNum(p),
        tableNumber: mesaNum(p),
      }));
  }, [pedidos]);

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
      await fetchActiveOrdersForTables();
      setSnack({
        open: true,
        msg: 'Solicitud atendida ✅',
        severity: 'success'
      });
    } catch (err) {
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
    const mesaNumero = pedido.mesa_sesion?.mesa?.number || pedido.mesaNumber;
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
        <CardContent sx={{ p: { xs: 1.25, sm: 1.5 }, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Chip
              label={`Mesa ${mesaNumero ?? 's/n'}`}
              size="small"
              sx={{
                fontWeight: 600,
                bgcolor: getMesaColor(mesaNumero),
                color: 'white',
                fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                height: 24,
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

          {(() => {
            const { clientLine, commentLine } = parseCustomerNotes(customerNotes);
            if (isPay || (!clientLine && !commentLine)) return null;
            return (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 0.5,
                  mb: 0.75,
                  p: 0.5,
                  bgcolor: '#fff3cd',
                  borderRadius: 1,
                  border: '1.5px solid',
                  borderColor: '#ff9800',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {clientLine && (
                  <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#e65100', fontWeight: 600 }}>
                    {clientLine}
                  </Typography>
                )}
                {commentLine && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, width: '100%' }}>
                    <WarningIcon sx={{ fontSize: '0.875rem', color: '#f57c00', flexShrink: 0, mt: '2px' }} />
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#e65100', fontWeight: 600, flex: 1 }}>
                      {commentLine}
                    </Typography>
                  </Box>
                )}
              </Box>
            );
          })()}

          <Button
            variant="contained"
            color={isWaiterCall ? 'warning' : 'info'}
            onClick={() => handleDismissSystemOrder(pedido)}
            fullWidth
            size="small"
            sx={{
              mt: 1,
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: { xs: '0.8125rem', sm: '0.875rem' },
              py: 0.75,
              px: 1.5,
              minHeight: 36,
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
    const mesaNumero = pedido.mesa_sesion?.mesa?.number || pedido.mesaNumber;
    const flashing = flashIds.has(documentId);

    return (
      <Card
        key={documentId || id}
        sx={{
          mb: 0,
          bgcolor: flashing ? 'warning.light' : 'background.paper',
          transition: 'all 0.2s ease-in-out',
          boxShadow: flashing ? 6 : 1,
          border: flashing ? '2px solid rgba(255,193,7,0.6)' : '1px solid',
          borderColor: flashing ? 'warning.main' : 'divider',
          borderRadius: 2,
          cursor: 'pointer',
          display: 'block',
          width: '100%',
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
          '&:hover': {
            boxShadow: 8,
            bgcolor: flashing ? 'warning.light' : 'rgba(25, 118, 210, 0.04)',
            transform: 'translateY(-2px)',
            borderColor: 'primary.light',
          },
        }}
      >
        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 }, display: 'block', minWidth: 0, overflow: 'hidden' }}>
          {/* Fila: Mesa + hora */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, minWidth: 0 }}>
            <Chip
              label={`Mesa ${mesaNumero ?? 's/n'}`}
              size="small"
              sx={{
                fontWeight: 700,
                bgcolor: getMesaColor(mesaNumero),
                color: 'white',
                fontSize: '0.75rem',
                height: 20,
                maxWidth: '60%',
                '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                '&:hover': { bgcolor: getMesaColor(mesaNumero), opacity: 0.9 },
              }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>
              {formatTime(createdAt)}
            </Typography>
          </Box>

          {(() => {
            const { clientLine, commentLine } = parseCustomerNotes(customerNotes);
            if (!clientLine && !commentLine) return null;
            return (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 0.5,
                  mb: 0.5,
                  p: 0.5,
                  bgcolor: '#fff3cd',
                  borderRadius: 1,
                  border: '1px solid #ff9800',
                  minHeight: 0,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {clientLine && (
                  <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#e65100', fontWeight: 600, width: '100%' }}>
                    {clientLine}
                  </Typography>
                )}
                {commentLine && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, width: '100%', minWidth: 0 }}>
                    <WarningIcon sx={{ fontSize: 16, color: '#f57c00', flexShrink: 0, mt: '2px' }} />
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#e65100', fontWeight: 600, flex: 1 }}>
                      {commentLine}
                    </Typography>
                  </Box>
                )}
              </Box>
            );
          })()}

          {/* Ítems: lista compacta legible (truncar si es muy largo) */}
          {items.length > 0 ? (
            <Box component="ul" sx={{ m: 0, pl: 1.25, py: 0, listStyle: 'none', minWidth: 0 }}>
              {items.map((item) => {
                const prod = item?.product;
                const name = prod?.name || 'Producto sin datos';
                return (
                  <Typography key={item.id} component="li" variant="body2" sx={{ mb: 0.1, fontSize: '0.8125rem', lineHeight: 1.3, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.quantity}x {name}
                  </Typography>
                );
              })}
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
              Sin items detallados
            </Typography>
          )}

          {/* Total + acciones en una fila */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap', minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.875rem', flex: '1 1 auto', minWidth: 0 }}>
              {money(total)}
            </Typography>
            {isHistory ? (
              <Button
                variant="outlined"
                size="small"
                startIcon={<VisibilityIcon sx={{ fontSize: 18 }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  setOrderDetailDialog({ open: true, pedido });
                }}
                sx={{ textTransform: 'none', fontSize: '0.8125rem', py: 0.5, px: 1.5 }}
              >
                Ver detalles
              </Button>
            ) : (
              <>
                <Tooltip title="Ver">
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOrderDetailDialog({ open: true, pedido }); }} sx={{ p: 0.5, color: 'text.secondary' }}>
                    <VisibilityIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                {(order_status === 'pending' || order_status === 'preparing') && (
                  <Tooltip title="Cancelar">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setCancelOrderDialog({ open: true, pedido, reason: '' }); }} sx={{ p: 0.5, color: 'text.secondary' }}>
                      <CancelIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Button
                  variant="contained"
                  color={order_status === 'pending' ? 'primary' : 'success'}
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (order_status === 'pending') marcarComoRecibido(pedido);
                    else if (order_status === 'preparing') setCompleteOrderDialog({ open: true, pedido, staffNotes: '', loading: false });
                  }}
                  sx={{
                    borderRadius: 1.25,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    py: 0.4,
                    px: 1.25,
                    minHeight: 28,
                  }}
                >
                  {order_status === 'pending' ? 'Cocinar' : 'Completado'}
                </Button>
              </>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  };

  // ---- UI ----
  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2, md: 3 },
        overflowX: 'hidden',
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
        '& *': { boxSizing: 'border-box' },
      }}
    >
      {/* Encabezado */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            component="h1"
            sx={(theme) => ({
              fontSize: { xs: 20, sm: 26, md: 28 },
              fontWeight: 600,
              lineHeight: 1.2,
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
          {lastUpdateAt && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Actualizado {lastUpdateAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Typography>
          )}
        </Box>

        <Tooltip title="Refrescar ahora">
          <span>
            <IconButton
              onClick={handleRefresh}
              disabled={refreshing}
              size="small"
              sx={{ mr: 0.5 }}
              aria-label="Refrescar datos"
            >
              {refreshing ? (
                <CircularProgress size={20} />
              ) : (
                <RefreshIcon />
              )}
            </IconButton>
          </span>
        </Tooltip>

        <TextField
          size="small"
          label="Buscar mesa"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ minWidth: { xs: 120, sm: 200 }, maxWidth: { xs: 180, sm: 280 }, borderRadius: 2 }}
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
          placeholder="Ej: 3  |  12"
        />

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => {
              setShowHistoryDrawer(true);
              fetchFullHistory();
            }}
            sx={{ borderRadius: 2, px: 2, py: 1, textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            Historial
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<CleaningServicesIcon />}
            onClick={handleCleanupOldSessions}
            sx={{ borderRadius: 2, px: 2, py: 1, textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
            title="Marcar todos los pedidos como pagados y liberar todas las mesas"
          >
            Limpiar
          </Button>
        </Box>
      </Box>

      {error && <Typography color="error">{error}</Typography>}

      {/* Vista activa - siempre visible */}
      <>
        {/* Sección superior: Pedidos activos */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Sección 1: Pendientes — 3 columnas de pedidos */}
          <Grid item xs={12} md={6}>
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
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
                gap: 1.25,
                alignContent: 'start',
              }}
            >
              {pedidosPendientes.map((pedido) => (
                <Box key={pedido.documentId || pedido.id} sx={{ minHeight: 0, minWidth: 0 }}>
                  {renderPedidoCard(pedido)}
                </Box>
              ))}
            </Box>
          </Grid>

          {/* Sección 2: Cocinando — 3 columnas de pedidos */}
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <RestaurantIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Cocinando ({pedidosEnCocina.length})
              </Typography>
            </Box>
            {pedidosEnCocina.length === 0 && !noResultsPedidos && (
              <Typography variant="body2" color="text.secondary">
                No hay pedidos cocinando
              </Typography>
            )}
            {noResultsPedidos && pedidosEnCocina.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                No hay pedidos cocinando para las mesas buscadas.
              </Typography>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
                gap: 1.25,
                alignContent: 'start',
              }}
            >
              {pedidosEnCocina.map((pedido) => (
                <Box key={pedido.documentId || pedido.id} sx={{ minHeight: 0, minWidth: 0 }}>
                  {renderPedidoCard(pedido)}
                </Box>
              ))}
            </Box>
          </Grid>
        </Grid>

        {/* División visual */}
        <Divider sx={{ my: 3, borderWidth: 2 }} />

        {/* Sección inferior: Grid de mesas */}
        <Box sx={{ mt: 3 }}>
          <TablesStatusGridEnhanced
            tables={mesas}
            // Pedidos activos para estado y badge: misma fuente que Pendientes (ordersForGrid desde pedidos)
            orders={ordersForGrid}
            systemOrders={pedidosSistema}
            openSessions={openSessions}
            onTableClick={(table) => {
              // Abrir modal con detalles de la mesa
              // Obtener el estado más actualizado de la mesa desde el array mesas (fuente de verdad)
              const mesaActual = mesas.find(m => Number(m.number) === Number(table.number)) || table;
              
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
                  ...mesaActual, // Usar mesaActual para tener el status más actualizado
                  ...table, // Mantener otros campos de table
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6">
                Total: {money(
                  payDialog.discount > 0 && !payDialog.closeWithoutPayment
                    ? (payDialog.discountType === 'percent'
                      ? payDialog.cuenta?.total * (1 - payDialog.discount / 100)
                      : Math.max(0, (payDialog.cuenta?.total || 0) - payDialog.discount))
                    : payDialog.cuenta?.total || 0
                )}
              </Typography>
              <Tooltip title="Copiar total">
                <IconButton
                  size="small"
                  onClick={() => {
                    const total = payDialog.discount > 0 && !payDialog.closeWithoutPayment
                      ? (payDialog.discountType === 'percent'
                        ? payDialog.cuenta?.total * (1 - payDialog.discount / 100)
                        : Math.max(0, (payDialog.cuenta?.total || 0) - payDialog.discount))
                      : payDialog.cuenta?.total || 0;
                    navigator.clipboard?.writeText(money(total)).then(() => {
                      setSnack({ open: true, msg: 'Total copiado', severity: 'info' });
                    });
                  }}
                  aria-label="Copiar total"
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
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

              {(() => {
                const { clientLine, commentLine } = parseCustomerNotes(orderDetailDialog.pedido.customerNotes);
                if (!clientLine && !commentLine) return null;
                return (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Notas del cliente:</Typography>
                    {clientLine && <Typography variant="body2" sx={{ display: 'block', mb: commentLine ? 0.5 : 0 }}>{clientLine}</Typography>}
                    {commentLine && (
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                        <WarningIcon sx={{ fontSize: 18, color: '#f57c00', flexShrink: 0, mt: '2px' }} />
                        <Typography variant="body2">{commentLine}</Typography>
                      </Box>
                    )}
                  </Alert>
                );
              })()}

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
        onClose={() => !completeOrderDialog.loading && setCompleteOrderDialog({ open: false, pedido: null, staffNotes: '', loading: false })}
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
            disabled={completeOrderDialog.loading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteOrderDialog({ open: false, pedido: null, staffNotes: '', loading: false })} disabled={completeOrderDialog.loading}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={completeOrderDialog.loading || !completeOrderDialog.pedido}
            onClick={async () => {
              const { pedido, staffNotes } = completeOrderDialog;
              if (!pedido || completeOrderDialog.loading) return;
              setCompleteOrderDialog(prev => ({ ...prev, loading: true }));
              try {
                await marcarComoServido(pedido, staffNotes);
                setCompleteOrderDialog({ open: false, pedido: null, staffNotes: '', loading: false });
              } catch {
                setCompleteOrderDialog(prev => ({ ...prev, loading: false }));
              }
            }}
          >
            {completeOrderDialog.loading ? 'Completando...' : 'Completar'}
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
                          {(() => {
                            const { clientLine, commentLine } = parseCustomerNotes(pedido.customerNotes);
                            if (!clientLine && !commentLine) return null;
                            return (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                {clientLine && <Typography variant="body2" color="text.secondary">{clientLine}</Typography>}
                                {commentLine && (
                                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                                    <WarningIcon sx={{ fontSize: 16, color: '#f57c00', flexShrink: 0, mt: '2px' }} />
                                    <Typography variant="body2" color="text.secondary">{commentLine}</Typography>
                                  </Box>
                                )}
                              </Box>
                            );
                          })()}
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
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ReceiptIcon />}
                        onClick={() => setReceiptDialog({ open: true, data: cuentaToReceiptData(tableDetailDialog.mesa.cuenta) })}
                        sx={{ mt: 2, borderColor: 'rgba(255,255,255,0.8)', color: 'inherit' }}
                      >
                        Ver recibo
                      </Button>
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
                    {(() => {
                      // Obtener el estado REAL de la mesa desde el array mesas (fuente de verdad)
                      const mesaActual = mesas.find(m => Number(m.number) === Number(tableDetailDialog.mesa?.number));
                      const mesaStatus = mesaActual?.status || tableDetailDialog.mesa?.status || 'disponible';
                      
                      console.log(`[Mostrador] Estado de mesa ${tableDetailDialog.mesa?.number}:`, {
                        mesaStatus,
                        tieneOpenSession: openSessions.some((s) => Number(s.mesaNumber) === Number(tableDetailDialog.mesa?.number)),
                        mesaActual: mesaActual
                      });
                      
                      // REGLA SIMPLE: Usar SOLO el status de la mesa como fuente de verdad
                      // Si status === 'ocupada' → mostrar "Liberar Mesa"
                      // Si status === 'disponible' → mostrar "Ocupar Mesa"
                      const isOcupada = mesaStatus === 'ocupada';
                      const isDisponible = mesaStatus === 'disponible';
                      
                      return (
                        <>
                          {/* Botón para LIBERAR mesa si está OCUPADA */}
                          {isOcupada && (
                            <Button
                              variant="contained"
                              color="warning"
                              onClick={() => liberarMesa(tableDetailDialog.mesa.number)}
                              sx={{ mt: 2 }}
                            >
                              Liberar Mesa
                            </Button>
                          )}
                          
                          {/* Botón para OCUPAR mesa si está DISPONIBLE */}
                          {isDisponible && (
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
                      );
                    })()}
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
                      {(() => {
                        const { clientLine, commentLine } = parseCustomerNotes(pedido.customerNotes);
                        if (!clientLine && !commentLine) return null;
                        return (
                          <Box sx={{ mb: 1, p: 1, bgcolor: '#fff3cd', borderRadius: 1, width: '100%', boxSizing: 'border-box' }}>
                            {clientLine && (
                              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: commentLine ? 0.5 : 0 }}>
                                {clientLine}
                              </Typography>
                            )}
                            {commentLine && (
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                                <WarningIcon sx={{ fontSize: 14, color: '#f57c00', flexShrink: 0, mt: '1px' }} />
                                <Typography variant="caption">{commentLine}</Typography>
                              </Box>
                            )}
                          </Box>
                        );
                      })()}
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
          {accountDetailDialog.cuenta && (
            <Button
              variant="contained"
              startIcon={<ReceiptIcon />}
              onClick={() => {
                setReceiptDialog({ open: true, data: cuentaToReceiptData(accountDetailDialog.cuenta) });
              }}
            >
              Ver recibo
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <ReceiptDialog
        open={receiptDialog.open}
        onClose={() => setReceiptDialog({ open: false, data: null })}
        receiptData={receiptDialog.data}
      />

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
            Limpiar mostrador completamente
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Esta acción realizará una limpieza completa del mostrador:
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>Marcará <strong>TODOS</strong> los pedidos del restaurante como pagados</li>
              <li>Liberará <strong>TODAS</strong> las mesas (cerrará todas las sesiones)</li>
              <li>Dejará el mostrador completamente vacío</li>
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
            {cleanupDialog.loading ? 'Limpiando...' : 'Confirmar limpieza completa'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
