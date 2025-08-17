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
        const list =
          Array.isArray(menus)
            ? menus.flatMap(m => m.products || [])
            : Array.isArray(menus?.products)
            ? menus.products
            : [];

        const productosProcesados = list.map(p => {
          const raw = p.image;
          const img = raw
            ? (String(raw).startsWith('http') ? raw : (baseApi ? baseApi + raw : raw))
            : PLACEHOLDER;

          return {
            id: p.id,
            nombre: p.name,
            precio: p.price,
            imagen: img,
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
    <Container sx={{ py: 7 }}>
      <Typography variant="h4" gutterBottom textAlign="center">
        Menú de {nombreRestaurante || slug}
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          maxWidth: 520,
          mx: 'auto'
        }}
      >
        {productos.map(plato => (
          <Card
            key={plato.id}
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              p: 2,
              borderRadius: 3,
              boxShadow: 3,
              bgcolor: 'background.paper'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CardMedia
                component="img"
                image={plato.imagen}
                alt={plato.nombre}
                sx={{ width: 88, height: 88, borderRadius: 2, objectFit: 'cover' }}
              />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {plato.nombre}
                </Typography>
                <Typography variant="body2">{money(plato.precio)}</Typography>
              </Box>
            </Box>

            {/* Stepper – 0 +  (usa la misma lógica de carrito) */}
            <QtyStepper
              value={(items.find(i => i.id === plato.id)?.qty) || 0}
              onAdd={() => addItem({ id: plato.id, nombre: plato.nombre, precio: plato.precio })}
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