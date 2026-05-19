import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Typography, List, ListItem, IconButton, Chip, Stack, CircularProgress, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteIcon from '@mui/icons-material/Delete';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { fetchProducts } from '../api/menu';
import { openSession } from '../api/tenant';
import { staffAddOrderItem, staffCreateOrder } from '../api/staffOrders';

const EDITABLE = ['pending', 'preparing', 'served'];
const STATUS_PRIORITY = { pending: 0, preparing: 1, served: 2 };

export function pickEditablePedido(pedidos = []) {
  const editable = (pedidos || []).filter((p) => EDITABLE.includes(String(p.order_status || '').toLowerCase()));
  if (!editable.length) return null;
  editable.sort((a, b) => {
    const pa = STATUS_PRIORITY[a.order_status] ?? 9;
    const pb = STATUS_PRIORITY[b.order_status] ?? 9;
    if (pa !== pb) return pa - pb;
    return Number(b.id) - Number(a.id);
  });
  return editable[0];
}

function resolveTableSessionId(mesaNumber, pedidos) {
  for (const p of pedidos || []) {
    const code = p?.mesa_sesion?.code;
    if (code) return String(code);
  }
  return `staff_${mesaNumber}_${Date.now()}`;
}

/**
 * Diálogo para cargar productos manualmente a la cuenta de una mesa (Mostrador).
 */
export default function StaffTableAddProducts({
  slug,
  mesaNumber,
  pedidos = [],
  mesaStatus,
  open,
  onClose,
  onDone,
  onSnack,
}) {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);

  const targetPedido = useMemo(() => pickEditablePedido(pedidos), [pedidos]);

  useEffect(() => {
    if (!open || !slug) return;
    setCart([]);
    setSearch('');
    setLoadingProducts(true);
    fetchProducts(slug)
      .then((list) => setProducts(Array.isArray(list) ? list.filter((p) => p.available !== false) : []))
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [open, slug]);

  const filtered = products.filter((p) =>
    !search || String(p.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const changeQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((c) => (c.product.id === productId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const cartTotal = cart.reduce(
    (s, c) => s + (Number(c.product.price) || 0) * c.quantity,
    0
  );

  const handleConfirm = async () => {
    if (!cart.length || mesaNumber == null) return;
    setBusy(true);
    try {
      const items = cart.map((c) => ({
        productId: c.product.id,
        quantity: c.quantity,
      }));

      if (targetPedido?.id) {
        let last = targetPedido;
        for (const it of items) {
          last = await staffAddOrderItem(slug, targetPedido.id, it);
        }
        onSnack?.(`Agregado al pedido #${targetPedido.id}`, 'success');
        await onDone?.(last);
      } else {
        const tableSessionId = resolveTableSessionId(mesaNumber, pedidos);
        if (mesaStatus === 'disponible') {
          await openSession(slug, { table: mesaNumber, tableSessionId });
        }
        const created = await staffCreateOrder(slug, {
          table: mesaNumber,
          tableSessionId,
          items,
          notes: 'Carga manual (staff)',
        });
        onSnack?.(`Pedido #${created?.id || ''} creado en mesa ${mesaNumber}`, 'success');
        await onDone?.(created);
      }
      onClose?.();
    } catch (e) {
      onSnack?.(e?.response?.data?.error?.message || e?.message || 'No se pudo agregar', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        Agregar a la cuenta — Mesa {mesaNumber}
      </DialogTitle>
      <DialogContent dividers>
        {targetPedido ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Los productos se suman al pedido #{targetPedido.id} (
            {targetPedido.order_status === 'pending' ? 'pendiente' : targetPedido.order_status === 'preparing' ? 'en cocina' : 'servido'}
            ).
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No hay pedido abierto: se creará uno nuevo en esta mesa.
            {mesaStatus === 'disponible' && ' La mesa se marcará como ocupada.'}
          </Alert>
        )}

        <TextField
          fullWidth
          size="small"
          label="Buscar producto"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2 }}
        />

        {loadingProducts ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <List dense sx={{ maxHeight: 220, overflow: 'auto', mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            {filtered.slice(0, 50).map((p) => (
              <ListItem
                key={p.id}
                secondaryAction={
                  <IconButton edge="end" size="small" onClick={() => addToCart(p)} disabled={busy}>
                    <AddIcon />
                  </IconButton>
                }
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap>{p.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(p.price || 0)}
                  </Typography>
                </Box>
              </ListItem>
            ))}
            {!filtered.length && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                Sin productos
              </Typography>
            )}
          </List>
        )}

        {cart.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              En esta carga ({cart.length})
            </Typography>
            <Stack spacing={0.5}>
              {cart.map((c) => (
                <Box
                  key={c.product.id}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}
                >
                  <IconButton size="small" onClick={() => changeQty(c.product.id, -1)} disabled={busy}>
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {c.quantity}x {c.product.name}
                  </Typography>
                  <IconButton size="small" onClick={() => changeQty(c.product.id, 1)} disabled={busy}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => setCart((prev) => prev.filter((x) => x.product.id !== c.product.id))}
                    disabled={busy}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>
            <Chip
              icon={<ShoppingCartIcon />}
              label={`Subtotal: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cartTotal)}`}
              sx={{ mt: 1 }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={busy || !cart.length}
          onClick={handleConfirm}
        >
          {busy ? 'Guardando…' : 'Agregar a la cuenta'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
