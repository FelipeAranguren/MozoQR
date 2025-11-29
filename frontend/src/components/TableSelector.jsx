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
  CircularProgress,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import { fetchTables } from '../api/tables';

export default function TableSelector() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customTableDialog, setCustomTableDialog] = useState(false);
  const [customTableNumber, setCustomTableNumber] = useState('');

  useEffect(() => {
    loadTables();
  }, [slug]);

  const loadTables = async () => {
    try {
      setLoading(true);
      const tablesData = await fetchTables(slug);
      setTables(tablesData || []);
    } catch (error) {
      console.error('Error loading tables:', error);
      setTables([]);
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
      <Container maxWidth="md" sx={{ py: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <TableRestaurantIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Selecciona tu Mesa
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Elige la mesa donde te encuentras para comenzar a hacer tu pedido
        </Typography>
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
    </Container>
  );
}

