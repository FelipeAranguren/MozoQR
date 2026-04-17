import React, { useState, useEffect, useCallback } from 'react';
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
import { crearCompra } from '../../../api/stock';
import { client, unwrap } from '../../../api/client';

function formatCurrency(n) {
  return `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  supplier: '',
  notes: '',
  items: [{ productoId: null, quantity: '', unit_cost: '' }],
});

/**
 * Modal para crear una compra (misma API que ComprasManagement).
 * @param {{ open: boolean; onClose: () => void; slug: string; onCreated?: () => void | Promise<void> }} props
 */
export default function NuevaCompraDialog({ open, onClose, slug, onCreated }) {
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadProductos = useCallback(async () => {
    try {
      const res = await client.get(`/restaurants/${slug}/stock`);
      const all = unwrap(res) || [];
      setProductos(all);
    } catch {
      try {
        const res = await client.get(
          `/productos?filters[restaurante][slug][$eq]=${slug}&pagination[pageSize]=500&fields[0]=id&fields[1]=name&fields[2]=sku`
        );
        setProductos(
          (unwrap(res) || []).map((p) => ({
            id: p.id,
            name: p.name || p.attributes?.name,
            sku: p.sku || p.attributes?.sku,
          }))
        );
      } catch {
        setProductos([]);
      }
    }
  }, [slug]);

  useEffect(() => {
    if (!open || !slug) return;
    setError('');
    setForm(emptyForm());
    loadProductos();
  }, [open, slug, loadProductos]);

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { productoId: null, quantity: '', unit_cost: '' }] }));
  const removeItem = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const handleCrear = async () => {
    const items = form.items
      .filter((it) => it.productoId && it.quantity && it.unit_cost)
      .map((it) => ({
        productoId: it.productoId,
        quantity: Number(it.quantity),
        unit_cost: Number(it.unit_cost),
      }));
    if (items.length === 0) {
      setError('Agregá al menos un item con producto, cantidad y costo');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await crearCompra(slug, {
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
          Items
        </Typography>
        {form.items.map((item, idx) => (
          <Stack key={idx} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Autocomplete
              size="small"
              sx={{ minWidth: 220, flex: 2 }}
              options={productos}
              getOptionLabel={(o) => (o?.name ? `${o.name}${o.sku ? ` (${o.sku})` : ''}` : '')}
              value={productos.find((p) => p.id === item.productoId) || null}
              onChange={(_, v) => updateItem(idx, 'productoId', v?.id || null)}
              renderInput={(params) => <TextField {...params} label="Producto" />}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
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
        <Button size="small" startIcon={<AddIcon />} onClick={addItem}>
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
        <Button variant="contained" onClick={handleCrear} disabled={saving}>
          {saving ? 'Guardando...' : 'Crear compra'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
