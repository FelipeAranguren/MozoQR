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
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import { useCart } from '../context/CartContext';
import { fetchMenus } from '../api/tenant';
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
  const [nombreRestaurante, setNombreRestaurante] = useState('');

  const { items, addItem, removeItem } = useCart();

  useEffect(() => {
    async function loadMenu() {
      try {
        const menus = await fetchMenus(slug);
        if (menus?.restaurantName) setNombreRestaurante(menus.restaurantName);

        const baseApi = (import.meta.env?.VITE_API_URL || '').replace('/api', '');

        // lista de productos (soporta products/productos y respuesta plana o con attributes)
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

        setProductos(productosProcesados);
      } catch (err) {
        console.error('Error cargando menú:', err);
        setProductos([]);
      }
    }

    loadMenu();
  }, [slug]);

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

  // --------- UI
  return (
   <Container
  component="main"
  maxWidth="sm"
  disableGutters
  sx={(theme) => ({
    px: { xs: 1.25, sm: 2 },
    py: { xs: 3, sm: 4 },
    position: 'relative',
    borderRadius: { xs: 0, sm: 3 },
    // color base del fondo del container
    backgroundColor: theme.palette.background.default,
    // sombra difusa para que no se corte tan brusco contra el fondo
    boxShadow:
      theme.palette.mode === 'light'
        ? '0 0 30px 10px rgba(0,0,0,0.04)'
        : '0 0 40px 15px rgba(0,0,0,0.3)',
    // degradado muy sutil que simula una “luz” o “niebla” alrededor
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: '-40px',
      zIndex: -1,
      borderRadius: 'inherit',
      background:
        theme.palette.mode === 'light'
          ? 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)'
          : 'radial-gradient(circle at 50% 0%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
      pointerEvents: 'none',
    },
  })}
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

      {/* Lista de productos */}
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.25, sm: 1.75 },
          width: '100%',
          mt: { xs: 2.5, sm: 3 },
          overflowX: 'hidden', // cinturón de seguridad
        }}
      >
        {productos.map((plato) => {
          const qty = items.find((i) => i.id === plato.id)?.qty || 0;
          return (
            <Card
              key={plato.id}
              elevation={0} // bajamos la dureza de la sombra por defecto
              sx={(theme) => ({
                position: 'relative',
                display: 'flex',
                alignItems: 'stretch',
                gap: { xs: 1, sm: 1.25 },
                p: { xs: 1, sm: 1.25 },
                borderRadius: 3,
                // Fondo con leve degradado para suavizar el corte con el blanco
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
                // Contorno MUY tenue + sombra blanda y expandida (sin “borde” marcado)
                border: `1px solid ${alpha(theme.palette.common.black, 0.06)}`,
                boxShadow:
                  theme.palette.mode === 'light'
                    ? '0 6px 24px rgba(0,0,0,0.06), 0 1px 0 rgba(0,0,0,0.02)'
                    : '0 8px 28px rgba(0,0,0,0.35)',
                flexDirection: 'row',
                // Halo alrededor del card (gradiente hacia fuera) para una transición aún más suave
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
