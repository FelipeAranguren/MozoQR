import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, IconButton, CircularProgress, Alert, Stack, Divider, Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { fetchCompras, crearCompra, recibirCompra, cancelarCompra } from '../../../api/stock';
import { client, unwrap } from '../../../api/client';

function formatCurrency(n) {
  return `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}
function formatDate(d) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('es-AR');
}

const STATUS_MAP = {
  pendiente: { label: 'Pendiente', color: 'warning' },
  recibida: { label: 'Recibida', color: 'success' },
  cancelada: { label: 'Cancelada', color: 'default' },
};

export default function ComprasManagement() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [compras, setCompras] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openNew, setOpenNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), supplier: '', notes: '', items: [{ productoId: null, quantity: '', unit_cost: '' }] });

  const loadCompras = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCompras(slug, { pageSize: 50 });
      setCompras(data || []);
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al cargar compras');
    }
    setLoading(false);
  }, [slug]);

  const loadProductos = useCallback(async () => {
    try {
      const res = await client.get(`/restaurants/${slug}/stock`);
      const all = unwrap(res) || [];
      setProductos(all);
    } catch {
      try {
        const res = await client.get(`/productos?filters[restaurante][slug][$eq]=${slug}&pagination[pageSize]=500&fields[0]=id&fields[1]=name&fields[2]=sku`);
        setProductos((unwrap(res) || []).map(p => ({ id: p.id, name: p.name || p.attributes?.name, sku: p.sku || p.attributes?.sku })));
      } catch { /* ignore */ }
    }
  }, [slug]);

  useEffect(() => { loadCompras(); loadProductos(); }, [loadCompras, loadProductos]);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { productoId: null, quantity: '', unit_cost: '' }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const handleCrear = async () => {
    const items = form.items.filter(it => it.productoId && it.quantity && it.unit_cost)
      .map(it => ({ productoId: it.productoId, quantity: Number(it.quantity), unit_cost: Number(it.unit_cost) }));
    if (items.length === 0) { setError('Agregá al menos un item con producto, cantidad y costo'); return; }
    setSaving(true);
    try {
      await crearCompra(slug, { date: form.date, supplier: form.supplier, notes: form.notes, items });
      setOpenNew(false);
      setForm({ date: new Date().toISOString().slice(0, 10), supplier: '', notes: '', items: [{ productoId: null, quantity: '', unit_cost: '' }] });
      await loadCompras();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al crear compra');
    }
    setSaving(false);
  };

  const handleRecibir = async (id) => {
    setSaving(true);
    try {
      await recibirCompra(slug, id);
      await loadCompras();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al recibir compra');
    }
    setSaving(false);
  };

  const handleCancelar = async (id) => {
    setSaving(true);
    try {
      await cancelarCompra(slug, id);
      await loadCompras();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al cancelar compra');
    }
    setSaving(false);
  };

  const totalForm = form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0), 0);

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate(`/owner/${slug}/stock`)}><ArrowBackIcon /></IconButton>
        <Typography variant="h5" fontWeight={700} sx={{ flex: 1 }}>Compras</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenNew(true)}>
          Nueva compra
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Proveedor</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell width={180}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {compras.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No hay compras registradas</Typography>
                  </TableCell></TableRow>
                )}
                {compras.map(c => {
                  const st = STATUS_MAP[c.status] || STATUS_MAP.pendiente;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>{formatDate(c.date)}</TableCell>
                      <TableCell>{c.supplier || '-'}</TableCell>
                      <TableCell>{(c.items || []).map(it => it.producto?.name || `#${it.producto?.id || '?'}`).join(', ')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(c.total)}</TableCell>
                      <TableCell><Chip label={st.label} color={st.color} size="small" /></TableCell>
                      <TableCell>
                        {c.status === 'pendiente' && (
                          <Stack direction="row" spacing={0.5}>
                            <Button size="small" variant="contained" color="success" onClick={() => handleRecibir(c.id)} disabled={saving}>
                              Recibir
                            </Button>
                            <Button size="small" variant="outlined" color="error" onClick={() => handleCancelar(c.id)} disabled={saving}>
                              Cancelar
                            </Button>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Dialog Nueva Compra */}
      <Dialog open={openNew} onClose={() => setOpenNew(false)} maxWidth="md" fullWidth>
        <DialogTitle>Nueva compra</DialogTitle>
        <DialogContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
            <TextField label="Fecha" type="date" size="small" InputLabelProps={{ shrink: true }}
              value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} sx={{ minWidth: 160 }} />
            <TextField label="Proveedor (opcional)" size="small" fullWidth
              value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
          </Stack>

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Items</Typography>
          {form.items.map((item, idx) => (
            <Stack key={idx} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Autocomplete
                size="small" sx={{ minWidth: 220, flex: 2 }}
                options={productos} getOptionLabel={o => o?.name ? `${o.name}${o.sku ? ` (${o.sku})` : ''}` : ''}
                value={productos.find(p => p.id === item.productoId) || null}
                onChange={(_, v) => updateItem(idx, 'productoId', v?.id || null)}
                renderInput={params => <TextField {...params} label="Producto" />}
                isOptionEqualToValue={(o, v) => o?.id === v?.id}
              />
              <TextField label="Cantidad" size="small" type="number" sx={{ width: 110 }}
                value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)}
                inputProps={{ min: 0, step: 0.5 }} />
              <TextField label="Costo unit." size="small" type="number" sx={{ width: 120 }}
                value={item.unit_cost} onChange={e => updateItem(idx, 'unit_cost', e.target.value)}
                inputProps={{ min: 0, step: 0.01 }} />
              <Typography variant="body2" sx={{ minWidth: 80, textAlign: 'right', fontWeight: 500 }}>
                {formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_cost) || 0))}
              </Typography>
              <IconButton size="small" onClick={() => removeItem(idx)} disabled={form.items.length <= 1}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addItem}>Agregar item</Button>

          <Divider sx={{ my: 2 }} />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <TextField label="Notas (opcional)" size="small" multiline rows={2} sx={{ flex: 1, mr: 2 }}
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            <Box>
              <Typography variant="body2" color="text.secondary">Total</Typography>
              <Typography variant="h5" fontWeight={700}>{formatCurrency(totalForm)}</Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNew(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCrear} disabled={saving}>
            {saving ? 'Guardando...' : 'Crear compra'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
