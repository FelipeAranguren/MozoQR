// src/pages/RestaurantMenu.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import { useCart } from '../context/CartContext';
import { fetchMenus } from '../api/tenant';
import { http } from '../api/tenant';
import useTableSession from '../hooks/useTableSession';
import StickyFooter from '../components/StickyFooter';
import QtyStepper from '../components/QtyStepper';

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

  const [productos, setProductos] = useState(null);
  const [productosTodos, setProductosTodos] = useState([]);
  const [nombreRestaurante, setNombreRestaurante] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);

  const { items, addItem, removeItem } = useCart();

  // Función para obtener categorías desde Strapi
  const fetchCategorias = async (restaurantSlug) => {
    // Primero intentar el endpoint namespaced (público)
    try {
      const { data } = await http.get(`/restaurants/${restaurantSlug}/menus`);
      console.log('✅ Response from /restaurants/menus:', data);
      
      const categories = data?.data?.categories || [];
      console.log('Categories found:', categories.length, categories);
      
      if (categories.length === 0) {
        console.warn('⚠️ No se encontraron categorías en el endpoint namespaced');
        return [];
      }
      
      // Mapear categorías con sus productos
      const categoriasMapeadas = categories.map((cat) => {
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
          productos: productosCat,
        };
      });

      console.log('Mapped categories:', categoriasMapeadas);
      return categoriasMapeadas;
      } catch (err) {
        console.error('❌ Error obteniendo categorías desde endpoint namespaced:', err);
        console.error('Status:', err?.response?.status);
        console.error('Response:', err?.response?.data);
        console.error('Message:', err?.message);
        
        // No usamos fallback directo a /categorias porque requiere permisos
        // El endpoint namespaced es el único que debería funcionar
        console.warn('⚠️ El endpoint /restaurants/:slug/menus debería ser público. Verifica:');
        console.warn('1. Que el restaurante con slug "' + restaurantSlug + '" exista y esté publicado');
        console.warn('2. Que las categorías estén asociadas a ese restaurante');
        console.warn('3. Que las categorías estén publicadas (publishedAt no null)');
        console.warn('4. URL del endpoint:', `${http.defaults.baseURL}/restaurants/${restaurantSlug}/menus`);
        
        return [];
      }
  };

  useEffect(() => {
    async function loadMenu() {
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

        // Si hay categorías, seleccionar la primera automáticamente
        if (categoriasData.length > 0) {
          const primeraCategoria = categoriasData[0];
          setCategoriaSeleccionada(primeraCategoria.id);
          
          // Establecer productos de la primera categoría
          const productosPrimera = primeraCategoria.productos || [];
          setProductosTodos(productosPrimera);
          setProductos(productosPrimera);
          console.log('Primera categoría seleccionada:', primeraCategoria.name, 'con', productosPrimera.length, 'productos');
        } else {
          // Fallback: usar el método anterior si no hay categorías
          console.log('No hay categorías, usando fallback de fetchMenus');
          const menus = await fetchMenus(slug);
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

          console.log('Productos del fallback:', productosProcesados.length);
          setProductosTodos(productosProcesados);
          setProductos(productosProcesados);
        }
      } catch (err) {
        console.error('Error cargando menú:', err);
        // Intentar fallback completo
        try {
          const menus = await fetchMenus(slug);
          if (menus?.restaurantName) setNombreRestaurante(menus.restaurantName);
          
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
        } catch (fallbackErr) {
          console.error('Error en fallback completo:', fallbackErr);
          setProductos([]);
          setProductosTodos([]);
        }
      }
    }

    loadMenu();
  }, [slug]);

  // Manejar cambio de categoría
  const handleCategoriaClick = (categoriaId) => {
    setCategoriaSeleccionada(categoriaId);
    const categoria = categorias.find((c) => c.id === categoriaId);
    if (categoria) {
      setProductos(categoria.productos || []);
    }
  };

  // --------- Estados de carga / vacío
  if (productos === null) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center', width: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (productos.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', mt: 8, px: 2, width: '100%' }}>
        <Typography variant="h6">
          No se encontró el restaurante o no tiene productos disponibles.
        </Typography>
      </Box>
    );
  }

  // --------- UI principal
  return (
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
        '&::before': { display: 'none' }, // sin halo ni degradado
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

      {/* Botones de categorías */}
      {categorias.length > 0 ? (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            justifyContent: 'center',
            mt: 3,
            mb: 2,
            px: { xs: 1, sm: 0 },
          }}
        >
          {categorias.map((categoria) => (
            <Button
              key={categoria.id}
              onClick={() => handleCategoriaClick(categoria.id)}
              variant={categoriaSeleccionada === categoria.id ? 'contained' : 'outlined'}
              sx={{
                minWidth: 'auto',
                px: 2,
                py: 0.75,
                borderRadius: 3,
                textTransform: 'none',
                fontWeight: categoriaSeleccionada === categoria.id ? 600 : 500,
                fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                boxShadow: categoriaSeleccionada === categoria.id ? 2 : 0,
                '&:hover': {
                  boxShadow: categoriaSeleccionada === categoria.id ? 4 : 1,
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              {categoria.name}
            </Button>
          ))}
        </Box>
      ) : (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No hay categorías disponibles
          </Typography>
        </Box>
      )}

      {/* Lista de productos */}
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.25, sm: 1.75 },
          width: '100%',
          mt: { xs: 2.5, sm: 3 },
          overflowX: 'hidden',
        }}
      >
        {productos.map((plato) => {
          const qty = items.find((i) => i.id === plato.id)?.qty || 0;
          return (
            <Card
              key={plato.id}
              elevation={0}
              sx={(theme) => ({
                position: 'relative',
                display: 'flex',
                alignItems: 'stretch',
                gap: { xs: 1, sm: 1.25 },
                p: { xs: 1, sm: 1.25 },
                borderRadius: 3,
                background:
                  theme.palette.mode === 'light'
                    ? `linear-gradient(180deg, ${theme.palette.common.white} 0%, ${alpha(
                        theme.palette.common.white,
                        0.94
                      )} 100%)`
                    : `linear-gradient(180deg, ${alpha('#1e1e1e', 1)} 0%, ${alpha(
                        '#1e1e1e',
                        0.92
                      )} 100%)`,
                border: `1px solid ${alpha(theme.palette.common.black, 0.06)}`,
                boxShadow:
                  theme.palette.mode === 'light'
                    ? '0 6px 24px rgba(0,0,0,0.06), 0 1px 0 rgba(0,0,0,0.02)'
                    : '0 8px 28px rgba(0,0,0,0.35)',
                flexDirection: 'row',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: -2,
                  borderRadius: 'inherit',
                  pointerEvents: 'none',
                  background:
                    theme.palette.mode === 'light'
                      ? `radial-gradient(120% 100% at 50% -10%, ${alpha(
                          theme.palette.primary.main,
                          0.06
                        )} 0%, rgba(0,0,0,0) 60%)`
                      : `radial-gradient(120% 100% at 50% -10%, ${alpha(
                          theme.palette.primary.light,
                          0.12
                        )} 0%, rgba(0,0,0,0) 60%)`,
                },
              })}
            >
              {/* Imagen */}
              <Box
                sx={{
                  width: { xs: 76, sm: 92 },
                  flexShrink: 0,
                  borderRadius: 2,
                  overflow: 'hidden',
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
                  }}
                />
              </Box>

              {/* Texto */}
              <CardContent sx={{ p: 0, flex: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 0.75,
                    flexWrap: 'wrap',
                    mb: 0.5,
                    minWidth: 0,
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    noWrap
                    sx={{ fontWeight: 700, fontSize: { xs: 16, sm: 18 }, minWidth: 0 }}
                    title={plato.nombre}
                  >
                    {plato.nombre}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    · {money(plato.precio)}
                  </Typography>
                </Box>

                <Box sx={{ height: 2, width: 36, bgcolor: 'divider', borderRadius: 1, mb: 0.5 }} />

                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                  title={plato.descripcion}
                >
                  {plato.descripcion || ''}
                </Typography>
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
                  minWidth: { xs: 80, sm: 96 },
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
          );
        })}
      </Box>

      {/* espacio para que el StickyFooter no tape contenido */}
      <Box height={{ xs: 64, sm: 80 }} />

      {/* Footer con resumen y confirmación */}
      <StickyFooter table={table} tableSessionId={tableSessionId} />
    </Container>
  );
}