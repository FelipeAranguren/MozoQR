import React, { useEffect, useState } from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton, Alert, CircularProgress, Button } from '@mui/material';
import { MARANA_COLORS } from '../../../theme';
import { fetchRestaurantMenuDesign, updateRestaurantMenuDesign } from '../../../api/menuDesign';

export default function MenuDesignManagement({ slug }) {
  const [design, setDesign] = useState('v2');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage({ type: '', text: '' });
    fetchRestaurantMenuDesign(slug)
      .then((value) => {
        if (!cancelled) setDesign(value);
      })
      .catch(() => {
        if (!cancelled) setDesign('v2');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleChangeDesign = async (_event, nextValue) => {
    if (!nextValue || nextValue === design || saving) return;
    const prev = design;
    setDesign(nextValue);
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await updateRestaurantMenuDesign(slug, nextValue);
      setMessage({ type: 'success', text: 'Diseño guardado correctamente.' });
    } catch (err) {
      setDesign(prev);
      setMessage({
        type: 'error',
        text: err?.response?.data?.error?.message || err?.message || 'No se pudo guardar el diseño.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
        Elegí el diseño del menú para tus clientes
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        El cambio impacta en la URL pública del menú (`/{slug}/menu`).
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">Cargando diseño actual...</Typography>
        </Box>
      ) : (
        <ToggleButtonGroup
          value={design}
          exclusive
          onChange={handleChangeDesign}
          size="large"
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 700,
              px: 3,
              border: `1px solid ${MARANA_COLORS.border}`,
              '&.Mui-selected': {
                bgcolor: MARANA_COLORS.primary,
                color: '#fff',
                '&:hover': { bgcolor: MARANA_COLORS.primary, opacity: 0.9 },
              },
            },
          }}
        >
          <ToggleButton value="v1" disabled={saving}>Diseño Clásico</ToggleButton>
          <ToggleButton value="v2" disabled={saving}>Diseño Moderno</ToggleButton>
        </ToggleButtonGroup>
      )}

      {message.text && (
        <Alert
          severity={message.type === 'error' ? 'error' : 'success'}
          sx={{ mt: 2 }}
        >
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              whiteSpace: 'nowrap',
              flexWrap: 'nowrap',
            }}
          >
            <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
              {message.text}
            </Box>
            {message.type !== 'error' ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => window.open(`/${slug}/menu`, '_blank', 'noopener,noreferrer')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  minWidth: 'auto',
                  p: 0,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                Ver menú
              </Button>
            ) : null}
          </Box>
        </Alert>
      )}
    </Box>
  );
}
