import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container, Typography, Box, Card, CardContent, Switch, FormControlLabel,
  TextField, MenuItem, Button, Table, TableBody, TableCell, TableHead, TableRow,
  Alert, CircularProgress, IconButton, Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import {
  fetchOwnerLoyaltyProgram, updateOwnerLoyaltyProgram,
  fetchOwnerLoyaltyAccounts, adjustOwnerLoyaltyAccount,
} from '../../../api/loyalty';

export default function LoyaltyManagement() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [adjustId, setAdjustId] = useState(null);
  const [adjustDelta, setAdjustDelta] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [p, acc] = await Promise.all([
        fetchOwnerLoyaltyProgram(slug),
        fetchOwnerLoyaltyAccounts(slug),
      ]);
      setProgram(p);
      setAccounts(acc || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { if (slug) load(); }, [slug]);

  const saveProgram = async () => {
    setSaving(true);
    try {
      await updateOwnerLoyaltyProgram(slug, program);
    } finally {
      setSaving(false);
    }
  };

  const updateTier = (idx, field, value) => {
    const tiers = [...(program.redemptionTiers || [])];
    tiers[idx] = { ...tiers[idx], [field]: Number(value) };
    setProgram((p) => ({ ...p, redemptionTiers: tiers }));
  };

  const addTier = () => {
    setProgram((p) => ({
      ...p,
      redemptionTiers: [...(p.redemptionTiers || []), { points: 100, discountPercent: 10 }],
    }));
  };

  const removeTier = (idx) => {
    setProgram((p) => ({
      ...p,
      redemptionTiers: (p.redemptionTiers || []).filter((_, i) => i !== idx),
    }));
  };

  const exportEmails = () => {
    const rows = accounts.map((a) => {
      const u = a.users_permissions_user;
      return [u?.email, u?.fullname, a.pointsBalance].join(',');
    });
    const csv = ['email,nombre,puntos', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = `clientes-fidelidad-${slug}.csv`;
    el.click();
    URL.revokeObjectURL(url);
  };

  const handleAdjust = async (accountId) => {
    const delta = Number(adjustDelta);
    if (!delta) return;
    await adjustOwnerLoyaltyAccount(slug, accountId, delta, 'Ajuste manual');
    setAdjustId(null);
    setAdjustDelta('');
    await load();
  };

  if (loading || !program) {
    return (
      <Container sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Fidelización
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(program.enabled)}
                onChange={(e) => setProgram((p) => ({ ...p, enabled: e.target.checked }))}
              />
            }
            label="Programa activo"
          />
          <TextField
            select fullWidth margin="normal" label="Modo de puntos"
            value={program.earnMode || 'money'}
            onChange={(e) => setProgram((p) => ({ ...p, earnMode: e.target.value }))}
          >
            <MenuItem value="money">Por monto gastado</MenuItem>
            <MenuItem value="visit">Por visita</MenuItem>
            <MenuItem value="both">Ambos</MenuItem>
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Puntos cada $100"
              type="number"
              value={program.pointsPerCurrency ?? 1}
              onChange={(e) => setProgram((p) => ({ ...p, pointsPerCurrency: e.target.value }))}
            />
            <TextField
              label="Puntos por visita"
              type="number"
              value={program.pointsPerVisit ?? 1}
              onChange={(e) => setProgram((p) => ({ ...p, pointsPerVisit: e.target.value }))}
            />
            <TextField
              label="Mínimo pedido para sumar"
              type="number"
              value={program.minOrderToEarn ?? ''}
              onChange={(e) => setProgram((p) => ({ ...p, minOrderToEarn: e.target.value }))}
            />
          </Stack>

          <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>
            Niveles de canje (% descuento)
          </Typography>
          {(program.redemptionTiers || []).map((tier, idx) => (
            <Stack key={idx} direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
              <TextField size="small" label="Puntos" type="number" value={tier.points}
                onChange={(e) => updateTier(idx, 'points', e.target.value)} />
              <TextField size="small" label="% desc." type="number" value={tier.discountPercent}
                onChange={(e) => updateTier(idx, 'discountPercent', e.target.value)} />
              <IconButton onClick={() => removeTier(idx)}><DeleteIcon /></IconButton>
            </Stack>
          ))}
          <Button startIcon={<AddIcon />} onClick={addTier} sx={{ mt: 1 }}>Agregar nivel</Button>
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" onClick={saveProgram} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar configuración'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Clientes ({accounts.length})</Typography>
        <Button startIcon={<DownloadIcon />} onClick={exportEmails} disabled={!accounts.length}>
          Exportar emails CSV
        </Button>
      </Box>

      {accounts.length === 0 ? (
        <Alert severity="info">Aún no hay clientes con cuenta de fidelización.</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Cumpleaños</TableCell>
              <TableCell>Puntos</TableCell>
              <TableCell>Ajuste</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((a) => {
              const u = a.users_permissions_user;
              return (
                <TableRow key={a.id}>
                  <TableCell>{u?.email}</TableCell>
                  <TableCell>{u?.fullname || '-'}</TableCell>
                  <TableCell>{u?.birthday ? String(u.birthday).slice(0, 10) : '-'}</TableCell>
                  <TableCell>{a.pointsBalance}</TableCell>
                  <TableCell>
                    {adjustId === a.id ? (
                      <Stack direction="row" spacing={1}>
                        <TextField size="small" placeholder="+/-" value={adjustDelta}
                          onChange={(e) => setAdjustDelta(e.target.value)} sx={{ width: 80 }} />
                        <Button size="small" onClick={() => handleAdjust(a.id)}>OK</Button>
                      </Stack>
                    ) : (
                      <Button size="small" onClick={() => setAdjustId(a.id)}>Ajustar</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Container>
  );
}
