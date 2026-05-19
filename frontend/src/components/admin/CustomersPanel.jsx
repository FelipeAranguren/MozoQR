import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Table, TableBody, TableCell, TableHead, TableRow,
  TableContainer, Paper, CircularProgress, Chip, MenuItem, TablePagination, Stack, Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { fetchAdminCustomers } from '../../api/admin';
import UserDetailDialog from './UserDetailDialog';
import { COLORS } from '../../theme';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
}

export default function CustomersPanel({ restaurantes = [] }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [restauranteId, setRestauranteId] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [detailUserId, setDetailUserId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAdminCustomers({
        search: search || undefined,
        restauranteId: restauranteId || undefined,
        page: page + 1,
        pageSize,
      });
      setRows(res?.data || []);
      setMeta(res?.meta || null);
    } catch (e) {
      console.error(e);
      setRows([]);
      setError(e?.response?.data?.error?.message || 'No se pudieron cargar los clientes');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, pageSize, restauranteId]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Comensales que iniciaron sesión en la app, pidieron con cuenta o tienen puntos de fidelización.
        Hacé clic en una fila para ver historial, editar datos y ajustar puntos.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }} alignItems="center">
        <TextField
          size="small"
          label="Buscar email, nombre o teléfono"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(0), load())}
          sx={{ minWidth: 260 }}
        />
        <TextField
          size="small"
          select
          label="Restaurante"
          value={restauranteId}
          onChange={(e) => { setRestauranteId(e.target.value); setPage(0); }}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {(restaurantes || []).map((r) => (
            <MenuItem key={r.id} value={String(r.id)}>{r.name || r.slug}</MenuItem>
          ))}
        </TextField>
        <Button variant="contained" startIcon={<SearchIcon />} onClick={() => { setPage(0); load(); }}>
          Buscar
        </Button>
        {meta?.pagination?.total != null && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            {meta.pagination.total} cliente(s)
          </Typography>
        )}
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: COLORS.bgAlt }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Cliente</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Teléfono</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Pedidos</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Gastado</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Puntos</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Último pedido</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Acción</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      No hay clientes con actividad registrada todavía.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((c) => (
                  <TableRow
                    key={c.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setDetailUserId(c.id)}
                  >
                    <TableCell sx={{ fontWeight: 500 }}>{c.fullname || c.username || '—'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.email}</TableCell>
                    <TableCell>{c.phone || '—'}</TableCell>
                    <TableCell align="right">{c.stats?.orderCount ?? 0}</TableCell>
                    <TableCell align="right">{formatMoney(c.stats?.totalSpent)}</TableCell>
                    <TableCell align="right">
                      {(c.stats?.loyaltyPoints ?? 0) > 0 ? (
                        <Chip size="small" label={c.stats.loyaltyPoints} color="secondary" />
                      ) : '—'}
                    </TableCell>
                    <TableCell>{formatDate(c.stats?.lastOrderAt)}</TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{ textTransform: 'none' }}
                        onClick={() => setDetailUserId(c.id)}
                      >
                        Ver ficha
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            count={meta?.pagination?.total || 0}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100]}
            labelRowsPerPage="Filas"
          />
        </>
      )}

      <UserDetailDialog
        userId={detailUserId}
        open={Boolean(detailUserId)}
        onClose={() => setDetailUserId(null)}
        onUpdated={load}
        customerMode
      />
    </Box>
  );
}
