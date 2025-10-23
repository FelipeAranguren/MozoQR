// src/pages/RestaurantMenu.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Container, Typography, Card, CardMedia, CircularProgress
} from '@mui/material';

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
    nodes.map((n) => {
      if (typeof n?.text === 'string') return n.text;
      if (Array.isArray(n?.children)) return walk(n.children);
      return '';
    }).join('');
  return walk(blocks).replace(/\s+/g, ' ').trim();
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
const list =
  Array.isArray(menus)
    ? menus.flatMap(m => (m.products || m.productos || []))
    : (menus?.products || menus?.productos || []);

// helper: arma URL de imagen desde string, {url} o {data:{attributes:{url}}}
const getMediaUrl = (img, base) => {
  const url =
    typeof img === 'string' ? img
    : img?.url ? img.url
    : img?.data?.attributes?.url ? img.data.attributes.url
    : null;
  if (!url) return null;
  return String(url).startsWith('http') ? url : (base ? base + url : url);
};

// convierte Rich Text (Blocks) a texto plano
const blocksToTextLocal = (blocks) => {
  if (!Array.isArray(blocks)) return '';
  const read = (nodes) =>
    nodes.map(n => {
      if (typeof n?.text === 'string') return n.text;
      if (Array.isArray(n?.children)) return read(n.children);
      return '';
    }).join('');
  return read(blocks).replace(/\s+/g, ' ').trim();
};

const productosProcesados = list.map(raw => {
  // normaliza producto (Strapi puede devolver {id,attributes:{...}} o plano)
  const p = raw?.attributes ? { id: raw.id, ...raw.attributes } : (raw || {});
  const img = getMediaUrl(p.image, baseApi) || PLACEHOLDER;

  const descripcion =
    Array.isArray(p.description) ? blocksToTextLocal(p.description)
    : (typeof p.description === 'string' ? p.description : '');

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

  if (productos === null) {
    return (
      <Container sx={{ textAlign: 'center', mt: 8 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (productos.length === 0) {
    return (
      <Container sx={{ textAlign: 'center', mt: 8 }}>
        <Typography variant="h6">
          No se encontró el restaurante o no tiene productos disponibles.
        </Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ py: { xs: 4, md: 7 } }}>
      {/* Encabezado minimal elegante */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography
          component="h1"
          sx={(theme) => ({
            fontSize: { xs: 26, sm: 32, md: 42 },
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: 0.5,
            fontFamily: theme.typography.fontFamily,
            color: 'text.primary',
            mb: 1,
          })}
        >
          Menú de{' '}
          <Box component="span" sx={{ fontWeight: 700 }}>
            {nombreRestaurante || slug}
          </Box>
        </Typography>

        {/* Divisor hairline + pill corto */}
        <Box
          sx={(theme) => ({
            width: 120,
            height: 2,
            mx: 'auto',
            borderRadius: 999,
            background:
              theme.palette.mode === 'light'
                ? 'rgba(0,0,0,0.12)'
                : 'rgba(255,255,255,0.24)',
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
          sx={{ color: 'text.secondary', letterSpacing: 1, textTransform: 'uppercase', mt: 1.5 }}
        >
          Elegí tus platos favoritos
        </Typography>
      </Box>

      {/* Lista de productos */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          maxWidth: 520,
          mx: 'auto',
          mt: 3,
        }}
      >
        {productos.map((plato) => (
          <Card
            key={plato.id}
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              p: 2.25,
              borderRadius: 3,
              boxShadow: 3,
              bgcolor: 'background.paper',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flex: 1,
                minWidth: 0,
              }}
            >
              <CardMedia
                component="img"
                image={plato.imagen}
                alt={plato.nombre}
                sx={{
                  width: 88,
                  height: 88,
                  borderRadius: 2,
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />

              <Box sx={{ minWidth: 0 }}>
                {/* Nombre + precio en la misma línea */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 1,
                    flexWrap: 'wrap',
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {plato.nombre}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    · {money(plato.precio)}
                  </Typography>
                </Box>

                {/* Separador fino */}
                <Box sx={{ height: 2, width: 36, bgcolor: 'divider', borderRadius: 1, my: 0.5 }} />

                {/* Descripción breve */}
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {plato.descripcion || null}
                </Typography>
              </Box>
            </Box>

            {/* Stepper */}
            <QtyStepper
              value={(items.find((i) => i.id === plato.id)?.qty) || 0}
              onAdd={() =>
                addItem({ id: plato.id, nombre: plato.nombre, precio: plato.precio })
              }
              onSub={() => removeItem(plato.id)}
            />
          </Card>
        ))}
      </Box>

      {/* Footer con resumen y confirmación */}
      <StickyFooter table={table} tableSessionId={tableSessionId} />
    </Container>
  );
}
