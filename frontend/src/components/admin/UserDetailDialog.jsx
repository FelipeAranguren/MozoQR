import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  TextField, Chip, Stack, Divider, Table, TableBody, TableCell, TableHead, TableRow,
  CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import SaveIcon from '@mui/icons-material/Save';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import HistoryIcon from '@mui/icons-material/History';
import {
  fetchAdminUserDetail,
  updateAdminUser,
  impersonateAdminUser,
  adjustAdminUserLoyalty,
  resetUserPassword,
  toggleBlockUser,
} from '../../api/admin';
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR');
}

const ORDER_STATUS_LABELS = {
  pending: 'Pendiente',
  preparing: 'En cocina',
  served: 'Servido',
  paid: 'Pagado',
  cancelled: 'Cancelado',
};

const TX_REASON_LABELS = {
  earn: 'Suma por compra',
  redeem: 'Canje',
  adjust: 'Ajuste manual',
  expire: 'Vencimiento',
};

export default function UserDetailDialog({ userId, open, onClose, onUpdated, customerMode = false }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({});
  const [loyaltyDelta, setLoyaltyDelta] = useState({});
  const [adjustingId, setAdjustingId] = useState(null);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminUserDetail(userId);
      setDetail(data);
      const u = data?.user || {};
      setForm({
        fullname: u.fullname || '',
        email: u.email || '',
        username: u.username || '',
        phone: u.phone || '',
        birthday: u.birthday ? String(u.birthday).slice(0, 10) : '',
      });
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'No se pudo cargar el usuario');
      setDetail(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && userId) load();
  }, [open, userId]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateAdminUser(userId, form);
      await load();
      onUpdated?.();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al guardar');
    }
    setSaving(false);
  };

  const handleImpersonate = async (slug) => {
    try {
      const res = await impersonateAdminUser(userId, slug);
      if (res?.jwt && res?.slug) {
        const url = `${window.location.origin}/admin/impersonate?token=${res.jwt}&slug=${res.slug}`;
        window.open(url, '_blank');
      }
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'No se pudo entrar como este usuario');
    }
  };

  const handleAdjustLoyalty = async (accountId) => {
    const delta = Number(loyaltyDelta[accountId]);
    if (!delta) return;
    setAdjustingId(accountId);
    try {
      await adjustAdminUserLoyalty(userId, accountId, delta, 'Ajuste Super Admin');
      setLoyaltyDelta((prev) => ({ ...prev, [accountId]: '' }));
      await load();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al ajustar puntos');
    }
    setAdjustingId(null);
  };

  const user = detail?.user;
  const members = (user?.restaurant_members || []).filter((m) => m.active !== false);
  const legacy = detail?.legacyOwnerRestaurants || [];
  const loyalty = detail?.loyaltyAccounts || [];
  const orders = detail?.orders || [];
  const loyaltyTransactions = detail?.loyaltyTransactions || [];
  const orderStats = detail?.orderStats;

  const accessRows = [
    ...members.map((m) => ({
      key: `m-${m.id}`,
      name: m.restaurante?.name,
      slug: m.restaurante?.slug,
      role: m.role,
      type: 'membership',
    })),
    ...legacy.map((r) => ({
      key: `l-${r.id}`,
      name: r.name,
      slug: r.slug,
      role: 'owner (legacy)',
      type: 'legacy',
    })),
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        {customerMode ? 'Ficha de cliente' : 'Detalle de usuario'}
        {user?.email && (
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {user.email}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : !user ? (
          <Typography color="text.secondary">Usuario no encontrado</Typography>
        ) : (
          <Stack spacing={3}>
            <Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                {user.role?.name && <Chip size="small" label={`Rol Strapi: ${user.role.name}`} />}
                {detail?.isPlatformAdmin && <Chip size="small" color="primary" label="Super Admin" />}
                {user.blocked ? (
                  <Chip size="small" color="error" label="Bloqueado" />
                ) : (
                  <Chip size="small" color="success" label="Activo" />
                )}
                <Chip size="small" variant="outlined" label={`ID ${user.id}`} />
                {orderStats && (
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={<ReceiptLongIcon />}
                    label={`${orderStats.orderCount} pedidos · ${orderStats.paidOrderCount} pagados`}
                  />
                )}
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                Datos personales
              </Typography>
              <Stack spacing={1.5}>
                <TextField
                  label="Nombre completo"
                  size="small"
                  fullWidth
                  value={form.fullname}
                  onChange={(e) => setForm((f) => ({ ...f, fullname: e.target.value }))}
                />
                <TextField
                  label="Email"
                  size="small"
                  fullWidth
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                <TextField
                  label="Username"
                  size="small"
                  fullWidth
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField
                    label="Teléfono"
                    size="small"
                    fullWidth
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                  <TextField
                    label="Cumpleaños"
                    type="date"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={form.birthday}
                    onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Registrado: {formatDate(user.createdAt)} · Provider: {user.provider || 'local'}
                </Typography>
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptLongIcon fontSize="small" />
                Historial de pedidos
                {orderStats?.totalSpent > 0 && (
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
                    · Total pagado: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(orderStats.totalSpent)}
                  </Typography>
                )}
              </Typography>
              {orders.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sin pedidos vinculados a esta cuenta (pedidos anónimos no aparecen aquí).
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Fecha</TableCell>
                      <TableCell>Restaurante</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">Pts</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>{formatDate(o.createdAt)}</TableCell>
                        <TableCell>{o.restaurante?.name || o.restaurante?.slug || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={ORDER_STATUS_LABELS[o.order_status] || o.order_status}
                            color={o.order_status === 'paid' ? 'success' : o.order_status === 'cancelled' ? 'default' : 'warning'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(o.total || 0)}
                        </TableCell>
                        <TableCell align="right">
                          {o.loyalty_points_earned ? `+${o.loyalty_points_earned}` : o.loyalty_points_redeemed ? `-${o.loyalty_points_redeemed}` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CardGiftcardIcon fontSize="small" />
                Fidelización
              </Typography>
              {loyalty.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sin cuentas de puntos (el usuario no sumó puntos o el programa no está activo).
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Restaurante</TableCell>
                      <TableCell align="right">Puntos</TableCell>
                      <TableCell align="right">Histórico</TableCell>
                      <TableCell align="right">Ajuste</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loyalty.map((acc) => (
                      <TableRow key={acc.id}>
                        <TableCell>{acc.restaurante?.name || acc.restaurante?.slug}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {acc.pointsBalance ?? 0}
                        </TableCell>
                        <TableCell align="right">{acc.lifetimePoints ?? 0}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <TextField
                              size="small"
                              placeholder="+/-"
                              type="number"
                              sx={{ width: 72 }}
                              value={loyaltyDelta[acc.id] ?? ''}
                              onChange={(e) =>
                                setLoyaltyDelta((prev) => ({ ...prev, [acc.id]: e.target.value }))
                              }
                            />
                            <Button
                              size="small"
                              variant="contained"
                              disabled={adjustingId === acc.id}
                              onClick={() => handleAdjustLoyalty(acc.id)}
                            >
                              {adjustingId === acc.id ? '…' : 'OK'}
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>

            {loyaltyTransactions.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HistoryIcon fontSize="small" />
                    Movimientos de puntos
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Restaurante</TableCell>
                        <TableCell>Motivo</TableCell>
                        <TableCell align="right">Puntos</TableCell>
                        <TableCell>Notas</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loyaltyTransactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>{formatDate(tx.createdAt)}</TableCell>
                          <TableCell>
                            {tx.loyalty_account?.restaurante?.name || '—'}
                          </TableCell>
                          <TableCell>{TX_REASON_LABELS[tx.reason] || tx.reason}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: tx.delta > 0 ? 'success.main' : 'error.main' }}>
                            {tx.delta > 0 ? `+${tx.delta}` : tx.delta}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {tx.notes || (tx.pedido?.id ? `Pedido #${tx.pedido.id}` : '—')}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </>
            )}

            {!customerMode && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                    Acceso a restaurantes (dueño / staff)
                  </Typography>
                  {accessRows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Sin acceso a paneles de dueño o staff.
                    </Typography>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Restaurante</TableCell>
                          <TableCell>Rol</TableCell>
                          <TableCell align="right">Panel</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {accessRows.map((row) => (
                          <TableRow key={row.key}>
                            <TableCell>
                              {row.name}
                              <Typography variant="caption" display="block" sx={{ fontFamily: 'monospace' }}>
                                {row.slug}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip size="small" label={row.role} color={row.type === 'legacy' ? 'warning' : 'default'} />
                            </TableCell>
                            <TableCell align="right">
                              {row.slug && (
                                <Tooltip title="Entrar al panel como este usuario">
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<LoginIcon />}
                                    onClick={() => handleImpersonate(row.slug)}
                                  >
                                    Entrar
                                  </Button>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Box>
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button
          color="warning"
          onClick={async () => {
            const pw = window.prompt('Nueva contraseña (mín. 6 caracteres):');
            if (!pw || pw.length < 6) return;
            try {
              await resetUserPassword(userId, pw);
              alert('Contraseña actualizada');
            } catch (e) {
              setError(e?.response?.data?.error?.message || 'Error');
            }
          }}
        >
          Resetear contraseña
        </Button>
        <Button
          color={user?.blocked ? 'success' : 'error'}
          onClick={async () => {
            try {
              await toggleBlockUser(userId);
              await load();
              onUpdated?.();
            } catch (e) {
              setError(e?.response?.data?.error?.message || 'Error');
            }
          }}
        >
          {user?.blocked ? 'Desbloquear' : 'Bloquear'}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cerrar</Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={saving || loading}
          onClick={handleSaveProfile}
        >
          {saving ? 'Guardando…' : 'Guardar datos'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
