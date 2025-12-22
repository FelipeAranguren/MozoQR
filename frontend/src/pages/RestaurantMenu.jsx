// src/pages/RestaurantMenu.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardMedia,
  CircularProgress,
  CardContent,
  CardActions,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Skeleton,
  Fade,
  Grow,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import { useCart } from '../context/CartContext';
import { fetchMenus, openSession } from '../api/tenant';
import { fetchTables, fetchTable } from '../api/tables';
import { http } from '../api/tenant';
import useTableSession from '../hooks/useTableSession';
import StickyFooter from '../components/StickyFooter';
import QtyStepper from '../components/QtyStepper';
import TableSelector from '../components/TableSelector';

const PLACEHOLDER = 'https://via.placeholder.com/600x400?text=No+Image';
const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n) || 0);

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
  const [isTableValid, setIsTableValid] = useState(undefined); // undefined = chequeando, true = ok, false = no existe

  const { items, addItem, removeItem } = useCart();

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
    const categoria = categorias.find((c) => c.id === categoriaId);
    if (!categoria) return 0;
    return categoria.productos.reduce((sum, prod) => {
      const item = items.find((i) => i.id === prod.id);
      return sum + (item?.qty || 0);
    }, 0);
  };

  // Función para obtener categorías desde Strapi
  const fetchCategorias = async (restaurantSlug) => {
    // Primero intentar el endpoint namespaced (público)
    try {
      const { data } = await http.get(`/restaurants/${restaurantSlug}/menus`);
      console.log('✅ Response from /restaurants/menus:', data);

      // El endpoint devuelve: { data: { restaurant: {...}, categories: [...] } }
      const categories = data?.data?.categories || [];
      console.log('Categories found:', categories.length, categories);
      
      // Contar total de productos en todas las categorías
      const totalProductos = categories.reduce((sum, cat) => sum + (cat.productos?.length || 0), 0);
      console.log(`Total productos en categorías: ${totalProductos}`);

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
            categoriaId: cat.id,
          };
        });

        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          productos: productosCat || [],
        };
      }); // No filtrar - mostrar todas las categorías, incluso si no tienen productos

      console.log('Mapped categories:', categoriasMapeadas);
      console.log('Categories with products:', categoriasMapeadas.map(c => ({ name: c.name, count: c.productos.length })));
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

  // Abrir sesión de mesa cuando el cliente entra (marca la mesa como ocupada)
  // IMPORTANTE: Esto debe ejecutarse inmediatamente cuando se selecciona una mesa
  useEffect(() => {
    let cancelled = false;

    async function openTableSession() {
      // Intentar abrir sesión directamente. El backend validará si la mesa existe.
      // No dependemos de isTableValid porque fetchTables puede fallar por permisos en vista pública.
      if (!table || !slug) {
        return;
      }

      try {
        console.log(`[RestaurantMenu] Abriendo sesión para Mesa ${table}...`);
        const result = await openSession(slug, { table, tableSessionId });
        console.log(`[RestaurantMenu] ✅ Sesión abierta para Mesa ${table}:`, result);

        // Verificar que la sesión se abrió correctamente
        if (result?.status === 'ignored' || result?.status === 'partial') {
          console.warn(`[RestaurantMenu] ⚠️ Sesión para Mesa ${table} tuvo estado: ${result.status}. Mensaje: ${result.message}`);
        }
      } catch (err) {
        // Si falla, intentar de nuevo después de un momento
        // Esto es importante porque marca la mesa como ocupada
        if (err?.response?.status === 409) {
          // Mesa no disponible o ya ocupada por otra sesión
          console.warn(`[RestaurantMenu] ⚠️ No se pudo ocupar Mesa ${table} (409). Volviendo al selector...`);
          navigate(`/${slug}/menu`);
          return;
        } else if (err?.response?.status === 404) {
          console.warn(`[RestaurantMenu] ⚠️ Mesa ${table} no existe/configurada (404). Volviendo al selector...`);
          navigate(`/${slug}/menu`);
          return;
        } else {
          console.error(`[RestaurantMenu] ❌ Error al abrir sesión de mesa ${table}:`, err?.response?.data || err?.message || err);
          // Reintentar después de 1 segundo si no fue un error de permisos
          if (err?.response?.status !== 403) {
            setTimeout(async () => {
              if (!cancelled) {
                try {
                  console.log(`[RestaurantMenu] Reintentando abrir sesión para Mesa ${table}...`);
                  await openSession(slug, { table, tableSessionId });
                  console.log(`[RestaurantMenu] ✅ Sesión abierta en reintento para Mesa ${table}`);
                } catch (retryErr) {
                  console.error(`[RestaurantMenu] ❌ Error en reintento para Mesa ${table}:`, retryErr?.response?.data || retryErr?.message);
                }
              }
            }, 1000);
          }
        }
      }
    }

    // Ejecutar inmediatamente cuando se selecciona una mesa (sin delay)
    // Esto asegura que la mesa se marque como ocupada tan pronto como el cliente la selecciona
    if (table && slug) {
      openTableSession();
    }

    return () => {
      cancelled = true;
    };
  }, [slug, table, tableSessionId, navigate]);

  // POLLING DE "KICK": Verificar si el cliente debe ser expulsado
  // REGLA ESTRICTA: SOLO expulsar cuando se cumplen las 3 condiciones:
  // 1. La mesa está disponible
  // 2. NO hay pedidos activos (hasOpenAccount() retorna false)
  // 3. La ÚLTIMA sesión (más reciente) tiene estado 'paid' o 'closed'
  // 
  // IMPORTANTE: Si la sesión más reciente está 'open', NO expulsar (usuario recién entró)
  // Si no se puede determinar el estado de la sesión, NO expulsar (conservador)
  useEffect(() => {
    if (!slug || !table) return;

    const checkIfShouldEject = async () => {
      try {
        // 1. Verificar estado real de la mesa (fuente de verdad del backend)
        const myMesa = await fetchTable(slug, table);
        if (!myMesa) return; // conservador
        if (myMesa.status !== 'disponible') {
          return; // si sigue ocupada/por limpiar, no expulsar
        }

        // 2. Verificar si hay pedidos activos (conservador: si hay, no expulsar)
        const { hasOpenAccount } = await import('../api/tenant');
        const hasActiveOrders = await hasOpenAccount(slug, { table, tableSessionId });
        
        if (hasActiveOrders) {
          // Hay pedidos activos = NO expulsar (usuario está haciendo pedidos)
          return;
        }

        // 3. Mesa está disponible + sin pedidos activos => expulsar (source of truth)
        console.log(`[RestaurantMenu] 🛑 KICK: Mesa ${table} disponible + sin pedidos activos. Redirigiendo al selector...`);
        navigate(`/${slug}/menu`);
      } catch (err) {
        console.warn("[RestaurantMenu] Error polling table status:", err);
        // NO expulsar si hay error - comportamiento conservador
      }
    };

    const interval = setInterval(checkIfShouldEject, 5000); // Check every 5s
    return () => clearInterval(interval);
  }, [slug, table, tableSessionId, navigate]);

  useEffect(() => {
    async function loadMenu() {
      setLoading(true);
      try {
        // Obtener categorías con productos
        const categoriasData = await fetchCategorias(slug);
        console.log('Categorías obtenidas:', categoriasData);
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

        // Si hay categorías, mostrar todos los productos inicialmente
        if (categoriasData.length > 0) {
          // Mostrar todos los productos de todas las categorías inicialmente
          const todosLosProductos = categoriasData.flatMap((cat) => cat.productos || []);
          setProductosTodos(todosLosProductos);
          setProductos(todosLosProductos);
          setCategoriaSeleccionada(null); // Ninguna categoría seleccionada inicialmente
          console.log('✅ Categorías cargadas:', categoriasData.length, 'Total productos:', todosLosProductos.length);
          categoriasData.forEach((cat) => {
            console.log(`  - ${cat.name}: ${cat.productos?.length || 0} productos`);
          });
        } else {
          // Fallback: usar el método anterior si no hay categorías
          console.log('No hay categorías del endpoint namespaced, usando fallback de fetchMenus');
          const menus = await fetchMenus(slug);

          // NUEVO: Si fetchMenus nos devuelve categorías reconstruidas, las usamos
          if (menus?.categories && menus.categories.length > 0) {
            console.log('✅ Usando categorías reconstruidas del fallback:', menus.categories.length);

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
              };
            });

            console.log('Productos del fallback (sin categorías):', productosProcesados.length);
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
            console.log('✅ Categorías cargadas desde fallback:', menus.categories.length);
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
              };
            });

            setProductosTodos(productosProcesados);
            setProductos(productosProcesados);
          }
        } catch (fallbackErr) {
          console.error('Error en fallback completo:', fallbackErr);
          setProductos([]);
          setProductosTodos([]);
        }
      } finally {
        setLoading(false);
      }
    }

    loadMenu();
  }, [slug]);

  // Manejar cambio de categoría
  const handleCategoriaClick = (categoriaId) => {
    setCategoriaSeleccionada(categoriaId);
    setSearchQuery(''); // Limpiar búsqueda al cambiar categoría
    const categoria = categorias.find((c) => c.id === categoriaId);
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
        <Box sx={{ display: 'grid', gap: 1.75, mt: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <ProductSkeleton key={i} />
          ))}
        </Box>
      </Container>
    );
  }

  if (!loading && productos !== null && productos.length === 0) {
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
        <Typography variant="h6" color="text.secondary">
          No se encontró el restaurante o no tiene productos disponibles.
        </Typography>
        <StickyFooter table={table} tableSessionId={tableSessionId} />
      </Container>
    );
  }

  // --------- UI principal
  return (
    <Box sx={{ width: '100%', position: 'relative', minHeight: '100vh' }}>
      <Container
        component="main"
        maxWidth="sm"
        disableGutters
        sx={{
          px: { xs: 1.25, sm: 2 },
          py: { xs: 3, sm: 4 },
          position: 'relative',
          borderRadius: 0,
          bgcolor: 'transparent',
          boxShadow: 'none',
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            component="h1"
            sx={{
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: 0.5,
              mb: 1,
              fontSize: 'clamp(22px, 4.2vw, 32px)',
              wordBreak: 'break-word',
            }}
          >
            Menú de{' '}
            <Box component="span" sx={{ fontWeight: 800 }}>
              {nombreRestaurante || slug}
            </Box>
          </Typography>

          <Box
            sx={(theme) => ({
              width: 120,
              height: 2,
              mx: 'auto',
              borderRadius: 999,
              background:
                theme.palette.mode === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.24)',
              position: 'relative',
              mb: 0.5,
              '&::after': {
                content: '""',
                position: 'absolute',
                left: '50%',
                top: -1,
                transform: 'translateX(-50%)',
                width: 40,
                height: 4,
                borderRadius: 999,
                backgroundColor: theme.palette.primary.main,
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
              },
            })}
          />

          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              letterSpacing: 1,
              textTransform: 'uppercase',
              mt: 1.5,
              display: 'block',
            }}
          >
            Elegí tus platos favoritos
          </Typography>
        </Box>

        {/* Barra de búsqueda */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <TextField
            fullWidth
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value) {
                // Si hay búsqueda, mostrar todos los productos
                const todosLosProductos = categorias.flatMap((cat) => cat.productos || []);
                setProductosTodos(todosLosProductos);
                setProductos(todosLosProductos);
              } else {
                // Si se limpia la búsqueda, volver a la categoría seleccionada
                if (categoriaSeleccionada) {
                  const categoria = categorias.find((c) => c.id === categoriaSeleccionada);
                  if (categoria) {
                    setProductos(categoria.productos || []);
                  }
                } else {
                  // Mostrar todos si no hay categoría seleccionada
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
                borderRadius: 3,
                backgroundColor: (theme) =>
                  theme.palette.mode === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.05)',
                '&:hover': {
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.08)',
                },
                '&.Mui-focused': {
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.08)',
                },
              },
            }}
          />
        </Box>

        {/* Filtro de categorías - Chips similares a ProductsManagement - Siempre visible */}
        {categorias.length > 0 && (
          <Box
            sx={{
              mb: 3,
              mt: -1,
              display: 'flex',
              gap: 1,
              flexWrap: 'wrap',
              overflowX: 'auto',
              pb: 1,
              px: { xs: 0.5, sm: 0 },
              // Asegurar visibilidad
              minHeight: 40,
              alignItems: 'center',
            }}
          >
            <Chip
              label="Todas"
              onClick={() => {
                setSearchQuery(''); // Limpiar búsqueda
                const todosLosProductos = categorias.flatMap((cat) => cat.productos || []);
                setProductosTodos(todosLosProductos);
                setProductos(todosLosProductos);
                setCategoriaSeleccionada(null);
              }}
              color={categoriaSeleccionada === null ? 'primary' : 'default'}
              sx={{
                bgcolor: categoriaSeleccionada === null ? 'primary.main' : 'background.paper',
                color: categoriaSeleccionada === null ? 'white' : 'text.primary',
                fontWeight: categoriaSeleccionada === null ? 600 : 400,
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: categoriaSeleccionada === null ? 'primary.dark' : 'action.hover',
                },
              }}
            />
            {categorias.map((cat) => (
              <Chip
                key={cat.id}
                label={`${cat.name} ${cat.productos && cat.productos.length > 0 ? `(${cat.productos.length})` : ''}`}
                onClick={() => {
                  setCategoriaSeleccionada(cat.id);
                  setSearchQuery(''); // Limpiar búsqueda al cambiar categoría
                  setProductos(cat.productos || []);
                  setTimeout(() => {
                    const productosSection = document.getElementById('productos-section');
                    if (productosSection) {
                      productosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }}
                color={categoriaSeleccionada === cat.id ? 'primary' : 'default'}
                sx={{
                  bgcolor: categoriaSeleccionada === cat.id ? 'primary.main' : 'background.paper',
                  color: categoriaSeleccionada === cat.id ? 'white' : 'text.primary',
                  fontWeight: categoriaSeleccionada === cat.id ? 600 : 400,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: categoriaSeleccionada === cat.id ? 'primary.dark' : 'action.hover',
                  },
                }}
              />
            ))}
          </Box>
        )}

        {/* Navegación de categorías - Tabs horizontales deslizables (Opcional - duplicado con chips arriba) */}
        {false && categorias.length > 0 && !searchQuery && categoriaSeleccionada && (
          <Box
            sx={{
              mt: 2,
              mb: 3,
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: 'background.default',
              pb: 2,
              pt: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                overflowX: 'auto',
                overflowY: 'hidden',
                scrollbarWidth: 'thin',
                '&::-webkit-scrollbar': {
                  height: 6,
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: 3,
                },
                px: { xs: 0.5, sm: 0 },
                pb: 1,
              }}
            >
              {categorias.map((categoria) => {
                const itemCount = getCategoryItemCount(categoria.id);
                const isSelected = categoriaSeleccionada === categoria.id;
                return (
                  <motion.div
                    key={categoria.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ flexShrink: 0 }}
                  >
                    <Button
                      onClick={() => handleCategoriaClick(categoria.id)}
                      variant={isSelected ? 'contained' : 'outlined'}
                      sx={{
                        minWidth: 'auto',
                        px: 2.5,
                        py: 1,
                        borderRadius: 4,
                        textTransform: 'none',
                        fontWeight: isSelected ? 600 : 500,
                        fontSize: '0.9375rem',
                        boxShadow: isSelected ? 3 : 0,
                        position: 'relative',
                        whiteSpace: 'nowrap',
                        '&:hover': {
                          boxShadow: isSelected ? 4 : 2,
                        },
                        transition: 'all 0.2s ease-in-out',
                      }}
                    >
                      {categoria.name}
                      {itemCount > 0 && (
                        <Chip
                          label={itemCount}
                          size="small"
                          sx={{
                            ml: 1,
                            height: 20,
                            minWidth: 20,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : 'primary.main',
                            color: isSelected ? 'inherit' : 'white',
                          }}
                        />
                      )}
                    </Button>
                  </motion.div>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Indicador de resultados de búsqueda */}
        {searchQuery && (
          <Box sx={{ mb: 2, mt: -1 }}>
            <Typography variant="body2" color="text.secondary">
              {productosFiltrados.length === 0
                ? 'No se encontraron productos'
                : `${productosFiltrados.length} producto${productosFiltrados.length !== 1 ? 's' : ''} encontrado${productosFiltrados.length !== 1 ? 's' : ''}`}
            </Typography>
          </Box>
        )}

        {/* Lista de productos */}
        <Box
          id="productos-section"
          sx={{
            display: 'grid',
            gap: { xs: 1.5, sm: 2 },
            width: '100%',
            mt: searchQuery ? 2 : 0,
            overflowX: 'hidden',
            px: { xs: 0, sm: 0.5 }, // Padding lateral para evitar que el sombreado se corte
          }}
        >
          <AnimatePresence mode="wait">
            {productosFiltrados.length === 0 && searchQuery ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 8,
                    px: 2,
                  }}
                >
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No se encontraron productos
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Intenta con otros términos de búsqueda
                  </Typography>
                </Box>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'grid', gap: 'inherit', width: '100%' }}
              >
                {productosFiltrados.map((plato, index) => {
                  const qty = items.find((i) => i.id === plato.id)?.qty || 0;
                  return (
                    <motion.div
                      key={plato.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      whileHover={{ scale: 1.01 }}
                      style={{ originX: 0.5 }}
                    >
                      <Card
                        elevation={0}
                        sx={(theme) => ({
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'stretch',
                          gap: { xs: 1, sm: 1.25 },
                          p: { xs: 1.25, sm: 1.5 },
                          borderRadius: 4,
                          mx: { xs: 0, sm: 0 }, // Margen horizontal para que el sombreado no se corte
                          background:
                            theme.palette.mode === 'light'
                              ? `linear-gradient(180deg, ${theme.palette.common.white} 0%, ${alpha(
                                theme.palette.common.white,
                                0.98
                              )} 100%)`
                              : `linear-gradient(180deg, ${alpha('#1e1e1e', 1)} 0%, ${alpha(
                                '#1e1e1e',
                                0.95
                              )} 100%)`,
                          border: `1px solid ${alpha(theme.palette.common.black, qty > 0 ? 0.12 : 0.06)}`,
                          boxShadow:
                            qty > 0
                              ? theme.palette.mode === 'light'
                                ? '0 8px 32px rgba(0,0,0,0.08), 0 2px 0 rgba(0,0,0,0.03)'
                                : '0 8px 32px rgba(0,0,0,0.4)'
                              : theme.palette.mode === 'light'
                                ? '0 4px 20px rgba(0,0,0,0.04), 0 1px 0 rgba(0,0,0,0.02)'
                                : '0 6px 24px rgba(0,0,0,0.3)',
                          flexDirection: 'row',
                          transition: 'all 0.3s ease',
                          overflow: 'hidden', // Evitar que el sombreado se corte
                          '&:hover': {
                            borderColor: alpha(theme.palette.primary.main, 0.3),
                            boxShadow:
                              theme.palette.mode === 'light'
                                ? '0 12px 40px rgba(0,0,0,0.1), 0 2px 0 rgba(0,0,0,0.04)'
                                : '0 12px 40px rgba(0,0,0,0.5)',
                          },
                        })}
                      >
                        {/* Imagen */}
                        <Box
                          sx={{
                            width: { xs: 90, sm: 110 },
                            flexShrink: 0,
                            borderRadius: 2.5,
                            overflow: 'hidden',
                            position: 'relative',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                          }}
                        >
                          <CardMedia
                            component="img"
                            image={plato.imagen}
                            alt={plato.nombre}
                            loading="lazy"
                            sx={{
                              width: '100%',
                              height: '100%',
                              aspectRatio: '1 / 1',
                              objectFit: 'cover',
                              display: 'block',
                              transition: 'transform 0.3s ease',
                              '&:hover': {
                                transform: 'scale(1.05)',
                              },
                            }}
                          />
                          {qty > 0 && (
                            <Chip
                              label={qty}
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                backgroundColor: 'primary.main',
                                color: 'white',
                                fontWeight: 700,
                                height: 24,
                                minWidth: 24,
                                fontSize: '0.75rem',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                              }}
                            />
                          )}
                        </Box>

                        {/* Texto */}
                        <CardContent sx={{ p: 0, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 1,
                              flexWrap: 'wrap',
                              mb: 0.75,
                              minWidth: 0,
                            }}
                          >
                            <Typography
                              variant="subtitle1"
                              sx={{
                                fontWeight: 700,
                                fontSize: { xs: 17, sm: 19 },
                                minWidth: 0,
                                lineHeight: 1.3,
                              }}
                              title={plato.nombre}
                            >
                              {plato.nombre}
                            </Typography>
                          </Box>

                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              mb: 1,
                            }}
                          >
                            <Typography
                              variant="h6"
                              sx={{
                                fontWeight: 700,
                                color: 'primary.main',
                                fontSize: { xs: 16, sm: 18 },
                              }}
                            >
                              {money(plato.precio)}
                            </Typography>
                            <Box
                              sx={{
                                height: 3,
                                width: 24,
                                bgcolor: 'divider',
                                borderRadius: 1.5,
                              }}
                            />
                          </Box>

                          {plato.descripcion && (
                            <Typography
                              variant="body2"
                              sx={{
                                color: 'text.secondary',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                                lineHeight: 1.5,
                                flex: 1,
                              }}
                              title={plato.descripcion}
                            >
                              {plato.descripcion}
                            </Typography>
                          )}
                        </CardContent>

                        {/* Stepper */}
                        <CardActions
                          sx={{
                            p: 0,
                            ml: { xs: 0.5, sm: 1 },
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 0.5,
                            flexShrink: 0,
                            minWidth: { xs: 85, sm: 100 },
                          }}
                        >
                          <QtyStepper
                            value={qty}
                            onAdd={() =>
                              addItem({ id: plato.id, nombre: plato.nombre, precio: plato.precio })
                            }
                            onSub={() => removeItem(plato.id)}
                          />
                        </CardActions>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        {/* espacio para que el StickyFooter no tape contenido */}
        <Box height={{ xs: 64, sm: 80 }} />

        {/* Footer con resumen y confirmación */}
        <StickyFooter table={table} tableSessionId={tableSessionId} />
      </Container>
    </Box>
  );
}