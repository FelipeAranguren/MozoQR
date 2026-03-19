// src/pages/RestaurantMenu.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CircularProgress,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Skeleton,
  Fade,
  Grow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import { useCart } from '../context/CartContext';
import { fetchMenus, openSession, releaseTableIfNoOrders } from '../api/tenant';
import { fetchTables, fetchTable } from '../api/tables';
import { fetchRestaurant } from '../api/restaurant';
import { http } from '../api/tenant';
import useTableSession from '../hooks/useTableSession';
import StickyFooter from '../components/StickyFooter';
import { devLog } from '../utils/devLog';
import { withRetry } from '../utils/retry';
import MenuProductCard from '../components/MenuProductCard';
import TableSelector from '../components/TableSelector';

const PLACEHOLDER = 'https://via.placeholder.com/600x400?text=No+Image';
const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n) || 0);

// Cards del menú (sin centavos); los totales siguen usando `money` (con centavos).
const moneyNoCents = (n) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

// ---- Helper: convierte Rich Text (Blocks) de Strapi a texto plano
const blocksToText = (blocks) => {
  if (!Array.isArray(blocks)) return '';
  const walk = (nodes) =>
    nodes
      .map((n) => {
        if (typeof n?.text === 'string') return n.text;
        if (Array.isArray(n?.children)) return walk(n.children);
        return '';
      })
      .join('');
  return walk(blocks).replace(/\s+/g, ' ').trim();
};

// ---- Helper: normaliza una media url de Strapi (string | {url} | {data:{attributes:{url}}})
const getMediaUrl = (img, base) => {
  const url =
    typeof img === 'string'
      ? img
      : img?.url
        ? img.url
        : img?.data?.attributes?.url
          ? img.data.attributes.url
          : null;
  if (!url) return null;
  return String(url).startsWith('http') ? url : (base ? base + url : url);
};

