import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Stack, Tabs, Tab, IconButton, Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import WarningIcon from '@mui/icons-material/Warning';
import HistoryIcon from '@mui/icons-material/History';
import { fetchStockOverview, ajusteStock, fetchMovimientosStock } from '../../../api/stock';

function formatCurrency(n) {
  return `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}
function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const STOCK_STATUS = {
  ok: { label: 'OK', color: 'success' },
  bajo: { label: 'Bajo', color: 'warning' },
  sin_stock: { label: 'Sin stock', color: 'error' },
};

const UNIT_LABELS = { unidad: 'un.', kg: 'kg', litro: 'lt', porcion: 'porc.' };

export default function StockDashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editDialog, setEditDialog] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadStock = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchStockOverview(slug);
      setProductos(data || []);
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al cargar stock');
    }
    setLoading(false);
  }, [slug]);

  const loadMovimientos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchMovimientosStock(slug, { pageSize: 100 });
      setMovimientos(data || []);
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al cargar movimientos');
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    if (tab === 0) loadStock();
    else loadMovimientos();
  }, [tab, loadStock, loadMovimientos]);

  const handleAjuste = async () => {
    if (!editDialog) return;
    setSaving(true);
    try {
      await ajusteStock(slug, editDialog.id, { new_quantity: Number(editQty), notes: editNotes });
      setEditDialog(null);
      await loadStock();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al ajustar stock');
    }
    setSaving(false);
  };

  const alertCount = productos.filter(p => p.stock_status !== 'ok').length;

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Control de Stock</Typography>
        <Button variant="contained" onClick={() => navigate(`/owner/${slug}/stock/compras`)}>
          Compras
        </Button>
      </Stack>

      {alertCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
          {alertCount} producto{alertCount > 1 ? 's' : ''} con stock bajo o agotado.
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Stock actual" />
        <Tab label="Movimientos" icon={<HistoryIcon />} iconPosition="start" />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : tab === 0 ? (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Categoría</TableCell>
                  <TableCell align="right">Precio</TableCell>
                  <TableCell align="right">Stock</TableCell>
                  <TableCell>Unidad</TableCell>
                  <TableCell align="right">Mín. alerta</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell width={60} />
                </TableRow>
              </TableHead>
              <TableBody>
                {productos.length === 0 && (
                  <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hay productos con stock habilitado. Activá el control de stock desde el menú de productos.
                    </Typography>
                  </TableCell></TableRow>
                )}
                {productos.map(p => {
                  const st = STOCK_STATUS[p.stock_status] || STOCK_STATUS.ok;
                  return (
                    <TableRow key={p.id} sx={p.stock_status !== 'ok' ? { bgcolor: 'action.hover' } : {}}>
                      <TableCell sx={{ fontWeight: 500 }}>{p.name}</TableCell>
                      <TableCell>{p.sku || '-'}</TableCell>
                      <TableCell>{p.categoria?.name || '-'}</TableCell>
                      <TableCell align="right">{formatCurrency(p.price)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{Number(p.stock_quantity) || 0}</TableCell>
                      <TableCell>{UNIT_LABELS[p.stock_unit] || p.stock_unit}</TableCell>
                      <TableCell align="right">{Number(p.stock_min_alert) || 0}</TableCell>
                      <TableCell><Chip label={st.label} color={st.color} size="small" /></TableCell>
                      <TableCell>
                        <Tooltip title="Ajustar stock">
                          <IconButton size="small" onClick={() => { setEditDialog(p); setEditQty(String(p.stock_quantity || 0)); setEditNotes(''); }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Producto</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                  <TableCell align="right">Stock anterior</TableCell>
                  <TableCell align="right">Stock nuevo</TableCell>
                  <TableCell>Notas</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movimientos.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>Sin movimientos</TableCell></TableRow>
                )}
                {movimientos.map((m, i) => (
                  <TableRow key={m.id || i}>
                    <TableCell>{formatDateTime(m.timestamp)}</TableCell>
                    <TableCell>{m.producto?.name || '-'}</TableCell>
                    <TableCell>
                      <Chip label={(m.type || '').replace(/_/g, ' ')} size="small"
                        color={m.type === 'compra' ? 'success' : m.type === 'venta' ? 'error' : 'default'} sx={{ textTransform: 'capitalize' }} />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: Number(m.quantity) >= 0 ? 'success.main' : 'error.main' }}>
                      {Number(m.quantity) > 0 ? '+' : ''}{m.quantity}
                    </TableCell>
                    <TableCell align="right">{m.previous_stock}</TableCell>
                    <TableCell align="right">{m.new_stock}</TableCell>
                    <TableCell>{m.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={!!editDialog} onClose={() => setEditDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Ajustar stock: {editDialog?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Stock actual: {editDialog?.stock_quantity || 0} {UNIT_LABELS[editDialog?.stock_unit] || ''}
          </Typography>
          <TextField label="Nueva cantidad" type="number" fullWidth margin="normal" autoFocus
            value={editQty} onChange={e => setEditQty(e.target.value)} inputProps={{ min: 0, step: 0.5 }} />
          <TextField label="Notas (opcional)" fullWidth margin="normal" multiline rows={2}
            value={editNotes} onChange={e => setEditNotes(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAjuste} disabled={saving || editQty === ''}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
