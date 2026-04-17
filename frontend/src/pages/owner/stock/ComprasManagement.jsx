import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Button,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { fetchCompras, recibirCompra, cancelarCompra } from '../../../api/stock';
import NuevaCompraDialog from './NuevaCompraDialog';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openNew, setOpenNew] = useState(false);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    loadCompras();
  }, [loadCompras]);

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

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate(`/owner/${slug}/stock`)}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={700} sx={{ flex: 1 }}>
          Compras
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenNew(true)}>
          Nueva compra
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
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
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No hay compras registradas</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {compras.map((c) => {
                  const st = STATUS_MAP[c.status] || STATUS_MAP.pendiente;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>{formatDate(c.date)}</TableCell>
                      <TableCell>{c.supplier || '-'}</TableCell>
                      <TableCell>
                        {(c.items || [])
                          .map((it) => it.producto?.name || `#${it.producto?.id || '?'}`)
                          .join(', ')}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {formatCurrency(c.total)}
                      </TableCell>
                      <TableCell>
                        <Chip label={st.label} color={st.color} size="small" />
                      </TableCell>
                      <TableCell>
                        {c.status === 'pendiente' && (
                          <Stack direction="row" spacing={0.5}>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              onClick={() => handleRecibir(c.id)}
                              disabled={saving}
                            >
                              Recibir
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() => handleCancelar(c.id)}
                              disabled={saving}
                            >
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

      <NuevaCompraDialog
        open={openNew}
        onClose={() => setOpenNew(false)}
        slug={slug}
        onCreated={loadCompras}
      />
    </Box>
  );
}
