// frontend/src/components/TableSelector.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Snackbar,
  Skeleton,
} from '@mui/material';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { fetchTables, fetchRestaurantName } from '../api/tables';
import { withRetry } from '../utils/retry';

export default function TableSelector() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [restaurantName, setRestaurantName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [customTableDialog, setCustomTableDialog] = useState(false);
  const [customTableNumber, setCustomTableNumber] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const menuUrl = typeof window !== 'undefined' ? `${window.location.origin}/${slug}/menu` : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setSnackbar({ open: true, message: 'Link copiado al portapapeles' });
    } catch {
      setSnackbar({ open: true, message: 'No se pudo copiar el link' });
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`Mirá el menú acá: ${menuUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    loadTables();
  }, [slug]);

  useEffect(() => {
    document.title = restaurantName ? `${restaurantName} | MozoQR` : 'Seleccionar mesa | MozoQR';
    return () => { document.title = 'MozoQR'; };
  }, [restaurantName]);

  const loadTables = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [tablesData, name] = await withRetry(() => Promise.all([
        fetchTables(slug),
        fetchRestaurantName(slug),
      ]), { maxRetries: 2, delayMs: 1500 });
      setTables(tablesData || []);
      setRestaurantName(name || '');
    } catch (error) {
      console.error('Error loading tables:', error);
      setTables([]);
      setLoadError(error?.message || 'No se pudieron cargar las mesas. Revisá tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  const handleTableSelect = (tableNumber) => {
    navigate(`/${slug}/menu?t=${tableNumber}`);
  };

  const handleCustomTable = () => {
    if (customTableNumber && !isNaN(Number(customTableNumber))) {
      handleTableSelect(Number(customTableNumber));
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Skeleton variant="circular" width={64} height={64} sx={{ mx: 'auto', mb: 2 }} />
          <Skeleton variant="text" width={200} height={36} sx={{ mx: 'auto', mb: 1 }} />
          <Skeleton variant="text" width={320} height={24} sx={{ mx: 'auto' }} />
        </Box>
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid item xs={6} sm={4} md={3} key={i}>
              <Card sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Skeleton variant="circular" width={48} height={48} sx={{ mb: 1 }} />
                  <Skeleton variant="text" width={40} height={32} />
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Box sx={{ textAlign: 'center' }}>
          <Skeleton variant="rounded" width={280} height={40} sx={{ mx: 'auto' }} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <TableRestaurantIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        {restaurantName && (
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            {restaurantName}
          </Typography>
        )}
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Selecciona tu Mesa
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Elige la mesa donde te encuentras para comenzar a hacer tu pedido
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
            Compartir menú:
          </Typography>
          <Tooltip title="Copiar link">
            <IconButton size="small" onClick={handleCopyLink} color="primary" aria-label="Copiar link">
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Compartir por WhatsApp">
            <IconButton size="small" onClick={handleShareWhatsApp} color="primary" aria-label="Compartir por WhatsApp">
              <ShareIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {tables.length > 0 ? (
        <>
          <Grid container spacing={2} sx={{ mb: 4 }}>
            {tables.map((table) => (
              <Grid item xs={6} sm={4} md={3} key={table.id}>
                <Card
                  sx={{
                    height: '100%',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6,
                    },
                  }}
                >
                  <CardActionArea
                    onClick={() => handleTableSelect(table.number)}
                    sx={{ height: '100%', p: 2 }}
                  >
                    <CardContent sx={{ textAlign: 'center', p: '0 !important' }}>
                      <TableRestaurantIcon
                        sx={{
                          fontSize: 48,
                          color: 'primary.main',
                          mb: 1,
                        }}
                      />
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                        {table.number}
                      </Typography>
                      {table.displayName && table.displayName !== `Mesa ${table.number}` && (
                        <Typography variant="caption" color="text.secondary">
                          {table.displayName}
                        </Typography>
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ textAlign: 'center' }}>
            <Button
              variant="outlined"
              onClick={() => setCustomTableDialog(true)}
              sx={{ textTransform: 'none' }}
            >
              ¿No encuentras tu mesa? Ingresa el número manualmente
            </Button>
          </Box>
        </>
      ) : loadError ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="error" sx={{ mb: 2 }}>
            Error al cargar las mesas
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {loadError}
          </Typography>
          <Button variant="outlined" onClick={loadTables} sx={{ textTransform: 'none', mb: 3 }}>
            Reintentar
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            O ingresá el número de tu mesa para continuar
          </Typography>
          <TextField
            label="Número de mesa"
            type="number"
            value={customTableNumber}
            onChange={(e) => setCustomTableNumber(e.target.value)}
            sx={{ mb: 2, maxWidth: 300 }}
            InputProps={{ inputProps: { min: 1 } }}
          />
          <Box>
            <Button
              variant="contained"
              onClick={handleCustomTable}
              disabled={!customTableNumber || isNaN(Number(customTableNumber))}
              sx={{ textTransform: 'none' }}
            >
              Continuar
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            No hay mesas configuradas
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Ingresa el número de tu mesa para continuar
          </Typography>
          <TextField
            label="Número de mesa"
            type="number"
            value={customTableNumber}
            onChange={(e) => setCustomTableNumber(e.target.value)}
            sx={{ mb: 2, maxWidth: 300 }}
            InputProps={{
              inputProps: { min: 1 },
            }}
          />
          <Box>
            <Button
              variant="contained"
              onClick={handleCustomTable}
              disabled={!customTableNumber || isNaN(Number(customTableNumber))}
              sx={{ textTransform: 'none' }}
            >
              Continuar
            </Button>
          </Box>
        </Box>
      )}

      {/* Dialog para mesa personalizada */}
      <Dialog
        open={customTableDialog}
        onClose={() => setCustomTableDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Ingresa el número de tu mesa</DialogTitle>
        <DialogContent>
          <TextField
            label="Número de mesa"
            type="number"
            value={customTableNumber}
            onChange={(e) => setCustomTableNumber(e.target.value)}
            fullWidth
            sx={{ mt: 2 }}
            InputProps={{
              inputProps: { min: 1 },
            }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomTableDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleCustomTable}
            disabled={!customTableNumber || isNaN(Number(customTableNumber))}
          >
            Continuar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
}

