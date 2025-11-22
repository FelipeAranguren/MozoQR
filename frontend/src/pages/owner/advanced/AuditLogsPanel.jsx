// frontend/src/pages/owner/advanced/AuditLogsPanel.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress
} from '@mui/material';
import { MARANA_COLORS } from '../../../theme';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';

export default function AuditLogsPanel({ slug }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Simular carga de logs (en producción vendría de la API)
    const loadLogs = async () => {
      setLoading(true);
      // TODO: Implementar llamada real a API de logs
      // Por ahora mostramos datos de ejemplo
      setTimeout(() => {
        setLogs([
          {
            id: 1,
            timestamp: new Date().toISOString(),
            user: 'marioealfonzo',
            action: 'Crear producto',
            entity: 'Producto: Big Mac',
            details: 'Precio: $1500',
            ip: '192.168.1.1'
          },
          {
            id: 2,
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            user: 'marioealfonzo',
            action: 'Actualizar producto',
            entity: 'Producto: Mc Nuggets',
            details: 'Precio actualizado: $1200 → $1300',
            ip: '192.168.1.1'
          },
          {
            id: 3,
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            user: 'marioealfonzo',
            action: 'Eliminar producto',
            entity: 'Producto: Mc Flurry',
            details: 'Producto eliminado del menú',
            ip: '192.168.1.1'
          }
        ]);
        setLoading(false);
      }, 500);
    };

    if (slug) {
      loadLogs();
    }
  }, [slug]);

  const filteredLogs = logs.filter(log =>
    log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.entity.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
  };

  const getActionColor = (action) => {
    if (action.includes('Crear')) return MARANA_COLORS.primary;
    if (action.includes('Actualizar')) return MARANA_COLORS.secondary;
    if (action.includes('Eliminar')) return MARANA_COLORS.accent;
    return MARANA_COLORS.textSecondary;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <HistoryIcon sx={{ fontSize: 32, color: MARANA_COLORS.primary }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Logs y Auditorías
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Registro completo de todas las acciones realizadas en el sistema. Los logs se mantienen por 90 días.
      </Alert>

      <Card sx={{ mb: 3, border: `1px solid ${MARANA_COLORS.border}` }}>
        <CardContent>
          <TextField
            fullWidth
            placeholder="Buscar en logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: MARANA_COLORS.primary }} />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: `1px solid ${MARANA_COLORS.border}` }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: MARANA_COLORS.background }}>
                <TableCell sx={{ fontWeight: 700 }}>Fecha/Hora</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Usuario</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Acción</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Entidad</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Detalles</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>IP</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No se encontraron logs
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>{formatDate(log.timestamp)}</TableCell>
                    <TableCell>{log.user}</TableCell>
                    <TableCell>
                      <Chip
                        label={log.action}
                        size="small"
                        sx={{
                          bgcolor: `${getActionColor(log.action)}15`,
                          color: getActionColor(log.action),
                          fontWeight: 600
                        }}
                      />
                    </TableCell>
                    <TableCell>{log.entity}</TableCell>
                    <TableCell>{log.details}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {log.ip}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

