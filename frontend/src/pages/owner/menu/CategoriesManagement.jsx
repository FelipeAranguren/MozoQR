// frontend/src/pages/owner/menu/CategoriesManagement.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/Folder';
import { MARANA_COLORS } from '../../../theme';
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../../../api/menu';

export default function CategoriesManagement({ slug }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [name, setName] = useState('');
  const [slugValue, setSlugValue] = useState('');

  useEffect(() => {
    loadCategories();
  }, [slug]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await fetchCategories(slug);
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setName(category.name || '');
      setSlugValue(category.slug || '');
    } else {
      setEditingCategory(null);
      setName('');
      setSlugValue('');
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCategory(null);
    setName('');
    setSlugValue('');
  };

  const handleNameChange = (value) => {
    setName(value);
    // Auto-generar slug si no hay uno editado manualmente
    if (!editingCategory || !editingCategory.slug) {
      setSlugValue(value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('El nombre es requerido');
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: name.trim(),
          slug: slugValue.trim() || name.toLowerCase().replace(/\s+/g, '-')
        });
      } else {
        console.log('🔍 [CategoriesManagement] Creando categoría para slug:', slug);
        await createCategory(slug, {
          name: name.trim(),
          slug: slugValue.trim() || name.toLowerCase().replace(/\s+/g, '-')
        });
      }
      await loadCategories();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving category:', error);
      const errorMessage = error?.response?.data?.error?.message 
        || error?.message 
        || error?.response?.data?.message
        || 'Error al guardar la categoría';
      alert(`Error al guardar la categoría: ${errorMessage}`);
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${category.name}"? Los productos de esta categoría quedarán sin categoría.`)) {
      return;
    }

    try {
      await deleteCategory(category.id);
      await loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Error al eliminar la categoría');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress sx={{ color: MARANA_COLORS.primary }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {categories.length} categoría{categories.length !== 1 ? 's' : ''}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{
            bgcolor: MARANA_COLORS.primary,
            '&:hover': { bgcolor: MARANA_COLORS.primary }
          }}
        >
          Nueva Categoría
        </Button>
      </Box>

      {categories.length === 0 ? (
        <Card
          sx={{
            border: `1px solid ${MARANA_COLORS.border}`,
            borderRadius: 3,
            p: 6,
            textAlign: 'center'
          }}
        >
          <FolderIcon sx={{ fontSize: 64, color: MARANA_COLORS.textSecondary, mb: 2, opacity: 0.3 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No hay categorías
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Crea tu primera categoría para organizar tus productos
          </Typography>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {categories.map(category => (
            <Grid item xs={12} sm={6} md={4} key={category.id}>
              <Card
                sx={{
                  border: `1px solid ${MARANA_COLORS.border}`,
                  borderRadius: 3,
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: `0px 8px 24px ${MARANA_COLORS.primary}15`,
                    transform: 'translateY(-2px)'
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
                          bgcolor: `${MARANA_COLORS.primary}15`,
                          color: MARANA_COLORS.primary
                        }}
                      >
                        <FolderIcon />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }} noWrap>
                          {category.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {category.productos?.length || 0} producto{(category.productos?.length || 0) !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                    </Box>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(category)}
                        sx={{ color: MARANA_COLORS.primary }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(category)}
                        sx={{ color: MARANA_COLORS.accent }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog de categoría */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Nombre de la categoría"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
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
              label="Slug (URL)"
              value={slugValue}
              onChange={(e) => setSlugValue(e.target.value)}
              helperText="Se genera automáticamente desde el nombre"
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'white',
                  borderRadius: 2
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
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
    </Box>
  );
}
