import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Stack, Collapse, IconButton, Chip, CircularProgress, Alert,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { fetchCajaHistorial, fetchMovimientosCaja } from '../../../api/caja';

function formatCurrency(n) {
  return `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}
function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function SesionRow({ sesion, slug }) {
  const [open, setOpen] = useState(false);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadMovimientos = async () => {
    if (movimientos.length > 0) { setOpen(o => !o); return; }
    setLoading(true);
    try {
      const data = await fetchMovimientosCaja(slug, { caja_sesion_id: sesion.id, pageSize: 500 });
      setMovimientos(data || []);
      setOpen(true);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton size="small" onClick={loadMovimientos}>
            {loading ? <CircularProgress size={18} /> : open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{formatDateTime(sesion.opened_at)}</TableCell>
        <TableCell>{formatDateTime(sesion.closed_at)}</TableCell>
        <TableCell>{sesion.opened_by?.fullname || sesion.opened_by?.username || '-'}</TableCell>
        <TableCell align="right">{formatCurrency(sesion.initial_balance)}</TableCell>
        <TableCell align="right" sx={{ color: 'success.main' }}>{formatCurrency(sesion.total_ingresos)}</TableCell>
        <TableCell align="right" sx={{ color: 'error.main' }}>{formatCurrency(sesion.total_egresos)}</TableCell>
        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(sesion.final_balance)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={8} sx={{ py: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ m: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Movimientos de esta sesión</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Hora</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Concepto</TableCell>
                    <TableCell>Categoría</TableCell>
                    <TableCell align="right">Monto</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {movimientos.map((m, i) => (
                    <TableRow key={m.id || i}>
                      <TableCell>{formatDateTime(m.timestamp)}</TableCell>
                      <TableCell>
                        <Chip label={m.type === 'ingreso' ? 'Ingreso' : 'Egreso'}
                          color={m.type === 'ingreso' ? 'success' : 'error'} size="small" />
                      </TableCell>
                      <TableCell>{m.concept}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{(m.category || '').replace(/_/g, ' ')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: m.type === 'ingreso' ? 'success.main' : 'error.main' }}>
                        {m.type === 'ingreso' ? '+' : '-'}{formatCurrency(m.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {movimientos.length === 0 && (
                    <TableRow><TableCell colSpan={5} align="center">Sin movimientos</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function CajaHistorial() {
  const { slug } = useParams();
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCajaHistorial(slug, {
        desde: desde || undefined,
        hasta: hasta || undefined,
      });
      setSesiones(data || []);
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al cargar historial');
    }
    setLoading(false);
  }, [slug, desde, hasta]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Historial de cajas</Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField label="Desde" type="date" size="small" InputLabelProps={{ shrink: true }}
          value={desde} onChange={e => setDesde(e.target.value)} />
        <TextField label="Hasta" type="date" size="small" InputLabelProps={{ shrink: true }}
          value={hasta} onChange={e => setHasta(e.target.value)} />
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={50} />
                  <TableCell>Apertura</TableCell>
                  <TableCell>Cierre</TableCell>
                  <TableCell>Abierta por</TableCell>
                  <TableCell align="right">Fondo</TableCell>
                  <TableCell align="right">Ingresos</TableCell>
                  <TableCell align="right">Egresos</TableCell>
                  <TableCell align="right">Balance final</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sesiones.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No hay sesiones cerradas en este período</Typography>
                  </TableCell></TableRow>
                )}
                {sesiones.map(s => <SesionRow key={s.id} sesion={s} slug={slug} />)}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
