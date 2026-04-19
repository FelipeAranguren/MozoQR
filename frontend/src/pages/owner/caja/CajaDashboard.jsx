import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Stack,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import { getRestaurantId } from '../../../api/menu';
import {
  cashMovementsFromSession,
  computeCashBalance,
  createCashMovement,
  createCashSession,
  fetchCashMovementsForSession,
  fetchOpenCashSession,
  restEntityId,
  updateCashSession,
} from '../../../api/cashAndStock';

function formatCurrency(n) {
  return `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}
function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function totalsFromMovements(movements) {
  let totalIngresos = 0;
  let totalEgresos = 0;
  for (const m of movements || []) {
    const amt = Number(m.monto) || 0;
    if (m.tipo === 'egreso') totalEgresos += amt;
    else totalIngresos += amt;
  }
  return { totalIngresos, totalEgresos };
}

export default function CajaDashboard() {
  const { slug } = useParams();
  const [restaurantId, setRestaurantId] = useState(null);
  const [session, setSession] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rid = await getRestaurantId(slug);
      if (!rid) {
        setError('No se encontró el restaurante.');
        setRestaurantId(null);
        setSession(null);
        setMovements([]);
        return;
      }
      setRestaurantId(rid);
      const s = await fetchOpenCashSession(rid);
      const isAbierta = s && s.estado === 'abierta';
      setSession(isAbierta ? s : null);
      let movs = [];
      if (s && isAbierta) {
        movs = cashMovementsFromSession(s);
        if (!movs.length) {
          try {
            movs = await fetchCashMovementsForSession(restEntityId(s));
          } catch {
            movs = [];
          }
        }
      }
      setMovements(movs);
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'Error al cargar caja');
      setSession(null);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const isOpen = Boolean(session && session.estado === 'abierta');
  const balance = computeCashBalance(session, movements);
  const { totalIngresos, totalEgresos } = totalsFromMovements(movements);

  const handleAbrir = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      await createCashSession({
        fecha_apertura: new Date().toISOString(),
        monto_inicial: Number(String(form.initial_balance || '').replace(',', '.')) || 0,
        estado: 'abierta',
        restaurante: restaurantId,
      });
      setOpenDialog(null);
      setForm({});
      await load();
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'Error al abrir caja');
    } finally {
      setSaving(false);
    }
  };

  const handleCerrar = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const sid = restEntityId(session);
      await updateCashSession(sid, {
        fecha_cierre: new Date().toISOString(),
        monto_final: balance,
        estado: 'cerrada',
      });
      setOpenDialog(null);
      setForm({});
      await load();
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'Error al cerrar caja');
    } finally {
      setSaving(false);
    }
  };

  const handleMovimiento = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const concepto = [form.concept, form.notes].filter(Boolean).join(' — ') || 'Movimiento';
      await createCashMovement({
        tipo: form.type,
        monto: Number(String(form.amount || '').replace(',', '.')),
        concepto,
        cash_session: restEntityId(session),
      });
      setOpenDialog(null);
      setForm({});
      await load();
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'Error al registrar movimiento');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Caja
        </Typography>
        {isOpen ? (
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setForm({ type: 'ingreso' });
                setOpenDialog('movimiento');
              }}
            >
              Ingreso
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<RemoveIcon />}
              onClick={() => {
                setForm({ type: 'egreso' });
                setOpenDialog('movimiento');
              }}
            >
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

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {!isOpen && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            No hay sesión de caja abierta.
          </Typography>
          
        </Paper>
      )}

      {isOpen && session && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Balance actual
                </Typography>
                <Typography variant="h4" fontWeight={700} color={balance >= 0 ? 'success.main' : 'error.main'}>
                  {formatCurrency(balance)}
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Monto inicial
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  {formatCurrency(session.monto_inicial)}
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Ingresos (movimientos)
                </Typography>
                <Typography variant="h5" fontWeight={600} color="success.main">
                  {formatCurrency(totalIngresos)}
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Egresos (movimientos)
                </Typography>
                <Typography variant="h5" fontWeight={600} color="error.main">
                  {formatCurrency(totalEgresos)}
                </Typography>
              </CardContent>
            </Card>
          </Stack>

          <Paper sx={{ mb: 2 }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Movimientos
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Apertura: {formatDateTime(session.fecha_apertura)}
              </Typography>
            </Box>
            <Divider />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Concepto</TableCell>
                    <TableCell align="right">Monto</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {movements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                        Sin movimientos
                      </TableCell>
                    </TableRow>
                  )}
                  {movements.map((m, i) => (
                    <TableRow key={String(m.documentId ?? m.id ?? i)}>
                      <TableCell>{formatDateTime(m.createdAt)}</TableCell>
                      <TableCell>
                        <Chip
                          label={m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                          color={m.tipo === 'ingreso' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{m.concepto || '—'}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 600, color: m.tipo === 'ingreso' ? 'success.main' : 'error.main' }}
                      >
                        {m.tipo === 'ingreso' ? '+' : '-'}
                        {formatCurrency(m.monto)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      <Dialog open={openDialog === 'abrir'} onClose={() => setOpenDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Abrir caja</DialogTitle>
        <DialogContent>
          <TextField
            label="Monto inicial"
            type="number"
            fullWidth
            margin="normal"
            autoFocus
            value={form.initial_balance || ''}
            onChange={(e) => setForm((f) => ({ ...f, initial_balance: e.target.value }))}
          />
          <TextField
            label="Notas (opcional)"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={form.notes || ''}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(null)}>Cancelar</Button>
          <Button variant="contained" color="success" onClick={handleAbrir} disabled={saving}>
            {saving ? 'Abriendo...' : 'Abrir caja'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDialog === 'cerrar'} onClose={() => setOpenDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Cerrar caja</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Se guardará el cierre con balance {formatCurrency(balance)} como monto final.
          </Alert>
          <TextField
            label="Notas"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={form.notes || ''}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleCerrar} disabled={saving}>
            {saving ? 'Cerrando...' : 'Cerrar caja'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDialog === 'movimiento'} onClose={() => setOpenDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Registrar {form.type === 'ingreso' ? 'ingreso' : 'egreso'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Monto"
            type="number"
            fullWidth
            margin="normal"
            autoFocus
            required
            value={form.amount || ''}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            inputProps={{ min: 0, step: 0.01 }}
          />
          <TextField
            label="Concepto"
            fullWidth
            margin="normal"
            required
            value={form.concept || ''}
            onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))}
          />
          <TextField
            label="Notas (opcional)"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={form.notes || ''}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleMovimiento}
            disabled={saving || !form.amount || !form.concept}
            color={form.type === 'ingreso' ? 'success' : 'error'}
          >
            {saving ? 'Guardando...' : `Registrar ${form.type}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
