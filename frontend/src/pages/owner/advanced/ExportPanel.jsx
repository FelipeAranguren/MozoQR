// frontend/src/pages/owner/advanced/ExportPanel.jsx
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  TextField,
  Alert,
  CircularProgress,
  MenuItem,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import { MARANA_COLORS } from '../../../theme';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import { api } from '../../../api';

export default function ExportPanel({ slug }) {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [status, setStatus] = useState('paid');
  const [exportType, setExportType] = useState('csv');

  const handleExport = async (type) => {
    if (!slug) return;

    try {
      setLoading(true);

      if (type === 'csv') {
        // Exportar CSV usando el endpoint existente
        const params = new URLSearchParams();
        if (dateRange.start) params.set('start', dateRange.start);
        if (dateRange.end) params.set('end', dateRange.end);
        if (status) params.set('status', status);

        const url = `/restaurants/${slug}/export?${params.toString()}`;
        const response = await api.get(url, {
          responseType: 'blob',
          headers: {
            'Accept': 'text/csv'
          }
        });

        // Crear blob y descargar
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `export_${slug}_${dateRange.start}_${dateRange.end}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      } else if (type === 'pdf') {
        // Para PDF, generar en el cliente (usando jsPDF o similar)
        // Por ahora mostramos un mensaje
        alert('Exportación PDF próximamente disponible. Por ahora usa CSV.');
      }
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Error al exportar. Verifica los datos y vuelve a intentar.');
    } finally {
      setLoading(false);
    }
  };

  const exportOptions = [
    {
      title: 'Pedidos',
      description: 'Exporta todos los pedidos con detalles de productos, mesas y pagos',
      icon: <DescriptionIcon sx={{ fontSize: 40, color: MARANA_COLORS.primary }} />,
      type: 'orders'
    },
    {
      title: 'Productos',
      description: 'Exporta catálogo completo de productos con precios y categorías',
      icon: <DescriptionIcon sx={{ fontSize: 40, color: MARANA_COLORS.secondary }} />,
      type: 'products'
    },
    {
      title: 'Ventas',
      description: 'Exporta resumen de ventas por período con totales y promedios',
      icon: <DescriptionIcon sx={{ fontSize: 40, color: MARANA_COLORS.accent }} />,
      type: 'sales'
    }
  ];

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
        Exportar Datos
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Exporta tus datos en formato CSV para análisis externo o respaldo. El formato PDF estará disponible próximamente.
      </Alert>

      {/* Filtros de exportación */}
      <Card sx={{ mb: 3, border: `1px solid ${MARANA_COLORS.border}` }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
            Filtros de Exportación
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Fecha Inicio"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Fecha Fin"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Estado</InputLabel>
                <Select
                  value={status}
                  label="Estado"
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <MenuItem value="paid">Pagados</MenuItem>
                  <MenuItem value="pending">Pendientes</MenuItem>
                  <MenuItem value="all">Todos</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Formato</InputLabel>
                <Select
                  value={exportType}
                  label="Formato"
                  onChange={(e) => setExportType(e.target.value)}
                >
                  <MenuItem value="csv">CSV</MenuItem>
                  <MenuItem value="pdf" disabled>PDF (Próximamente)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Opciones de exportación */}
      <Grid container spacing={3}>
        {exportOptions.map((option) => (
          <Grid item xs={12} md={4} key={option.type}>
            <Card
              sx={{
                height: '100%',
                border: `1px solid ${MARANA_COLORS.border}`,
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: `0px 8px 24px ${MARANA_COLORS.primary}15`,
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <Box sx={{ mb: 2 }}>
                  {option.icon}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {option.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {option.description}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={exportType === 'csv' ? <FileDownloadIcon /> : <PictureAsPdfIcon />}
                  onClick={() => handleExport(exportType)}
                  disabled={loading}
                  fullWidth
                  sx={{
                    bgcolor: MARANA_COLORS.primary,
                    '&:hover': {
                      bgcolor: MARANA_COLORS.primary,
                      opacity: 0.9
                    }
                  }}
                >
                  {loading ? <CircularProgress size={20} /> : `Exportar ${exportType.toUpperCase()}`}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

