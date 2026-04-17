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
  Switch,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import HistoryIcon from '@mui/icons-material/History';
import { getRestaurantId } from '../../../api/menu';
import {
  fetchStockItemsForRestaurant,
  fetchStockMovementsForRestaurant,
  restEntityId,
  updateStockItemEstado,
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

function productName(item) {
  const p = unwrapRel(item.producto);
  return p?.name || '—';
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

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rid = await getRestaurantId(slug);
      if (!rid) {
        setItems([]);
        setError('No se encontró el restaurante.');
        return;
      }
      const data = await fetchStockItemsForRestaurant(rid);
      setItems(data || []);
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'Error al cargar stock-items');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rid = await getRestaurantId(slug);
      if (!rid) {
        setMovements([]);
        setError('No se encontró el restaurante.');
        return;
      }
      const data = await fetchStockMovementsForRestaurant(rid);
      setMovements(data || []);
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'Error al cargar stock-movements');
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (tab === 0) loadItems();
    else loadMovements();
  }, [tab, loadItems, loadMovements]);

  const handleEstado = async (row, next) => {
    try {
      const id = restEntityId(row);
      const updated = await updateStockItemEstado(id, { estado: next });
      setItems((prev) =>
        prev.map((r) => (restEntityId(r) === id ? { ...r, ...updated, estado: next } : r))
      );
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'No se pudo actualizar estado');
    }
  };

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
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell align="right">Stock actual</TableCell>
                  <TableCell align="right">Mínimo</TableCell>
                  <TableCell>Categoría</TableCell>
                  <TableCell>Unidad</TableCell>
                  <TableCell align="right">Precio costo</TableCell>
                  <TableCell>Producto</TableCell>
                  <TableCell align="center">Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
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
                      <TableCell>{it.sku || '—'}</TableCell>
                      <TableCell align="right">{it.stock_actual ?? '—'}</TableCell>
                      <TableCell align="right">{it.stock_minimo ?? '—'}</TableCell>
                      <TableCell>{it.categoria || '—'}</TableCell>
                      <TableCell>{UNIT_LABELS[it.unidad] || it.unidad || '—'}</TableCell>
                      <TableCell align="right">{formatCurrency(it.precio_costo)}</TableCell>
                      <TableCell>{productName(it)}</TableCell>
                      <TableCell align="center">
                        <Switch
                          checked={it.estado !== false}
                          onChange={(_, v) => handleEstado(it, v)}
                          inputProps={{ 'aria-label': `estado-${it.sku || it.id}` }}
                        />
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
                  <TableCell>Ítem</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                  <TableCell>Motivo</TableCell>
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
                    <TableCell>{m.motivo || '—'}</TableCell>
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
