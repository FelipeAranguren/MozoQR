import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container, Typography, Box, Card, CardContent, TextField, Button,
  CircularProgress, Alert, List, ListItem, ListItemText, Chip, Stack,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import {
  fetchMyLoyalty, updateLoyaltyProfile, fetchLoyaltyTransactions,
} from '../api/loyalty';

export default function MiCuenta() {
  const { user, jwt } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [profile, setProfile] = useState({ fullname: '', phone: '', birthday: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [txByAccount, setTxByAccount] = useState({});

  useEffect(() => {
    if (!jwt) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await fetchMyLoyalty();
        setAccounts(data?.accounts || []);
        const u = data?.user || user;
        setProfile({
          fullname: u?.fullname || '',
          phone: u?.phone || '',
          birthday: u?.birthday ? String(u.birthday).slice(0, 10) : '',
        });
      } catch (e) {
        setError(e?.response?.data?.error?.message || 'Error al cargar');
      } finally {
        setLoading(false);
      }
    })();
  }, [jwt, user]);

  const loadTx = async (accountId) => {
    try {
      const txs = await fetchLoyaltyTransactions(accountId);
      setTxByAccount((prev) => ({ ...prev, [accountId]: txs }));
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateLoyaltyProfile(profile);
      setError('');
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al guardar');
    }
    setSaving(false);
  };

  if (!jwt) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Iniciá sesión para ver tus puntos de fidelización.
        </Alert>
        <Button component={RouterLink} to="/login" variant="contained">
          Iniciar sesión
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Mi cuenta
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Datos personales</Typography>
          <Stack spacing={2}>
            <TextField label="Nombre" value={profile.fullname} onChange={(e) => setProfile((p) => ({ ...p, fullname: e.target.value }))} />
            <TextField label="Teléfono" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
            <TextField type="date" label="Cumpleaños" InputLabelProps={{ shrink: true }} value={profile.birthday} onChange={(e) => setProfile((p) => ({ ...p, birthday: e.target.value }))} />
            <Typography variant="body2" color="text.secondary">Email: {user?.email}</Typography>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 2 }}>Puntos por restaurante</Typography>
      {loading ? (
        <CircularProgress />
      ) : accounts.length === 0 ? (
        <Alert severity="info">Todavía no sumaste puntos. Pedí en un local con programa activo estando logueado.</Alert>
      ) : (
        accounts.map((acc) => (
          <Card key={acc.id} sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {acc.restaurante?.name || 'Restaurante'}
                </Typography>
                <Chip label={`${acc.pointsBalance || 0} pts`} color="primary" />
              </Box>
              {acc.restaurante?.slug && (
                <Button size="small" component={RouterLink} to={`/${acc.restaurante.slug}/menu`} sx={{ mb: 1 }}>
                  Ir al menú
                </Button>
              )}
              <Button size="small" onClick={() => loadTx(acc.id)}>
                Ver movimientos
              </Button>
              {txByAccount[acc.id] && (
                <List dense sx={{ mt: 1 }}>
                  {txByAccount[acc.id].map((tx) => (
                    <ListItem key={tx.id}>
                      <ListItemText
                        primary={`${tx.delta > 0 ? '+' : ''}${tx.delta} pts · ${tx.reason}`}
                        secondary={tx.notes}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </Container>
  );
}
