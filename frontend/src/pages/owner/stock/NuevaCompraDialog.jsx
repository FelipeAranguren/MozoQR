import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Divider,
  Autocomplete,
  IconButton,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { getRestaurantId } from '../../../api/menu';
import {
  crearCompraOwner,
  fetchProductosForCompra,
  fetchStockItemsForRestaurant,
  restEntityId,
} from '../../../api/cashAndStock';

function formatCurrency(n) {
  return `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  supplier: '',
  notes: '',
  items: [{ productoId: null, quantity: '', unit_cost: '' }],
});

function productoLabel(p) {
  if (!p) return '';
  const name = p.name || '—';
  const sku = p.sku ? ` (${p.sku})` : '';
  return `${name}${sku}`;
}

/** Si existe un stock-item ligado al mismo producto, devuelve ese documento (para enviar stockItemId al backend). */
function findStockItemForProduct(productoId, stockItems) {
  if (productoId == null || !Array.isArray(stockItems) || stockItems.length === 0) return null;
  const want = String(productoId);
  for (const si of stockItems) {
    const rel = si.producto?.data ?? si.producto;
    if (!rel) continue;
    const flat = rel.attributes ? { ...rel.attributes, id: rel.id, documentId: rel.documentId } : rel;
    const ids = [flat.id, flat.documentId].filter((x) => x != null).map(String);
    if (ids.includes(want)) return si;
  }
  return null;
}

/**
 * Modal “Nueva compra”: lista **todos los productos** del restaurante.
 * POST `/api/restaurants/:slug/compras` con `productoId` por línea y `stockItemId` si hay stock-item vinculado.
 */
export default function NuevaCompraDialog({ open, onClose, slug, onCreated }) {
  const [productos, setProductos] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const rid = await getRestaurantId(slug);
      if (!rid) {
        setProductos([]);
        setStockItems([]);
        return;
      }
      const [prods, stocks] = await Promise.all([
        fetchProductosForCompra(rid),
        fetchStockItemsForRestaurant(rid).catch(() => []),
      ]);
      setProductos(prods || []);
      setStockItems(stocks || []);
    } catch {
      setProductos([]);
      setStockItems([]);
    }
  }, [slug]);

  useEffect(() => {
    if (!open || !slug) return;
    setError('');
    setForm(emptyForm());
    loadData();
  }, [open, slug, loadData]);

  const addItem = () =>
    setForm((f) => ({ ...f, items: [...f.items, { productoId: null, quantity: '', unit_cost: '' }] }));
  const removeItem = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const canSubmit = useMemo(() => {
    if (!form.date) return false;
    if (productos.length === 0) return false;
    return form.items.some((it) => {
      if (it.productoId == null || it.productoId === '') return false;
      const q = Number(it.quantity);
      const c = Number(it.unit_cost);
      if (!Number.isFinite(q) || q <= 0) return false;
      if (!Number.isFinite(c) || c < 0) return false;
      return true;
    });
  }, [form.date, form.items, productos.length]);

  const handleCrear = async () => {
    if (!canSubmit) {
      setError('Seleccioná al menos un producto con cantidad y costo válidos.');
      return;
    }
    const items = form.items
      .filter((it) => it.productoId && it.quantity !== '' && it.unit_cost !== '')
      .map((it) => {
        const linked = findStockItemForProduct(it.productoId, stockItems);
        const line = {
          productoId: it.productoId,
          quantity: Number(it.quantity),
          unit_cost: Number(it.unit_cost),
        };
        if (linked) {
          line.stockItemId = restEntityId(linked);
        }
        return line;
      });
    if (items.length === 0) {
      setError('Agregá al menos un producto, cantidad y costo unitario.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await crearCompraOwner(slug, {
        date: form.date,
        supplier: form.supplier,
        notes: form.notes,
        items,
      });
      if (onCreated) await onCreated();
      setForm(emptyForm());
      onClose();
    } catch (e) {
      const d = e?.response?.data;
      setError(
        d?.error?.message ||
          d?.message ||
          (typeof d === 'string' ? d : null) ||
          e?.message ||
          'Error al crear compra'
      );
    }
    setSaving(false);
  };

  const handleClose = () => {
    if (saving) return;
    setError('');
    onClose();
  };

  const totalForm = form.items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0),
    0
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Nueva compra</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {productos.length === 0 && !error && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No hay productos cargados para este restaurante. Creá productos en Strapi para poder registrar compras.
          </Alert>
        )}
        {productos.length > 0 && stockItems.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No hay registros en stock-items todavía. La compra se guarda por producto; si más adelante creás
            stock-items vinculados a cada producto, al recibir la compra se actualizará inventario y movimientos con
            más detalle.
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Fecha"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            sx={{ minWidth: 160 }}
          />
          <TextField
            label="Proveedor (opcional)"
            size="small"
            fullWidth
            value={form.supplier}
            onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
          />
        </Stack>

        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
          Productos
        </Typography>
        {form.items.map((item, idx) => (
          <Stack key={idx} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Autocomplete
              size="small"
              sx={{ minWidth: 220, flex: 2 }}
              options={productos}
              disabled={productos.length === 0}
              getOptionLabel={(o) => productoLabel(o)}
              value={
                item.productoId == null || item.productoId === ''
                  ? null
                  : productos.find((p) => restEntityId(p) === item.productoId) || null
              }
              onChange={(_, v) => updateItem(idx, 'productoId', v ? restEntityId(v) : null)}
              renderInput={(params) => <TextField {...params} label="Producto" />}
              isOptionEqualToValue={(o, v) => {
                if (!o && !v) return true;
                if (!o || !v) return false;
                return restEntityId(o) === restEntityId(v);
              }}
            />
            <TextField
              label="Cantidad"
              size="small"
              type="number"
              sx={{ width: 110 }}
              value={item.quantity}
              onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
              inputProps={{ min: 0, step: 0.5 }}
            />
            <TextField
              label="Costo unit."
              size="small"
              type="number"
              sx={{ width: 120 }}
              value={item.unit_cost}
              onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)}
              inputProps={{ min: 0, step: 0.01 }}
            />
            <Typography variant="body2" sx={{ minWidth: 80, textAlign: 'right', fontWeight: 500 }}>
              {formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_cost) || 0))}
            </Typography>
            <IconButton size="small" onClick={() => removeItem(idx)} disabled={form.items.length <= 1}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={addItem} disabled={productos.length === 0}>
          Agregar item
        </Button>

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <TextField
            label="Notas (opcional)"
            size="small"
            multiline
            rows={2}
            sx={{ flex: 1, mr: 2 }}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <Box>
            <Typography variant="body2" color="text.secondary">
              Total
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {formatCurrency(totalForm)}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleCrear} disabled={saving || !canSubmit}>
          {saving ? 'Guardando...' : 'Crear compra'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
