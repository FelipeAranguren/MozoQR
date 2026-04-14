import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, CircularProgress, Card, CardContent, Stack, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import { abrirCaja, cerrarCaja, fetchCajaActual, crearMovimientoCaja } from '../../../api/caja';

const CATEGORIES_INGRESO = [
  { value: 'venta', label: 'Venta' },
  { value: 'propina', label: 'Propina' },
  { value: 'ajuste', label: 'Ajuste' },
];
const CATEGORIES_EGRESO = [
  { value: 'retiro', label: 'Retiro' },
  { value: 'gasto_operativo', label: 'Gasto operativo' },
  { value: 'compra_insumo', label: 'Compra de insumo' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'ajuste', label: 'Ajuste' },
];
const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'digital', label: 'Digital' },
  { value: 'otro', label: 'Otro' },
];

function formatCurrency(n) {
  return `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}
function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function CajaDashboard() {
  const { slug } = useParams();
  const [caja, setCaja] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(null); // 'abrir' | 'cerrar' | 'movimiento'
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetchCajaActual(slug);
      setCaja(res?.data || null);
      setIsOpen(res?.meta?.open ?? false);
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'Error al cargar caja');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const handleAbrir = async () => {
    setSaving(true);
    try {
      await abrirCaja(slug, { initial_balance: Number(form.initial_balance) || 0, notes: form.notes });
      setOpenDialog(null);
      setForm({});
      await load();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al abrir caja');
    } finally {
      setSaving(false);
    }
  };

  const handleCerrar = async () => {
    setSaving(true);
    try {
      await cerrarCaja(slug, { notes: form.notes });
      setOpenDialog(null);
      setForm({});
      await load();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al cerrar caja');
    } finally {
      setSaving(false);
    }
  };

  const handleMovimiento = async () => {
    setSaving(true);
    try {
      await crearMovimientoCaja(slug, {
        type: form.type,
        amount: Number(form.amount),
        concept: form.concept,
        category: form.category,
        payment_method: form.payment_method || 'efectivo',
        notes: form.notes,
      });
      setOpenDialog(null);
      setForm({});
      await load();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al registrar movimiento');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  const computed = caja?.computed || {};

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Caja</Typography>
        {isOpen ? (
          <Stack direction="row" spacing={1}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm({ type: 'ingreso' }); setOpenDialog('movimiento'); }}>
              Ingreso
            </Button>
            <Button variant="outlined" color="error" startIcon={<RemoveIcon />} onClick={() => { setForm({ type: 'egreso' }); setOpenDialog('movimiento'); }}>
              Egreso
            </Button>
            <Button variant="outlined" startIcon={<LockIcon />} onClick={() => { setForm({}); setOpenDialog('cerrar'); }}>
              Cerrar caja
            </Button>
          </Stack>
        ) : (
          <Button variant="contained" color="success" startIcon={<LockOpenIcon />} onClick={() => { setForm({}); setOpenDialog('abrir'); }}>
            Abrir caja
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {!isOpen && !caja && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>No hay caja abierta.</Typography>
          <Typography variant="body2" color="text.secondary">
            Abrí una caja para empezar a registrar ingresos y egresos del día.
          </Typography>
        </Paper>
      )}

      {isOpen && caja && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Balance actual</Typography>
                <Typography variant="h4" fontWeight={700} color={computed.balance >= 0 ? 'success.main' : 'error.main'}>
                  {formatCurrency(computed.balance)}
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Fondo inicial</Typography>
                <Typography variant="h5" fontWeight={600}>{formatCurrency(caja.initial_balance)}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Ingresos</Typography>
                <Typography variant="h5" fontWeight={600} color="success.main">{formatCurrency(computed.total_ingresos)}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Egresos</Typography>
                <Typography variant="h5" fontWeight={600} color="error.main">{formatCurrency(computed.total_egresos)}</Typography>
              </CardContent>
            </Card>
          </Stack>

          <Paper sx={{ mb: 2 }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={600}>Movimientos de hoy</Typography>
              <Typography variant="body2" color="text.secondary">
                Abierta desde {formatDateTime(caja.opened_at)}
                {caja.opened_by?.fullname && ` por ${caja.opened_by.fullname}`}
              </Typography>
            </Box>
            <Divider />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Hora</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Concepto</TableCell>
                    <TableCell>Categoría</TableCell>
                    <TableCell>Método</TableCell>
                    <TableCell align="right">Monto</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(caja.movimientos || []).length === 0 && (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>Sin movimientos</TableCell></TableRow>
                  )}
                  {(caja.movimientos || []).map((m, i) => (
                    <TableRow key={m.id || i}>
                      <TableCell>{formatDateTime(m.timestamp)}</TableCell>
                      <TableCell>
                        <Chip label={m.type === 'ingreso' ? 'Ingreso' : 'Egreso'}
                          color={m.type === 'ingreso' ? 'success' : 'error'} size="small" />
                      </TableCell>
                      <TableCell>{m.concept}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{(m.category || '').replace(/_/g, ' ')}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{m.payment_method}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: m.type === 'ingreso' ? 'success.main' : 'error.main' }}>
                        {m.type === 'ingreso' ? '+' : '-'}{formatCurrency(m.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      {/* Dialog Abrir Caja */}
      <Dialog open={openDialog === 'abrir'} onClose={() => setOpenDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Abrir caja</DialogTitle>
        <DialogContent>
          <TextField label="Fondo inicial" type="number" fullWidth margin="normal" autoFocus
            value={form.initial_balance || ''} onChange={e => setForm(f => ({ ...f, initial_balance: e.target.value }))} />
          <TextField label="Notas (opcional)" fullWidth margin="normal" multiline rows={2}
            value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(null)}>Cancelar</Button>
          <Button variant="contained" color="success" onClick={handleAbrir} disabled={saving}>
            {saving ? 'Abriendo...' : 'Abrir caja'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Cerrar Caja */}
      <Dialog open={openDialog === 'cerrar'} onClose={() => setOpenDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Cerrar caja</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Se va a cerrar la caja con un balance de {formatCurrency(computed.balance)}.
          </Alert>
          <TextField label="Notas de cierre (opcional)" fullWidth margin="normal" multiline rows={2}
            value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleCerrar} disabled={saving}>
            {saving ? 'Cerrando...' : 'Cerrar caja'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Movimiento */}
      <Dialog open={openDialog === 'movimiento'} onClose={() => setOpenDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Registrar {form.type === 'ingreso' ? 'ingreso' : 'egreso'}</DialogTitle>
        <DialogContent>
          <TextField label="Monto" type="number" fullWidth margin="normal" autoFocus required
            value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            inputProps={{ min: 0, step: 0.01 }} />
          <TextField label="Concepto" fullWidth margin="normal" required
            value={form.concept || ''} onChange={e => setForm(f => ({ ...f, concept: e.target.value }))} />
          <TextField label="Categoría" select fullWidth margin="normal" required
            value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {(form.type === 'ingreso' ? CATEGORIES_INGRESO : CATEGORIES_EGRESO).map(c => (
              <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
            ))}
          </TextField>
          <TextField label="Método de pago" select fullWidth margin="normal"
            value={form.payment_method || 'efectivo'} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
            {PAYMENT_METHODS.map(p => (
              <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
            ))}
          </TextField>
          <TextField label="Notas (opcional)" fullWidth margin="normal" multiline rows={2}
            value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleMovimiento} disabled={saving || !form.amount || !form.concept || !form.category}
            color={form.type === 'ingreso' ? 'success' : 'error'}>
            {saving ? 'Guardando...' : `Registrar ${form.type}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
