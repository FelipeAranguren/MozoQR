import React, { useEffect, useState } from 'react';
import {
  Box, Button, IconButton, List, ListItem, TextField, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteIcon from '@mui/icons-material/Delete';
import { fetchProducts } from '../api/menu';
import {
  staffAddOrderItem,
  staffUpdateOrderItem,
  staffDeleteOrderItem,
} from '../api/staffOrders';

const EDITABLE = ['pending', 'preparing', 'served'];

export default function StaffOrderItemEditor({ slug, pedido, onUpdated, onSnack }) {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState(1);

  const editable = pedido && EDITABLE.includes(pedido.order_status);

  useEffect(() => {
    if (!slug || !addOpen) return;
    setLoadingProducts(true);
    fetchProducts(slug)
      .then((list) => setProducts(Array.isArray(list) ? list : []))
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [slug, addOpen]);

  const refresh = async (updated) => {
    if (onUpdated) onUpdated(updated);
  };

  const handleAdd = async () => {
    if (!selectedProduct || !pedido?.id) return;
    setBusy(true);
    try {
      const updated = await staffAddOrderItem(slug, pedido.id, {
        productId: selectedProduct.id,
        quantity: qty,
      });
      await refresh(updated);
      onSnack?.('Producto agregado', 'success');
      setAddOpen(false);
      setSelectedProduct(null);
      setQty(1);
      setSearch('');
    } catch (e) {
      onSnack?.(e?.response?.data?.error?.message || 'Error al agregar', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleQtyChange = async (item, delta) => {
    const next = Number(item.quantity) + delta;
    if (next <= 0) return;
    setBusy(true);
    try {
      const updated = await staffUpdateOrderItem(slug, pedido.id, item.id, { quantity: next });
      await refresh(updated);
    } catch (e) {
      onSnack?.(e?.response?.data?.error?.message || 'Error', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('¿Quitar este producto del pedido?')) return;
    setBusy(true);
    try {
      const updated = await staffDeleteOrderItem(slug, pedido.id, item.id);
      await refresh(updated);
      onSnack?.('Producto eliminado', 'info');
    } catch (e) {
      onSnack?.(e?.response?.data?.error?.message || 'Error', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!editable) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Este pedido ya no admite cambios de ítems.
      </Typography>
    );
  }

  const filtered = products.filter((p) =>
    !search || String(p.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Editar ítems (staff)
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          disabled={busy}
          onClick={() => setAddOpen(true)}
        >
          Agregar producto
        </Button>
      </Box>
      <List dense>
        {(pedido.items || []).map((item) => (
          <ListItem key={item.id} sx={{ px: 0, flexDirection: 'column', alignItems: 'stretch' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <IconButton size="small" disabled={busy} onClick={() => handleQtyChange(item, -1)}>
                <RemoveIcon fontSize="small" />
              </IconButton>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {item.quantity}x {item.product?.name || 'Producto'}
              </Typography>
              <IconButton size="small" disabled={busy} onClick={() => handleQtyChange(item, 1)}>
                <AddIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" color="error" disabled={busy} onClick={() => handleDelete(item)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </ListItem>
        ))}
      </List>

      <Dialog open={addOpen} onClose={() => !busy && setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Agregar producto</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            label="Buscar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          {loadingProducts ? (
            <CircularProgress size={24} />
          ) : (
            <List dense sx={{ maxHeight: 280, overflow: 'auto' }}>
              {filtered.slice(0, 40).map((p) => (
                <ListItem
                  key={p.id}
                  button
                  selected={selectedProduct?.id === p.id}
                  onClick={() => setSelectedProduct(p)}
                >
                  <Typography variant="body2">{p.name}</Typography>
                </ListItem>
              ))}
            </List>
          )}
          <TextField
            type="number"
            size="small"
            label="Cantidad"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            sx={{ mt: 2, width: 120 }}
            inputProps={{ min: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={busy}>Cancelar</Button>
          <Button variant="contained" onClick={handleAdd} disabled={busy || !selectedProduct}>
            Agregar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