export default function RestaurantMenu() {
  const { slug } = useParams();
  const { table, tableSessionId } = useTableSession();
  const navigate = useNavigate();

  const [productos, setProductos] = useState(null);
  const [productosTodos, setProductosTodos] = useState([]);
  const [nombreRestaurante, setNombreRestaurante] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [menuLoadError, setMenuLoadError] = useState(null);
  const [menuRetryKey, setMenuRetryKey] = useState(0);
  const [isTableValid, setIsTableValid] = useState(undefined); // undefined = chequeando, true = ok, false = no existe
  const [sessionReady, setSessionReady] = useState(false); // true cuando openSession completó o no hay mesa
  const [hasMercadoPago, setHasMercadoPago] = useState(false); // desde MetodosPago del restaurante

  const { items, addItem, removeItem } = useCart();
  const [changeTableDialog, setChangeTableDialog] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const availablePollHitsRef = useRef(0);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const base = nombreRestaurante || slug || 'Menú';
    document.title = table ? `${base} | Mesa ${table}` : `${base} | MozoQR`;
    return () => { document.title = 'MozoQR'; };
  }, [nombreRestaurante, slug, table]);

  // Encontrar categoría por id numérico o documentId (Strapi 5 puede devolver uno u otro)
  const findCategoria = (categoriaIdOrDocId) => {
    if (categoriaIdOrDocId == null) return null;
    return categorias.find(
      (c) =>
        c.id === categoriaIdOrDocId ||
        c.documentId === categoriaIdOrDocId ||
        String(c.id) === String(categoriaIdOrDocId)
    ) ?? null;
  };

  // Filtrar productos según búsqueda
  const productosFiltrados = useMemo(() => {
    if (!searchQuery.trim()) return productos || [];
    const query = searchQuery.toLowerCase().trim();
    // Si hay búsqueda, buscar en todos los productos de todas las categorías
    const todosLosProductos = categorias.flatMap((cat) => cat.productos || []);
    return todosLosProductos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(query) ||
        p.descripcion?.toLowerCase().includes(query)
    );
  }, [productos, searchQuery, categorias]);

  // Contar items en carrito por categoría
  const getCategoryItemCount = (categoriaId) => {
    if (!categoriaId) return 0;
    const categoria = findCategoria(categoriaId);
    if (!categoria) return 0;
    return categoria.productos.reduce((sum, prod) => {
      const item = items.find((i) => i.id === prod.id);
      return sum + (item?.qty || 0);
    }, 0);
  };

  // Función para obtener categorías desde Strapi
  const fetchCategorias = async (restaurantSlug) => {
    try {
      const { data } = await withRetry(
        () => http.get(`/restaurants/${restaurantSlug}/menus`),
        { maxRetries: 2, delayMs: 1500 }
      );

      // El endpoint devuelve: { data: { restaurant: {...}, categories: [...] } }
      const categories = data?.data?.categories || [];
      const totalProductos = categories.reduce((sum, cat) => sum + (cat.productos?.length || 0), 0);

      if (categories.length === 0) {
        console.warn('⚠️ No se encontraron categorías en el endpoint namespaced');
        return [];
      }
      
      // Si hay categorías pero ninguna tiene productos, también retornar vacío
      if (totalProductos === 0) {
        console.warn('⚠️ Se encontraron categorías pero ninguna tiene productos disponibles');
        return [];
      }

      // Mapear categorías con sus productos
      const categoriasMapeadas = categories.map((cat) => {
        // Los productos ya vienen en cat.productos (no cat.attributes.productos)
        const productosCat = (cat.productos || []).map((p) => {
          const baseApi = (import.meta.env?.VITE_API_URL || '').replace('/api', '');
          // El endpoint namespaced ya devuelve la URL completa de la imagen si el plan es PRO
          const img = p.image || PLACEHOLDER;
          const descripcion = Array.isArray(p.description)
            ? blocksToText(p.description)
            : typeof p.description === 'string'
              ? p.description
              : '';

          return {
            id: p.id,
            nombre: p.name,
            precio: p.price,
            imagen: img,
            descripcion,
              popular:
                p?.popular ??
                p?.isPopular ??
                p?.esPopular ??
                p?.popularidad ??
                p?.popularidadScore ??
                p?.is_popular,
            categoriaId: cat.id,
          };
        });

        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          productos: productosCat || [],
        };
      });
      return categoriasMapeadas;
    } catch (err) {
      console.error('❌ Error obteniendo categorías desde endpoint namespaced:', err);
      console.error('Status:', err?.response?.status);
      console.error('Response:', err?.response?.data);
      console.error('Message:', err?.message);

      return [];
    }
  };

  // Validar que la mesa exista en la BD cuando viene en la URL (?t=...)
  useEffect(() => {
    let cancelled = false;

    async function validateTable() {
      // Si no hay mesa en la URL, no hay nada que validar
      if (!table || !slug) {
        setIsTableValid(true);
        return;
      }

      try {
        const mesas = await fetchTables(slug);
        const exists = Array.isArray(mesas)
          ? mesas.some((m) => Number(m.number) === Number(table))
          : false;
        if (!cancelled) {
          setIsTableValid(exists);
        }
      } catch (err) {
        console.error('Error validando mesa seleccionada:', err);
        if (!cancelled) {
          setIsTableValid(false);
        }
      }
    }

    validateTable();

    return () => {
      cancelled = true;
    };
  }, [slug, table]);

  // Sin mesa no hay sesión que esperar
  useEffect(() => {
    if (!table || !slug) setSessionReady(true);
    else setSessionReady(false);
  }, [table, slug]);

  // Cuando el cliente abandona el menú, intentamos liberar la mesa si no tiene pedidos activos.
  // Lo hacemos en 3 situaciones:
  // - Unmount del componente (cambio de ruta interno)
  // - beforeunload (cierre de pestaña/ventana o recarga)
  // - visibilitychange → hidden (algunos navegadores matan la pestaña poco después)
  useEffect(() => {
    if (!slug || !table || !tableSessionId) return;

    const payload = { table, tableSessionId };

    const tryRelease = () => {
      try {
        releaseTableIfNoOrders(slug, payload);
      } catch {
        // best-effort: ignorar errores
      }
    };

    const handleBeforeUnload = () => {
      tryRelease();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        tryRelease();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // También al hacer unmount normal del componente
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      tryRelease();
    };
  }, [slug, table, tableSessionId]);

  // Abrir sesión de mesa cuando el cliente entra (marca la mesa como ocupada)
  // Solo habilitamos "Confirmar pedido" cuando openSession termina para evitar error "mesa no asociada"
  useEffect(() => {
    let cancelled = false;

    async function openTableSession(retryCount = 0) {
      if (!table || !slug) return false;
      const maxRetries = 2;

      try {
        devLog(`[RestaurantMenu] Abriendo sesión para Mesa ${table}${retryCount > 0 ? ` (reintento ${retryCount})` : ''}...`);
        const result = await openSession(slug, { table, tableSessionId });
        devLog(`[RestaurantMenu] Sesión abierta para Mesa ${table}`, result);
        if (result?.status === 'ignored' || result?.status === 'partial') {
          console.warn(`[RestaurantMenu] ⚠️ Sesión para Mesa ${table} tuvo estado: ${result.status}`);
        }
        return true;
      } catch (err) {
        if (err?.response?.status === 409) {
          if (retryCount < maxRetries) {
            console.warn(`[RestaurantMenu] Mesa ${table} ocupada (409), reintentando en 1.5s...`);
            await new Promise(r => setTimeout(r, 1500));
            if (!cancelled) return openTableSession(retryCount + 1);
          } else {
            console.warn(`[RestaurantMenu] No se pudo ocupar Mesa ${table} después de ${maxRetries + 1} intentos.`);
            navigate(`/${slug}/menu`);
          }
          return false;
        }
        if (err?.response?.status === 404) {
          console.warn(`[RestaurantMenu] Mesa ${table} no existe (404).`);
          navigate(`/${slug}/menu`);
          return false;
        }
        console.error(`[RestaurantMenu] Error al abrir sesión Mesa ${table}:`, err?.response?.data || err?.message);
        if (retryCount < maxRetries && err?.response?.status !== 403) {
          await new Promise(r => setTimeout(r, 1500));
          if (!cancelled) return openTableSession(retryCount + 1);
        }
        return false;
      }
    }

    if (table && slug) {
      openTableSession().then((ok) => {
        if (!cancelled && ok) setSessionReady(true);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [slug, table, tableSessionId, navigate]);

  // POLLING DE "KICK": Expulsar solo si el staff cerró la sesión desde el mostrador.
  // NO kickear en los primeros 6 segundos: da tiempo al claim y evita falsos positivos.
  useEffect(() => {
    if (!slug || !table || !tableSessionId) return;

    const enteredAt = Date.now();

    const checkIfShouldEject = async () => {
      if ((Date.now() - enteredAt) / 1000 < 6) return;
      try {
        // Método 1: Verificar directamente el estado de la sesión usando tableSessionId
        // Esto es más confiable porque verifica la sesión específica del cliente
        try {
          const { http } = await import('../api/tenant');
          const sesionRes = await http.get(
            `/mesa-sesions?filters[code][$eq]=${encodeURIComponent(tableSessionId)}&publicationState=preview&fields[0]=id&fields[1]=session_status&fields[2]=code&pagination[pageSize]=1`
          );
          const sesiones = sesionRes?.data?.data || [];
          if (sesiones.length > 0) {
            const sesion = sesiones[0];
            const sesionAttrs = sesion.attributes || sesion;
            const sessionStatus = sesionAttrs.session_status || sesion.session_status;
            
            // Si la sesión está cerrada o pagada, expulsar inmediatamente
            if (sessionStatus === 'closed' || sessionStatus === 'paid') {
              devLog(`[RestaurantMenu] KICK: Sesión ${tableSessionId} ${sessionStatus}`);
              navigate(`/${slug}/menu`);
              return;
            }
          } else {
            devLog(`[RestaurantMenu] Sesión ${tableSessionId} no encontrada`);
          }
        } catch (sesionErr) {
          // Si no se puede verificar la sesión (403, 404, etc.), continuar con el método 2
          // Esto es normal si el endpoint requiere autenticación
          if (sesionErr?.response?.status !== 403 && sesionErr?.response?.status !== 404) {
            console.warn("[RestaurantMenu] Error verificando estado de sesión:", sesionErr?.response?.status || sesionErr?.message);
          }
        }

        // Método 2: fallback por estado de mesa.
        // Si por permisos no podemos leer mesa-sesions, igual expulsamos cuando staff libera la mesa.
        // Requerimos 2 lecturas consecutivas en "disponible" para evitar falsos positivos transitorios.
        try {
          const myMesa = await fetchTable(slug, table);
          if (myMesa) {
            const status = String(myMesa.status || '').toLowerCase();
            devLog(`[RestaurantMenu] Mesa ${table} status=${status}`);
            if (status === 'disponible') {
              availablePollHitsRef.current += 1;
              if (availablePollHitsRef.current >= 2) {
                devLog(`[RestaurantMenu] KICK: Mesa ${table} liberada por staff`);
                navigate(`/${slug}/menu`);
                return;
              }
            } else {
              availablePollHitsRef.current = 0;
            }
          }
        } catch (_e) {
          // ignorar
        }
      } catch (err) {
        console.warn("[RestaurantMenu] Error polling table status:", err);
        // NO expulsar si hay error - comportamiento conservador
      }
    };

    availablePollHitsRef.current = 0;
    // Ejecutar inmediatamente y luego cada 10s.
    checkIfShouldEject();
    const interval = setInterval(checkIfShouldEject, 10000);
    return () => clearInterval(interval);
  }, [slug, table, tableSessionId, navigate]);

  useEffect(() => {
    async function loadMenu() {
      setLoading(true);
      setMenuLoadError(null);
      try {
        // Obtener categorías con productos
        const categoriasData = await fetchCategorias(slug);
        setCategorias(categoriasData);

        // Obtener nombre del restaurante desde el endpoint de categorías primero
        let nombreRest = '';
        try {
          const { data } = await http.get(`/restaurants/${slug}/menus`);
          if (data?.data?.restaurant?.name) {
            nombreRest = data.data.restaurant.name;
            setNombreRestaurante(nombreRest);
          }
        } catch (e) {
          console.warn('No se pudo obtener nombre desde endpoint namespaced:', e);
        }

        // Fallback: obtener nombre del restaurante
        if (!nombreRest) {
          try {
            const menus = await fetchMenus(slug);
            if (menus?.restaurantName) {
              setNombreRestaurante(menus.restaurantName);
            }
          } catch (e) {
            console.warn('Error obteniendo nombre del restaurante:', e);
          }
        }

        // Mercado Pago: solo si existe en restaurante.metodos_pagos (provider === 'mercado_pago' y active === true)
        try {
          const rest = await fetchRestaurant(slug);
          setHasMercadoPago(Boolean(rest?.hasMercadoPago));
        } catch (e) {
          console.warn('Error obteniendo métodos de pago del restaurante:', e);
        }

        // Si hay categorías, mostrar todos los productos inicialmente
        if (categoriasData.length > 0) {
          // Mostrar todos los productos de todas las categorías inicialmente
          const todosLosProductos = categoriasData.flatMap((cat) => cat.productos || []);
          setProductosTodos(todosLosProductos);
          setProductos(todosLosProductos);
          setCategoriaSeleccionada(null);
        } else {
          const menus = await fetchMenus(slug);

          // NUEVO: Si fetchMenus nos devuelve categorías reconstruidas, las usamos
          if (menus?.categories && menus.categories.length > 0) {
            // Mapear propiedades de inglés (tenant.js) a español (RestaurantMenu.jsx)
            const categoriasMapeadas = menus.categories.map(cat => ({
              ...cat,
              productos: (cat.productos || []).map(p => {
                const descripcion = Array.isArray(p.description)
                  ? blocksToText(p.description)
                  : typeof p.description === 'string'
                    ? p.description
                    : '';

                return {
                  id: p.id,
                  nombre: p.name, // name -> nombre
                  precio: p.price, // price -> precio
                  imagen: p.image || PLACEHOLDER, // image -> imagen
                  descripcion: descripcion, // description -> descripcion
                  popular:
                    p?.popular ??
                    p?.isPopular ??
                    p?.esPopular ??
                    p?.popularidad ??
                    p?.popularidadScore ??
                    p?.is_popular,
                  categoriaId: cat.id
                };
              })
            }));

            setCategorias(categoriasMapeadas);

            const todosLosProductos = categoriasMapeadas.flatMap((cat) => cat.productos || []);
            setProductosTodos(todosLosProductos);
            setProductos(todosLosProductos);
            setCategoriaSeleccionada(null);
          } else {
            // Si realmente no hay categorías, mostramos lista plana
            const baseApi = (import.meta.env?.VITE_API_URL || '').replace('/api', '');
            const list = Array.isArray(menus)
              ? menus.flatMap((m) => m.products || m.productos || [])
              : menus?.products || menus?.productos || [];

            const productosProcesados = list.map((raw) => {
              const p = raw?.attributes ? { id: raw.id, ...raw.attributes } : (raw || {});
              const img = getMediaUrl(p.image, baseApi) || PLACEHOLDER;
              const descripcion = Array.isArray(p.description)
                ? blocksToText(p.description)
                : typeof p.description === 'string'
                  ? p.description
                  : '';

              return {
                id: p.id,
                nombre: p.name,
                precio: p.price,
                imagen: img,
                descripcion,
                popular:
                  p?.popular ??
                  p?.isPopular ??
                  p?.esPopular ??
                  p?.popularidad ??
                  p?.popularidadScore ??
                  p?.is_popular,
              };
            });

            devLog('Productos del fallback (sin categorías):', productosProcesados.length);
            setProductosTodos(productosProcesados);
            setProductos(productosProcesados);
          }
        }
      } catch (err) {
        console.error('Error cargando menú:', err);
        // Intentar fallback completo
        try {
          const menus = await fetchMenus(slug);
          if (menus?.restaurantName) setNombreRestaurante(menus.restaurantName);

          // Si fetchMenus devuelve categorías (gracias a nuestra mejora), usarlas
          if (menus?.categories && menus.categories.length > 0) {
            setCategorias(menus.categories);
            const todosLosProductos = menus.categories.flatMap((cat) => cat.productos || []);
            setProductosTodos(todosLosProductos);
            setProductos(todosLosProductos);
            devLog('Categorías cargadas desde fallback:', menus.categories.length);
          } else {
            // Fallback antiguo: lista plana
            const baseApi = (import.meta.env?.VITE_API_URL || '').replace('/api', '');
            const list = Array.isArray(menus)
              ? menus.flatMap((m) => m.products || m.productos || [])
              : menus?.products || menus?.productos || [];

            const productosProcesados = list.map((raw) => {
              const p = raw?.attributes ? { id: raw.id, ...raw.attributes } : (raw || {});
              const img = getMediaUrl(p.image, baseApi) || PLACEHOLDER;
              const descripcion = Array.isArray(p.description)
                ? blocksToText(p.description)
                : typeof p.description === 'string'
                  ? p.description
                  : '';

              return {
                id: p.id,
                nombre: p.name,
                precio: p.price,
                imagen: img,
                descripcion,
                popular:
                  p?.popular ??
                  p?.isPopular ??
                  p?.esPopular ??
                  p?.popularidad ??
                  p?.popularidadScore ??
                  p?.is_popular,
              };
            });

            setProductosTodos(productosProcesados);
            setProductos(productosProcesados);
          }
        } catch (fallbackErr) {
          console.error('Error en fallback completo:', fallbackErr);
          setProductos([]);
          setProductosTodos([]);
          setMenuLoadError(fallbackErr?.message || 'No se pudo cargar el menú. Revisá tu conexión.');
        }
      } finally {
        setLoading(false);
      }
    }

    loadMenu();
  }, [slug, menuRetryKey]);

  const retryLoadMenu = () => {
    setMenuLoadError(null);
    setMenuRetryKey((k) => k + 1);
  };

  // Manejar cambio de categoría
  const handleCategoriaClick = (categoriaId) => {
    setCategoriaSeleccionada(categoriaId);
    setSearchQuery(''); // Limpiar búsqueda al cambiar categoría
    const categoria = findCategoria(categoriaId);
    if (categoria) {
      setProductos(categoria.productos || []);
      // Scroll suave a la sección de productos
      setTimeout(() => {
        const productosSection = document.getElementById('productos-section');
        if (productosSection) {
          productosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  // Componente de skeleton loader para productos
  const ProductSkeleton = () => (
    <Card
      elevation={0}
      sx={{
        display: 'flex',
        gap: 1.25,
        p: 1.25,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Skeleton variant="rectangular" width={92} height={92} sx={{ borderRadius: 2 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="text" width="40%" height={20} sx={{ mt: 0.5 }} />
        <Skeleton variant="text" width="100%" height={16} sx={{ mt: 1 }} />
        <Skeleton variant="text" width="80%" height={16} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Skeleton variant="rectangular" width={96} height={36} sx={{ borderRadius: 1 }} />
      </Box>
    </Card>
  );

  // Si hay número de mesa en la URL pero no existe en la BD -> mostrar mensaje de error
  if (table && isTableValid === false) {
    return (
      <Container
        component="main"
        maxWidth="sm"
        disableGutters
        sx={{
          px: { xs: 1.25, sm: 2 },
          py: { xs: 3, sm: 4 },
          textAlign: 'center',
          mt: 8,
        }}
      >
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          La mesa {table} no existe en este restaurante.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Volvé atrás y elegí una mesa válida de la lista.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate(`/${slug}/menu`)}
          sx={{ textTransform: 'none', borderRadius: 999 }}
        >
          Volver a seleccionar mesa
        </Button>
      </Container>
    );
  }

  // Si no hay mesa seleccionada, mostrar el selector de mesas
  if (!table) {
    return <TableSelector />;
  }

  // --------- Estados de carga / vacío
  if (loading && productos === null) {
    return (
      <Container
        component="main"
        maxWidth="sm"
        disableGutters
        sx={{
          px: { xs: 1.25, sm: 2 },
          py: { xs: 3, sm: 4 },
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Skeleton variant="text" width="60%" height={40} sx={{ mx: 'auto', mb: 2 }} />
          <Skeleton variant="text" width="40%" height={20} sx={{ mx: 'auto' }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mb: 3, overflowX: 'auto', pb: 1 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rounded" width={100} height={36} sx={{ flexShrink: 0 }} />
          ))}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.75, mt: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <ProductSkeleton key={i} />
          ))}
        </Box>
      </Container>
    );
  }

  // Mostrar pantalla de "sin restaurante/productos" solo cuando realmente no hay datos (carga inicial).
  // No mostrarla al seleccionar una categoría que tiene 0 productos (ahí se muestra el menú con lista vacía y chips).
  const noDataAtAll = !loading && productos !== null && productos.length === 0 && productosTodos.length === 0;
  if (noDataAtAll) {
    return (
      <Container
        component="main"
        maxWidth="sm"
        disableGutters
        sx={{
          px: { xs: 1.25, sm: 2 },
          py: { xs: 3, sm: 4 },
          textAlign: 'center',
          mt: 8,
        }}
      >
        {menuLoadError ? (
          <>
            <Typography variant="h6" color="error" sx={{ mb: 2 }}>
              Error al cargar el menú
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {menuLoadError}
            </Typography>
            <Button variant="contained" onClick={retryLoadMenu} sx={{ textTransform: 'none' }}>
              Reintentar
            </Button>
          </>
        ) : (
          <Typography variant="h6" color="text.secondary">
            No se encontró el restaurante o no tiene productos disponibles.
          </Typography>
        )}
        <StickyFooter table={table} tableSessionId={tableSessionId} restaurantName={nombreRestaurante} sessionReady={sessionReady} hasMercadoPago={hasMercadoPago} />
      </Container>
    );
  }

  // --------- Helpers de UI
  const renderProductCard = (plato, index, { layout = 'grid' } = {}) => {
    const qty = items.find((i) => i.id === plato.id)?.qty || 0;
    // En "row" forzamos una sola fila por categoría (scroll horizontal),
    // así evitamos que el card salte a otra línea.
    const wrapperClassName = layout === 'row' ? 'w-[260px] flex-shrink-0' : 'w-full';
    return (
      <motion.div
        key={plato.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3, delay: index * 0.04 }}
        whileHover={{ scale: 1.02 }}
        style={{ originX: 0.5 }}
        className={wrapperClassName}
      >
        <MenuProductCard
          producto={plato}
          qty={qty}
          priceFormatted={moneyNoCents(plato.precio)}
          onAdd={() => addItem({ id: plato.id, nombre: plato.nombre, precio: plato.precio })}
          onSub={() => removeItem(plato.id)}
        />
      </motion.div>
    );
  };

  const showingSearch = Boolean(searchQuery.trim());
  const categoriasVisibles =
    categoriaSeleccionada == null
      ? categorias
      : categorias.filter((cat) =>
          [cat.id, cat.documentId, String(cat.id)].includes(
            categoriaSeleccionada
          )
        );

  // --------- UI principal
  return (
    <Box
      sx={{
        width: '100%',
        position: 'relative',
        minHeight: '100vh',
        background: (theme) =>
          theme.palette.mode === 'light'
            ? 'radial-gradient(circle at top left, #e0f2f1 0, #f9fafb 40%, #ffffff 100%)'
            : 'radial-gradient(circle at top left, #0f172a 0, #020617 55%, #000000 100%)',
      }}
    >
      <Box
        sx={(theme) => ({
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            theme.palette.mode === 'light'
              ? 'radial-gradient(circle at 10% 20%, rgba(0,150,136,0.12) 0, transparent 40%), radial-gradient(circle at 90% 10%, rgba(255,159,64,0.12) 0, transparent 45%)'
              : 'radial-gradient(circle at 10% 20%, rgba(34,197,94,0.12) 0, transparent 40%), radial-gradient(circle at 90% 10%, rgba(56,189,248,0.16) 0, transparent 45%)',
          opacity: 0.9,
        })}
      />

      <Container
        component="main"
        maxWidth="sm"
        disableGutters
        sx={{
          position: 'relative',
          zIndex: 1,
          px: { xs: 1.5, sm: 2.5 },
          py: { xs: 2.5, sm: 3.5 },
        }}
      >
        {/* Header */}
        <Box
          sx={(theme) => ({
            mb: 3,
            borderRadius: 4,
            p: 2,
            pb: 2.5,
            background:
              theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #ffffff, #e0f2f1)'
                : 'linear-gradient(135deg, #020617, #0f172a)',
            boxShadow:
              theme.palette.mode === 'light'
                ? '0 18px 45px rgba(15,118,110,0.15)'
                : '0 22px 55px rgba(0,0,0,0.9)',
            position: 'relative',
            overflow: 'hidden',
          })}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'radial-gradient(circle at 0 0, rgba(56,189,248,0.15) 0, transparent 55%)',
            }}
          />
          <Box sx={{ position: 'relative', textAlign: 'left' }}>
            <Typography
              component="h1"
              sx={{
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: 0.4,
                mb: 0.75,
                fontSize: 'clamp(22px, 5vw, 30px)',
                wordBreak: 'break-word',
              }}
            >
              {nombreRestaurante || slug}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                mb: 1.5,
              }}
            >
              Elegí tus platos favoritos, enviá tu pedido y disfrutá en mesa.
            </Typography>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Chip
                label={table ? `Mesa ${table}` : 'Sin mesa seleccionada'}
                color="primary"
                variant="filled"
                size="small"
                sx={{
                  borderRadius: 999,
                  fontWeight: 600,
                  px: 1.25,
                  bgcolor: 'primary.main',
                  color: 'white',
                }}
              />
              {table && (
                <Button
                  size="small"
                  onClick={() =>
                    items.length > 0 ? setChangeTableDialog(true) : navigate(`/${slug}/menu`)
                  }
                  startIcon={<SwapHorizIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.78rem',
                    px: 1,
                    borderRadius: 999,
                    bgcolor: (theme) =>
                      theme.palette.mode === 'light'
                        ? alpha('#ffffff', 0.8)
                        : alpha('#020617', 0.7),
                    boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
                    '&:hover': {
                      bgcolor: (theme) =>
                        theme.palette.mode === 'light'
                          ? alpha('#ffffff', 1)
                          : alpha('#020617', 0.95),
                    },
                  }}
                >
                  Cambiar mesa
                </Button>
              )}
            </Box>
          </Box>
        </Box>

        {/* Barra de búsqueda */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            placeholder="Buscar por nombre o descripción..."
            aria-label="Buscar productos en el menú"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value) {
                const todosLosProductos = categorias.flatMap((cat) => cat.productos || []);
                setProductosTodos(todosLosProductos);
                setProductos(todosLosProductos);
              } else {
                if (categoriaSeleccionada) {
                  const categoria = findCategoria(categoriaSeleccionada);
                  if (categoria) {
                    setProductos(categoria.productos || []);
                  }
                } else {
                  const todosLosProductos = categorias.flatMap((cat) => cat.productos || []);
                  setProductosTodos(todosLosProductos);
                  setProductos(todosLosProductos);
                }
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 999,
                backgroundColor: (theme) =>
                  theme.palette.mode === 'light'
                    ? 'rgba(255,255,255,0.9)'
                    : 'rgba(15,23,42,0.95)',
                boxShadow:
                  '0 10px 30px rgba(15,118,110,0.15)',
                '& fieldset': {
                  borderColor: (theme) => alpha(theme.palette.primary.main, 0.22),
                },
                '&:hover fieldset': {
                  borderColor: (theme) => alpha(theme.palette.primary.main, 0.5),
                },
                '&.Mui-focused fieldset': {
                  borderColor: (theme) => alpha(theme.palette.primary.main, 0.8),
                },
              },
            }}
          />
        </Box>

        {/* Filtro de categorías */}
        {categorias.length > 0 && (
          <Box
            sx={{
              mb: 3,
              display: 'flex',
              gap: 1,
              overflowX: 'auto',
              pb: 1,
              px: { xs: 0.5, sm: 0 },
              scrollbarWidth: 'thin',
              '&::-webkit-scrollbar': {
                height: 6,
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(15,118,110,0.35)',
                borderRadius: 999,
              },
            }}
          >
            <Chip
              label="Todas las categorías"
              onClick={() => {
                setSearchQuery('');
                const todosLosProductos = categorias.flatMap((cat) => cat.productos || []);
                setProductosTodos(todosLosProductos);
                setProductos(todosLosProductos);
                setCategoriaSeleccionada(null);
              }}
              color={categoriaSeleccionada === null ? 'primary' : 'default'}
              sx={{
                bgcolor:
                  categoriaSeleccionada === null ? 'primary.main' : 'rgba(255,255,255,0.9)',
                color: categoriaSeleccionada === null ? 'white' : 'text.primary',
                fontWeight: categoriaSeleccionada === null ? 700 : 500,
                borderRadius: 999,
                px: 1.5,
                boxShadow:
                  categoriaSeleccionada === null
                    ? '0 10px 25px rgba(15,118,110,0.4)'
                    : 'none',
              }}
            />
            {categorias.map((cat) => (
              <Chip
                key={cat.id ?? cat.documentId ?? cat.name}
                label={`${cat.name}${
                  cat.productos && cat.productos.length > 0 ? ` (${cat.productos.length})` : ''
                }`}
                onClick={() => {
                  const id = cat.id ?? cat.documentId;
                  setCategoriaSeleccionada(id);
                  setSearchQuery('');
                  setProductos(cat.productos || []);
                  setTimeout(() => {
                    const productosSection = document.getElementById('productos-section');
                    if (productosSection) {
                      productosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }}
                color={categoriaSeleccionada === (cat.id ?? cat.documentId) ? 'primary' : 'default'}
                sx={{
                  bgcolor:
                    categoriaSeleccionada === (cat.id ?? cat.documentId)
                      ? 'primary.main'
                      : 'rgba(255,255,255,0.9)',
                  color:
                    categoriaSeleccionada === (cat.id ?? cat.documentId)
                      ? 'white'
                      : 'text.primary',
                  fontWeight:
                    categoriaSeleccionada === (cat.id ?? cat.documentId) ? 700 : 500,
                  borderRadius: 999,
                  px: 1.5,
                }}
              />
            ))}
          </Box>
        )}

        {/* Indicador de resultados de búsqueda */}
        {showingSearch && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {productosFiltrados.length === 0
                ? 'No se encontraron productos.'
                : `${productosFiltrados.length} producto${
                    productosFiltrados.length !== 1 ? 's' : ''
                  } encontrado${
                    productosFiltrados.length !== 1 ? 's' : ''
                  } para tu búsqueda.`}
            </Typography>
          </Box>
        )}

        {/* Lista de productos */}
        <Box id="productos-section" sx={{ pb: 2 }}>
          <AnimatePresence mode="wait">
            {showingSearch ? (
              productosFiltrados.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Box
                    sx={{
                      textAlign: 'center',
                      py: 6,
                      px: 2,
                    }}
                  >
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No se encontraron productos
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Probá con otro nombre o descripción.
                    </Typography>
                  </Box>
                </motion.div>
              ) : (
                <motion.div
                  key="search-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 gap-4"
                >
                  {productosFiltrados.map((plato, index) =>
                    renderProductCard(plato, index, { layout: 'grid' })
                  )}
                </motion.div>
              )
            ) : (
              <motion.div
                key="categories-layout"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
              >
                {categoriasVisibles.map((categoria) => (
                  <Box key={categoria.id ?? categoria.documentId ?? categoria.name}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        mb: 1.5,
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 800,
                          fontSize: 18,
                        }}
                      >
                        {categoria.name}
                      </Typography>
                      {categoria.productos && categoria.productos.length > 0 && (
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', fontWeight: 500 }}
                        >
                          {categoria.productos.length} opción
                          {categoria.productos.length !== 1 ? 'es' : ''}
                        </Typography>
                      )}
                    </Box>

                    {categoria.productos && categoria.productos.length > 0 ? (
                      <Box className="flex flex-nowrap items-stretch gap-4 overflow-x-auto pb-1">
                        {categoria.productos.map((plato, index) =>
                          renderProductCard(plato, index, { layout: 'row' })
                        )}
                      </Box>
                    ) : (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontStyle: 'italic', mb: 0.5 }}
                      >
                        No hay productos disponibles en esta categoría por el momento.
                      </Typography>
                    )}
                  </Box>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        {/* Espacio en blanco para que el StickyFooter no tape productos al scrollear */}
        <Box sx={{ height: { xs: 150, sm: 160 } }} />

        {/* Footer con resumen y confirmación */}
        <StickyFooter
          table={table}
          tableSessionId={tableSessionId}
          restaurantName={nombreRestaurante}
          sessionReady={sessionReady}
          hasMercadoPago={hasMercadoPago}
        />

        {/* Diálogo confirmar cambiar mesa */}
        <Dialog
          open={changeTableDialog}
          onClose={() => setChangeTableDialog(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Cambiar de mesa</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              Tenés {items.length} {items.length === 1 ? 'ítem' : 'ítems'} en el carrito. Al cambiar
              de mesa se pierde el carrito actual. ¿Continuar?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setChangeTableDialog(false)}>Cancelar</Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                setChangeTableDialog(false);
                navigate(`/${slug}/menu`);
              }}
            >
              Cambiar mesa
            </Button>
          </DialogActions>
        </Dialog>
      </Container>

      {showScrollTop && (
        <Fab
          size="small"
          color="primary"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          sx={{
            position: 'fixed',
            bottom: 100,
            right: 16,
            zIndex: 1200,
          }}
          aria-label="Volver arriba"
        >
          <KeyboardArrowUpIcon />
        </Fab>
      )}
    </Box>
  );
}