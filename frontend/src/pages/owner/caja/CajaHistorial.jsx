import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Stack,
  Collapse,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { getRestaurantId } from '../../../api/menu';
import { fetchCashMovementsForSession, fetchClosedCashSessions, restEntityId } from '../../../api/cashAndStock';

function formatCurrency(n) {
  return `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}
function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function totalsFromMovements(movements) {
  let ing = 0;
  let egr = 0;
  for (const m of movements || []) {
    const amt = Number(m.monto) || 0;
    if (m.tipo === 'egreso') egr += amt;
    else ing += amt;
  }
  return { ing, egr };
}

function SesionRow({ sesion }) {
  const [open, setOpen] = useState(false);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadMovimientos = async () => {
    if (movimientos.length > 0) {
      setOpen((o) => !o);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchCashMovementsForSession(restEntityId(sesion));
      setMovimientos(data || []);
      setOpen(true);
    } catch {
      setMovimientos([]);
      setOpen(true);
    }
    setLoading(false);
  };

  const { ing, egr } = totalsFromMovements(movimientos);

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton size="small" onClick={loadMovimientos}>
            {loading ? <CircularProgress size={18} /> : open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{formatDateTime(sesion.fecha_apertura)}</TableCell>
        <TableCell>{formatDateTime(sesion.fecha_cierre)}</TableCell>
        <TableCell align="right">{formatCurrency(sesion.monto_inicial)}</TableCell>
        <TableCell align="right" sx={{ color: 'success.main' }}>
          {movimientos.length ? formatCurrency(ing) : '—'}
        </TableCell>
        <TableCell align="right" sx={{ color: 'error.main' }}>
          {movimientos.length ? formatCurrency(egr) : '—'}
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: 700 }}>
          {formatCurrency(sesion.monto_final)}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ py: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ m: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Movimientos (cash-movements)
              </Typography>
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
                  {movimientos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        Sin movimientos
                      </TableCell>
                    </TableRow>
                  )}
                  {movimientos.map((m, i) => (
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
                      <TableCell align="right">{formatCurrency(m.monto)}</TableCell>
                    </TableRow>
                  ))}
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
      const rid = await getRestaurantId(slug);
      if (!rid) {
        setSesiones([]);
        setError('No se encontró el restaurante.');
        return;
      }
      const data = await fetchClosedCashSessions(rid, {
        desde: desde || undefined,
        hasta: hasta || undefined,
        pageSize: 100,
      });
      setSesiones(data || []);
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'Error al cargar historial');
      setSesiones([]);
    } finally {
      setLoading(false);
    }
  }, [slug, desde, hasta]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Historial de cajas
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          label="Desde"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
        <TextField
          label="Hasta"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={50} />
                  <TableCell>Apertura</TableCell>
                  <TableCell>Cierre</TableCell>
                  <TableCell align="right">Monto inicial</TableCell>
                  <TableCell align="right">Ingresos</TableCell>
                  <TableCell align="right">Egresos</TableCell>
                  <TableCell align="right">Monto final</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sesiones.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No hay sesiones cerradas en este período</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {sesiones.map((s) => (
                  <SesionRow key={String(s.documentId ?? s.id)} sesion={s} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
