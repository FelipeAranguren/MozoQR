// Panel Owner: Caja (cash-sessions + cash-movements) y Stock (stock-items + stock-movements)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  Paper,
  Grid,
  Chip,
} from '@mui/material';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import { MARANA_COLORS } from '../../../theme';
import { getRestaurantId } from '../../../api/menu';
import {
  cashMovementsFromSession,
  computeCashBalance,
  createCashMovement,
  createCashSession,
  fetchCashMovementsForSession,
  fetchOpenCashSession,
  fetchStockItemsForRestaurant,
  fetchStockMovementsForRestaurant,
  restEntityId,
  updateStockItemEstado,
} from '../../../api/cashAndStock';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
    Number(n) || 0
  );

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null}
    </div>
  );
}

function productLabel(item) {
  const p = item?.producto;
  if (!p) return '—';
  const flat = p.data ?? p;
  const inner = flat?.attributes ? { ...flat.attributes, id: flat.id, documentId: flat.documentId } : flat;
  return inner?.name || '—';
}

export default function CashAndStockPanel() {
  const { slug } = useParams();
  const [mainTab, setMainTab] = useState(0);
  const [stockSubTab, setStockSubTab] = useState(0);

  const [restaurantId, setRestaurantId] = useState(null);
  const [loadErr, setLoadErr] = useState(null);

  const [cashSession, setCashSession] = useState(null);
  const [movements, setMovements] = useState([]);
  const [cashLoading, setCashLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [montoInicial, setMontoInicial] = useState('');

  const [movTipo, setMovTipo] = useState('ingreso');
  const [movMonto, setMovMonto] = useState('');
  const [movConcepto, setMovConcepto] = useState('');

  const [stockItems, setStockItems] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);

  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const showSnack = (message, severity = 'success') => {
    setSnack({ open: true, message, severity });
  };

  const resolveRestaurantId = useCallback(async () => {
    if (!slug) return null;
    try {
      const id = await getRestaurantId(slug);
      setRestaurantId(id ?? null);
      if (!id) setLoadErr('No se encontró el restaurante para este slug.');
      else setLoadErr(null);
      return id ?? null;
    } catch (e) {
      setLoadErr(e?.message || 'Error al resolver el restaurante.');
      return null;
    }
  }, [slug]);

  const refreshCash = useCallback(
    async (rid) => {
      if (!rid) return;
      setCashLoading(true);
      try {
        const session = await fetchOpenCashSession(rid);
        setCashSession(session);
        let list = [];
        if (session) {
          list = cashMovementsFromSession(session);
          if (!list.length) {
            const sid = restEntityId(session);
            list = await fetchCashMovementsForSession(sid);
          }
        }
        setMovements(list);
      } catch (e) {
        const msg = e?.response?.data?.error?.message || e?.message || 'Error al cargar caja';
        setLoadErr(msg);
        showSnack(msg, 'error');
      } finally {
        setCashLoading(false);
      }
    },
    []
  );

  const refreshStock = useCallback(async (rid) => {
    if (!rid) return;
    setStockLoading(true);
    try {
      const [items, movs] = await Promise.all([
        fetchStockItemsForRestaurant(rid),
        fetchStockMovementsForRestaurant(rid),
      ]);
      setStockItems(items);
      setStockMovements(movs);
    } catch (e) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Error al cargar stock';
      showSnack(msg, 'error');
    } finally {
      setStockLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rid = await resolveRestaurantId();
      if (cancelled || !rid) return;
      await Promise.all([refreshCash(rid), refreshStock(rid)]);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, resolveRestaurantId, refreshCash, refreshStock]);

  const balance = useMemo(() => computeCashBalance(cashSession, movements), [cashSession, movements]);

  const handleOpenCaja = async () => {
    const rid = restaurantId || (await resolveRestaurantId());
    if (!rid) return;
    const n = Number(String(montoInicial).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) {
      showSnack('Ingresá un monto inicial válido', 'warning');
      return;
    }
    try {
      const created = await createCashSession({
        fecha_apertura: new Date().toISOString(),
        monto_inicial: n,
        estado: 'abierta',
        restaurante: rid,
      });
      setCashSession(created);
      setMovements([]);
      setOpenDialog(false);
      setMontoInicial('');
      showSnack('Caja abierta correctamente');
      await refreshCash(rid);
    } catch (e) {
      const msg = e?.response?.data?.error?.message || e?.message || 'No se pudo abrir la caja';
      showSnack(msg, 'error');
    }
  };

  const handleAddMovement = async () => {
    if (!cashSession) return;
    const n = Number(String(movMonto).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      showSnack('Ingresá un monto válido', 'warning');
      return;
    }
    try {
      const sid = restEntityId(cashSession);
      await createCashMovement({
        tipo: movTipo,
        monto: n,
        concepto: movConcepto || null,
        cash_session: sid,
      });
      setMovMonto('');
      setMovConcepto('');
      showSnack('Movimiento registrado');
      await refreshCash(restaurantId);
    } catch (e) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Error al registrar movimiento';
      showSnack(msg, 'error');
    }
  };

  const handleEstadoChange = async (item, next) => {
    try {
      const id = restEntityId(item);
      const updated = await updateStockItemEstado(id, { estado: next });
      setStockItems((prev) =>
        prev.map((row) => (restEntityId(row) === id ? { ...row, ...updated, estado: next } : row))
      );
    } catch (e) {
      const msg = e?.response?.data?.error?.message || e?.message || 'No se pudo actualizar el estado';
      showSnack(msg, 'error');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3, background: MARANA_COLORS.background, minHeight: '100vh' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Caja y stock
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Sesiones de caja, movimientos de efectivo e inventario vinculados a Strapi.
        </Typography>
      </Box>

      {loadErr && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadErr}
        </Alert>
      )}

      <Card sx={{ borderRadius: 3, border: `1px solid ${MARANA_COLORS.border}` }}>
        <Tabs
          value={mainTab}
          onChange={(_, v) => setMainTab(v)}
          sx={{
            px: 2,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
          }}
        >
          <Tab icon={<PointOfSaleIcon />} iconPosition="start" label="Caja" />
          <Tab icon={<Inventory2Icon />} iconPosition="start" label="Control de stock" />
        </Tabs>

        <CardContent sx={{ p: 3 }}>
          <TabPanel value={mainTab} index={0}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Estado
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 0.5 }}>
                    {cashSession ? (
                      <Chip label="Caja abierta" color="success" size="small" />
                    ) : (
                      <Chip label="Sin caja abierta" color="default" size="small" />
                    )}
                  </Typography>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
                    Balance estimado
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {money(balance)}
                  </Typography>
                  {!cashSession && (
                    <Button
                      variant="contained"
                      sx={{ mt: 2, textTransform: 'none', borderRadius: 2 }}
                      onClick={() => setOpenDialog(true)}
                      disabled={!restaurantId || cashLoading}
                    >
                      Abrir caja
                    </Button>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} md={8}>
                {cashSession && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                      Registrar movimiento
                    </Typography>
                    <Grid container spacing={1.5} alignItems="center">
                      <Grid item xs={12} sm={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Tipo</InputLabel>
                          <Select
                            label="Tipo"
                            value={movTipo}
                            onChange={(e) => setMovTipo(e.target.value)}
                          >
                            <MenuItem value="ingreso">Ingreso</MenuItem>
                            <MenuItem value="egreso">Egreso</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Monto"
                          value={movMonto}
                          onChange={(e) => setMovMonto(e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Concepto"
                          value={movConcepto}
                          onChange={(e) => setMovConcepto(e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <Button
                          fullWidth
                          variant="outlined"
                          onClick={handleAddMovement}
                          sx={{ textTransform: 'none', height: 40 }}
                        >
                          Agregar
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                )}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Movimientos de la sesión
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Tipo</TableCell>
                        <TableCell align="right">Monto</TableCell>
                        <TableCell>Concepto</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {movements.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4}>
                            <Typography variant="body2" color="text.secondary">
                              {cashSession ? 'No hay movimientos en esta sesión.' : 'Abrí caja para registrar movimientos.'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        movements.map((m) => (
                          <TableRow key={String(m.documentId ?? m.id)}>
                            <TableCell>{m.createdAt ? new Date(m.createdAt).toLocaleString('es-AR') : '—'}</TableCell>
                            <TableCell>{m.tipo}</TableCell>
                            <TableCell align="right">{money(m.monto)}</TableCell>
                            <TableCell>{m.concepto || '—'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={mainTab} index={1}>
            <Tabs
              value={stockSubTab}
              onChange={(_, v) => setStockSubTab(v)}
              sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}
            >
              <Tab label="Stock actual" />
              <Tab label="Movimientos" />
            </Tabs>
            {stockSubTab === 0 && (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nombre</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell align="right">Stock</TableCell>
                      <TableCell align="right">Mín.</TableCell>
                      <TableCell>Categoría</TableCell>
                      <TableCell>Unidad</TableCell>
                      <TableCell align="right">Costo</TableCell>
                      <TableCell>Producto</TableCell>
                      <TableCell align="center">Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stockLoading ? (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <Typography variant="body2">Cargando…</Typography>
                        </TableCell>
                      </TableRow>
                    ) : stockItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <Typography variant="body2" color="text.secondary">
                            No hay ítems de stock para este restaurante (o aún no están vinculados a un producto).
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockItems.map((row) => (
                        <TableRow key={String(row.documentId ?? row.id)}>
                          <TableCell>{row.nombre || '—'}</TableCell>
                          <TableCell>{row.sku || '—'}</TableCell>
                          <TableCell align="right">{row.stock_actual ?? '—'}</TableCell>
                          <TableCell align="right">{row.stock_minimo ?? '—'}</TableCell>
                          <TableCell>{row.categoria || '—'}</TableCell>
                          <TableCell>{row.unidad || '—'}</TableCell>
                          <TableCell align="right">{money(row.precio_costo)}</TableCell>
                          <TableCell>{productLabel(row)}</TableCell>
                          <TableCell align="center">
                            <Switch
                              checked={row.estado !== false}
                              onChange={(_, v) => handleEstadoChange(row, v)}
                              inputProps={{ 'aria-label': `estado-${row.sku}` }}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {stockSubTab === 1 && (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
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
                    {stockLoading ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2">Cargando…</Typography>
                        </TableCell>
                      </TableRow>
                    ) : stockMovements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary">
                            No hay movimientos de stock registrados.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockMovements.map((m) => {
                        const si = m.stock_item?.data ?? m.stock_item;
                        const itemFlat = si?.attributes ? { ...si.attributes, id: si.id, documentId: si.documentId } : si;
                        return (
                          <TableRow key={String(m.documentId ?? m.id)}>
                            <TableCell>{m.createdAt ? new Date(m.createdAt).toLocaleString('es-AR') : '—'}</TableCell>
                            <TableCell>{itemFlat?.nombre || '—'}</TableCell>
                            <TableCell>{m.tipo}</TableCell>
                            <TableCell align="right">{m.cantidad ?? '—'}</TableCell>
                            <TableCell>{m.motivo || '—'}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>
        </CardContent>
      </Card>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>Abrir caja</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Monto inicial"
            fullWidth
            value={montoInicial}
            onChange={(e) => setMontoInicial(e.target.value)}
            placeholder="0"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button onClick={handleOpenCaja} variant="contained" sx={{ textTransform: 'none' }}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
