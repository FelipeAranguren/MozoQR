// frontend/src/pages/owner/tables/TablesList.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Container,
  Grid,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import { MARANA_COLORS } from '../../../theme';
import ConfirmActionModal from '../../../components/ui/ConfirmActionModal';
import { fetchTables, fetchActiveOrders, createTable, updateTable, deleteTable } from '../../../api/tables';
import TablesStatusGrid from '../../../components/TablesStatusGrid';

export default function TablesList() {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  console.log('TablesList component mounted', { slug });
  const [tables, setTables] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [tableNumber, setTableNumber] = useState('');
  const [tableName, setTableName] = useState('');
  const [tableToDelete, setTableToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
    // Refrescar cada 10 segundos (consistente con el resto de la app)
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [slug]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('Cargando mesas para:', slug);
      const [tablesData, ordersData] = await Promise.all([
        fetchTables(slug),
        fetchActiveOrders(slug)
      ]);
      console.log('Mesas cargadas:', tablesData.length, tablesData);
      console.log('Pedidos activos cargados:', ordersData.length);
      setTables(tablesData);
      setActiveOrders(ordersData);
    } catch (error) {
      console.error('Error loading data:', error);
      console.error('Error details:', error?.response?.data || error?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (table = null) => {
    if (table) {
      setEditingTable(table);
      setTableNumber(table.number?.toString() || '');
      setTableName(table.name || table.displayName || '');
    } else {
      setEditingTable(null);
      setTableNumber('');
      setTableName('');
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTable(null);
    setTableNumber('');
    setTableName('');
  };

  const handleSave = async () => {
    if (!tableNumber || isNaN(Number(tableNumber))) {
      alert('El número de mesa es requerido y debe ser un número');
      return;
    }

    try {
      if (editingTable) {
        await updateTable(editingTable.id, {
          number: Number(tableNumber),
          name: tableName || `Mesa ${tableNumber}`,
          displayName: tableName || `Mesa ${tableNumber}`
        });
      } else {
        await createTable(slug, {
          number: Number(tableNumber),
          name: tableName || `Mesa ${tableNumber}`,
          displayName: tableName || `Mesa ${tableNumber}`
        });
      }
      await loadData();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving table:', error);
      const errorMessage = error?.message || error?.response?.data?.error?.message || 'Error al guardar la mesa';
      alert(errorMessage);
    }
  };

  const handleConfirmDeleteTable = async () => {
    const table = tableToDelete;
    if (!table) return;

    setDeleting(true);
    try {
      await deleteTable(table.id);
      await loadData();
      setTableToDelete(null);
    } catch (error) {
      console.error('Error deleting table:', error);
      alert('Error al eliminar la mesa');
    } finally {
      setDeleting(false);
    }
  };

  const getTableStatus = (table) => {
    const tableOrders = activeOrders.filter(o => 
      o.mesa === table.number || o.tableNumber === table.number
    );
    const activeOrdersForTable = tableOrders.filter(o => 
      o.order_status === 'pending' || 
      o.order_status === 'preparing' || 
      o.order_status === 'served'
    );

    if (activeOrdersForTable.length === 0) {
      return { status: 'free', label: 'Libre', color: MARANA_COLORS.primary, icon: <CheckCircleIcon /> };
    }

    const hasPending = activeOrdersForTable.some(o => o.order_status === 'pending');
    const hasPreparing = activeOrdersForTable.some(o => o.order_status === 'preparing');
    const hasServed = activeOrdersForTable.some(o => o.order_status === 'served');

    if (hasServed && !hasPending && !hasPreparing) {
      return { 
        status: 'waiting', 
        label: 'Esperando cuenta', 
        color: MARANA_COLORS.secondary, 
        icon: <AccessTimeIcon /> 
      };
    }

    if (hasPending || hasPreparing) {
      return { 
        status: 'occupied', 
        label: 'Ocupada', 
        color: MARANA_COLORS.accent, 
        icon: <RestaurantIcon /> 
      };
    }

    return { status: 'free', label: 'Libre', color: MARANA_COLORS.primary, icon: <CheckCircleIcon /> };
  };

  console.log('TablesList renderizado', { slug, loading, tablesCount: tables.length });

  return (
    <Container maxWidth="xl" sx={{ py: 3, background: MARANA_COLORS.background, minHeight: '100vh' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Gestión de Mesas
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Administra las mesas de tu restaurante y visualiza su estado en tiempo real
        </Typography>
      </Box>

      {/* Loading state */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
          <CircularProgress sx={{ color: MARANA_COLORS.primary }} />
        </Box>
      )}

      {/* Lista de mesas con su estado en tiempo real */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {tables.length} mesa{tables.length !== 1 ? 's' : ''} configurada{tables.length !== 1 ? 's' : ''}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<OpenInNewIcon />}
            onClick={() => window.open(`/${slug}/menu`, '_blank', 'noopener,noreferrer')}
            sx={{ textTransform: 'none' }}
          >
            Ver menú
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              bgcolor: MARANA_COLORS.primary,
              '&:hover': { bgcolor: MARANA_COLORS.primary }
            }}
          >
            Nueva Mesa
          </Button>
        </Box>
      </Box>

      {tables.length === 0 ? (
        <Card
          sx={{
            border: `1px solid ${MARANA_COLORS.border}`,
            borderRadius: 3,
            p: 6,
            textAlign: 'center'
          }}
        >
          <TableRestaurantIcon sx={{ fontSize: 64, color: MARANA_COLORS.textSecondary, mb: 2, opacity: 0.3 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No hay mesas configuradas
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Crea tu primera mesa para comenzar a recibir pedidos
          </Typography>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {tables.map(table => {
            const tableStatus = getTableStatus(table);
            const tableOrders = activeOrders.filter(o => 
              o.mesa === table.number || o.tableNumber === table.number
            );
            const activeOrdersCount = tableOrders.filter(o => 
              o.order_status !== 'paid'
            ).length;

            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={table.id}>
                <Card
                  sx={{
                    border: `2px solid ${tableStatus.color}40`,
                    borderRadius: 3,
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: `0px 8px 24px ${tableStatus.color}25`,
                      transform: 'translateY(-2px)',
                      borderColor: tableStatus.color
                    }
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                        <Box
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: `${tableStatus.color}15`,
                            color: tableStatus.color
                          }}
                        >
                          <TableRestaurantIcon />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }} noWrap>
                            {table.name || `Mesa ${table.number}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Número: {table.number}
                          </Typography>
                        </Box>
                      </Box>
                      <Box>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(table)}
                          sx={{ color: MARANA_COLORS.primary }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => setTableToDelete(table)}
                          sx={{ color: MARANA_COLORS.accent }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>

                    <Chip
                      icon={tableStatus.icon}
                      label={tableStatus.label}
                      size="small"
                      sx={{
                        bgcolor: `${tableStatus.color}15`,
                        color: tableStatus.color,
                        fontWeight: 600,
                        mb: 1,
                        width: '100%'
                      }}
                    />

                    {activeOrdersCount > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {activeOrdersCount} pedido{activeOrdersCount > 1 ? 's' : ''} activo{activeOrdersCount > 1 ? 's' : ''}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Dialog de mesa */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingTable ? 'Editar Mesa' : 'Nueva Mesa'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Número de mesa"
              type="number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              required
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'white',
                  borderRadius: 2
                }
              }}
            />
            <TextField
              label="Nombre de la mesa (opcional)"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder={`Mesa ${tableNumber || 'X'}`}
              fullWidth
              helperText="Si no especificas un nombre, se usará 'Mesa [número]'"
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'white',
                  borderRadius: 2
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={handleCloseDialog}
            sx={{
              color: MARANA_COLORS.textPrimary
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            sx={{
              bgcolor: MARANA_COLORS.primary,
              '&:hover': { bgcolor: MARANA_COLORS.primary }
            }}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmActionModal
        isOpen={!!tableToDelete}
        onClose={() => !deleting && setTableToDelete(null)}
        onConfirm={handleConfirmDeleteTable}
        title="Eliminar mesa"
        message={
          tableToDelete
            ? `¿Estás seguro de eliminar "${tableToDelete.name || `Mesa ${tableToDelete.number}`}"? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        loading={deleting}
      />
    </Container>
  );
}
