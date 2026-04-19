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
  Chip,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Tabs,
  Tab,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import HistoryIcon from '@mui/icons-material/History';
import { getRestaurantId } from '../../../api/menu';
import {
  fetchStockItemsForRestaurant,
  fetchStockMovementsForRestaurant,
} from '../../../api/cashAndStock';
import NuevaCompraDialog from './NuevaCompraDialog';

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

const UNIT_LABELS = {
  un: 'un.',
  kg: 'kg',
  lt: 'lt',
  pack: 'pack',
  unidad: 'un.',
  litro: 'lt',
  porcion: 'porc.',
};

function unwrapRel(rel) {
  if (!rel) return null;
  const inner = rel.data ?? rel;
  if (!inner) return null;
  return inner.attributes ? { ...inner.attributes, id: inner.id, documentId: inner.documentId } : inner;
}

function movementItemName(m) {
  const si = unwrapRel(m.stock_item);
  return si?.nombre || '—';
}

export default function StockDashboard() {
  const { slug } = useParams();
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [compraOpen, setCompraOpen] = useState(false);

  const loadItems = useCallback(async (opts) => {
    const silent = Boolean(opts?.silent);
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const rid = await getRestaurantId(slug);
      if (!rid) {
        setItems([]);
        if (!silent) setError('No se encontró el restaurante.');
        return;
      }
      const data = await fetchStockItemsForRestaurant(rid);
      setItems(data || []);
    } catch (e) {
      if (!silent) {
        setError(e?.response?.data?.error?.message || e.message || 'Error al cargar stock-items');
        setItems([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [slug]);

  const loadMovements = useCallback(async (opts) => {
    const silent = Boolean(opts?.silent);
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const rid = await getRestaurantId(slug);
      if (!rid) {
        setMovements([]);
        if (!silent) setError('No se encontró el restaurante.');
        return;
      }
      const data = await fetchStockMovementsForRestaurant(rid);
      setMovements(data || []);
    } catch (e) {
      if (!silent) {
        setError(e?.response?.data?.error?.message || e.message || 'Error al cargar stock-movements');
        setMovements([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (tab === 0) loadItems();
    else loadMovements();
  }, [tab, loadItems, loadMovements]);

  /** Refresco en background para ver ventas desde el menú sin recargar la página. */
  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (tab === 0) loadItems({ silent: true });
      else loadMovements({ silent: true });
    };
    const id = setInterval(tick, 45_000);
    return () => clearInterval(id);
  }, [tab, loadItems, loadMovements]);

  useEffect(() => {
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (tab === 0) loadItems({ silent: true });
      else loadMovements({ silent: true });
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
      return () => document.removeEventListener('visibilitychange', onVis);
    }
    return undefined;
  }, [tab, loadItems, loadMovements]);

  const alertCount = items.filter((it) => {
    const q = Number(it.stock_actual) || 0;
    const min = Number(it.stock_minimo) || 0;
    return q <= min;
  }).length;

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          Control de stock
        </Typography>
        <Button variant="contained" onClick={() => setCompraOpen(true)}>
          Compras
        </Button>
      </Stack>

      <NuevaCompraDialog
        open={compraOpen}
        onClose={() => setCompraOpen(false)}
        slug={slug}
        onCreated={async () => {
          try {
            const rid = await getRestaurantId(slug);
            if (!rid) return;
            const [itemsData, movData] = await Promise.all([
              fetchStockItemsForRestaurant(rid),
              fetchStockMovementsForRestaurant(rid),
            ]);
            setItems(itemsData || []);
            setMovements(movData || []);
          } catch (e) {
            setError(e?.response?.data?.error?.message || e.message || 'Error al refrescar datos');
          }
        }}
      />

      {alertCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
          {alertCount} ítem{alertCount > 1 ? 's' : ''} en o bajo el mínimo.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Stock actual" />
        <Tab label="Movimientos" icon={<HistoryIcon />} iconPosition="start" />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : tab === 0 ? (
        <Paper>
          <TableContainer>
            <Table
              sx={{
                tableLayout: 'fixed',
                width: '100%',
                '& .MuiTableCell-root': { verticalAlign: 'middle' },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ width: '20%', fontWeight: 600 }}>
                    Producto
                  </TableCell>
                  <TableCell align="center" sx={{ width: '20%', fontWeight: 600 }}>
                    Stock actual
                  </TableCell>
                  <TableCell align="center" sx={{ width: '20%', fontWeight: 600 }}>
                    Alerta
                  </TableCell>
                  <TableCell align="center" sx={{ width: '20%', fontWeight: 600 }}>
                    Unidad
                  </TableCell>
                  <TableCell align="center" sx={{ width: '20%', fontWeight: 600 }}>
                    Costo Promedio
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No hay stock-items vinculados a productos de este restaurante.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {items.map((it) => {
                  const q = Number(it.stock_actual) || 0;
                  const min = Number(it.stock_minimo) || 0;
                  const low = q <= min;
                  return (
                    <TableRow key={String(it.documentId ?? it.id)} sx={low ? { bgcolor: 'action.hover' } : {}}>
                      <TableCell sx={{ fontWeight: 500 }}>{it.nombre || '—'}</TableCell>
                      <TableCell align="center">{it.stock_actual ?? '—'}</TableCell>
                      <TableCell align="center">{it.stock_minimo ?? '—'}</TableCell>
                      <TableCell align="center">{UNIT_LABELS[it.unidad] || it.unidad || '—'}</TableCell>
                      <TableCell align="center">{formatCurrency(it.precio_costo)}</TableCell>
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
                  <TableCell>Ítem</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                  <TableCell>Notas</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      Sin movimientos
                    </TableCell>
                  </TableRow>
                )}
                {movements.map((m, i) => (
                  <TableRow key={String(m.documentId ?? m.id ?? i)}>
                    <TableCell>{formatDateTime(m.createdAt)}</TableCell>
                    <TableCell>{movementItemName(m)}</TableCell>
                    <TableCell>
                      <Chip label={m.tipo || '—'} size="small" sx={{ textTransform: 'capitalize' }} />
                    </TableCell>
                    <TableCell align="right">{m.cantidad ?? '—'}</TableCell>
                    <TableCell>{m.notas?.trim() ? m.notas : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
