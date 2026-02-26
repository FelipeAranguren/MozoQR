// frontend/src/pages/owner/menu/ProductsManagement.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  CircularProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ImageIcon from '@mui/icons-material/Image';
import { MARANA_COLORS } from '../../../theme';
import {
  fetchProducts,
  fetchCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadImage
} from '../../../api/menu';
import ProductForm from './ProductForm';

export default function ProductsManagement({ slug }) {
  console.log('ProductsManagement renderizado', { slug });
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [uploading, setUploading] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [slug]);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, selectedCategory]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('Cargando productos y categorías para:', slug);
      // Primero cargar categorías (que incluyen productos)
      const categoriesData = await fetchCategories(slug);
      console.log('Categorías cargadas:', categoriesData.length, categoriesData);
      
      // Luego obtener productos (que ahora usa las categorías)
      const productsData = await fetchProducts(slug);
      console.log('Productos cargados:', productsData.length, productsData);
      console.log('IDs de categorías:', categoriesData.map(c => ({ name: c.name, id: c.id })));
      console.log('CategoriaIds de productos:', productsData.map(p => ({ name: p.name, categoriaId: p.categoriaId, id: p.id })));
      
      // Verificar que los productos tengan IDs válidos
      const validProducts = productsData.filter(p => p.id);
      if (validProducts.length !== productsData.length) {
        console.warn('Algunos productos no tienen ID válido:', productsData.filter(p => !p.id));
      }
      
      setProducts(validProducts);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading data:', error);
      console.error('Error details:', error?.response?.data || error?.message);
      // Asegurar que al menos tengamos arrays vacíos
      setProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    try {
      let filtered = [...products];

      // Filtrar por categoría (comparar por id numérico o documentId de forma consistente)
      if (selectedCategory !== 'all') {
        const selNum = Number(selectedCategory);
        const selIsNumeric = Number.isFinite(selNum) && String(selectedCategory).trim() !== '';
        filtered = filtered.filter(p => {
          const catId = p.categoriaId;
          if (selIsNumeric && (typeof catId === 'number' || (typeof catId === 'string' && /^\d+$/.test(catId)))) {
            return Number(catId) === selNum;
          }
          return String(catId || '') === String(selectedCategory || '');
        });
      }

      // Filtrar por búsqueda
      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        if (query) {
          console.log('Buscando:', query, 'en', filtered.length, 'productos');
          filtered = filtered.filter(p => {
            try {
              const name = String(p.name || '').toLowerCase();
              const description = String(p.description || '').toLowerCase();
              const nameMatch = name.includes(query);
              const descMatch = description.includes(query);
              const matches = nameMatch || descMatch;
              
              if (matches) {
                console.log('Producto encontrado:', p.name, { nameMatch, descMatch });
              }
              
              return matches;
            } catch (err) {
              console.error('Error filtering product:', p, err);
              return false;
            }
          });
          console.log('Productos después de búsqueda:', filtered.length);
        }
      }

      setFilteredProducts(filtered);
    } catch (error) {
      console.error('Error in filterProducts:', error);
      setFilteredProducts([]);
    }
  };

  const handleOpenDialog = (product = null) => {
    if (product) {
      console.log('Abriendo diálogo de edición para producto:', {
        id: product.id,
        documentId: product.documentId,
        name: product.name,
        fullProduct: product
      });
    }
    setEditingProduct(product);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingProduct(null);
  };

  const handleSaveProduct = async (productData) => {
    setUploading(true);
    try {
      if (editingProduct) {
        // Asegurar que tenemos un ID válido para actualizar
        const productId = editingProduct.id || editingProduct.documentId;
        console.log('handleSaveProduct: editingProduct completo:', editingProduct);
        console.log('handleSaveProduct: ID extraído:', productId, 'Tipo:', typeof productId);
        if (!productId) {
          console.error('handleSaveProduct: No se pudo obtener ID del producto:', editingProduct);
          throw new Error('No se pudo obtener el ID del producto a editar');
        }
        console.log('handleSaveProduct: Actualizando producto con ID:', productId, 'Datos:', productData);
        await updateProduct(productId, productData);
      } else {
        console.log('🔍 [ProductsManagement] Creando nuevo producto');
        console.log('🔍 [ProductsManagement] Slug:', slug);
        console.log('🔍 [ProductsManagement] ProductData:', productData);
        if (!slug) {
          console.error('❌ [ProductsManagement] No hay slug disponible para crear el producto');
          throw new Error('No se pudo obtener el slug del restaurante');
        }
        await createProduct(slug, productData);
      }
      // Recargar datos después de guardar
      await loadData();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving product:', error);
      console.error('Error details:', error?.response?.data || error?.message);
      const errorMessage = error?.response?.data?.error?.message || error?.message || 'Error al guardar el producto';
      alert(`Error al guardar el producto: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    
    if (!window.confirm(`¿Estás seguro de eliminar "${selectedProduct.name}"?`)) {
      return;
    }

    try {
      await deleteProduct(selectedProduct.id);
      await loadData();
      setAnchorEl(null);
      setSelectedProduct(null);
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error al eliminar el producto');
    }
  };

  const handleMenuOpen = (event, product) => {
    setAnchorEl(event.currentTarget);
    setSelectedProduct(product);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedProduct(null);
  };

  const money = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
      .format(Number(n) || 0);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress sx={{ color: MARANA_COLORS.primary }} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Barra de búsqueda y filtros */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Buscar productos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: MARANA_COLORS.textSecondary }} />
              </InputAdornment>
            )
          }}
          sx={{
            flex: 1,
            minWidth: 250,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'white',
              borderRadius: 2
            }
          }}
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label="Todas"
            onClick={() => setSelectedCategory('all')}
            color={selectedCategory === 'all' ? 'primary' : 'default'}
            sx={{
              bgcolor: selectedCategory === 'all' ? `${MARANA_COLORS.primary}15` : 'white',
              color: selectedCategory === 'all' ? MARANA_COLORS.primary : MARANA_COLORS.textSecondary,
              fontWeight: selectedCategory === 'all' ? 600 : 400
            }}
          />
          {categories.map(cat => (
            <Chip
              key={cat.id}
              label={cat.name}
              onClick={() => setSelectedCategory(cat.id)}
              color={selectedCategory === cat.id ? 'primary' : 'default'}
              sx={{
                bgcolor: selectedCategory === cat.id ? `${MARANA_COLORS.primary}15` : 'white',
                color: selectedCategory === cat.id ? MARANA_COLORS.primary : MARANA_COLORS.textSecondary,
                fontWeight: selectedCategory === cat.id ? 600 : 400
              }}
            />
          ))}
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{
            bgcolor: MARANA_COLORS.primary,
            '&:hover': { bgcolor: MARANA_COLORS.primary }
          }}
        >
          Nuevo Producto
        </Button>
      </Box>

      {/* Lista de productos */}
      {filteredProducts.length === 0 ? (
        <Card
          sx={{
            border: `1px solid ${MARANA_COLORS.border}`,
            borderRadius: 3,
            p: 6,
            textAlign: 'center'
          }}
        >
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            {searchQuery || selectedCategory !== 'all' ? 'No se encontraron productos' : 'No hay productos'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchQuery || selectedCategory !== 'all'
              ? 'Intenta con otros filtros'
              : 'Crea tu primer producto para comenzar'}
          </Typography>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {filteredProducts.map(product => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
              <Card
                sx={{
                  border: `1px solid ${MARANA_COLORS.border}`,
                  borderRadius: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: `0px 8px 24px ${MARANA_COLORS.primary}15`,
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    paddingTop: '75%', // Aspect ratio 4:3
                    bgcolor: MARANA_COLORS.background,
                    borderRadius: '12px 12px 0 0',
                    overflow: 'hidden'
                  }}
                >
                  {product.image ? (
                    <Box
                      component="img"
                      src={product.image}
                      alt={product.name}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: MARANA_COLORS.textSecondary,
                        opacity: 0.3
                      }}
                    >
                      <ImageIcon sx={{ fontSize: 48 }} />
                    </Box>
                  )}
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, product)}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      bgcolor: 'rgba(255, 255, 255, 0.9)',
                      '&:hover': { bgcolor: 'white' }
                    }}
                  >
                    <MoreVertIcon />
                  </IconButton>
                  {!product.available && (
                    <Chip
                      label="No disponible"
                      size="small"
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        left: 8,
                        bgcolor: MARANA_COLORS.accent,
                        color: 'white',
                        fontWeight: 600
                      }}
                    />
                  )}
                </Box>
                <CardContent sx={{ flexGrow: 1, p: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }} noWrap>
                    {product.name}
                  </Typography>
                  {product.categoriaName && (
                    <Chip
                      label={product.categoriaName}
                      size="small"
                      sx={{
                        bgcolor: `${MARANA_COLORS.secondary}15`,
                        color: MARANA_COLORS.secondary,
                        mb: 1,
                        height: 20,
                        fontSize: '10px'
                      }}
                    />
                  )}
                  <Typography variant="h6" sx={{ color: MARANA_COLORS.primary, fontWeight: 700, mt: 1 }}>
                    {money(product.price)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Menú contextual */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { handleMenuClose(); handleOpenDialog(selectedProduct); }}>
          <EditIcon sx={{ mr: 1, fontSize: 20 }} /> Editar
        </MenuItem>
        <MenuItem onClick={handleDeleteProduct} sx={{ color: MARANA_COLORS.accent }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} /> Eliminar
        </MenuItem>
      </Menu>

      {/* Dialog de producto */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <ProductForm
            ref={formRef}
            product={editingProduct}
            categories={categories}
            onSave={handleSaveProduct}
            onCancel={handleCloseDialog}
            uploading={uploading}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={handleCloseDialog}
            disabled={uploading}
            sx={{
              color: MARANA_COLORS.textPrimary
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (formRef.current) {
                formRef.current.submit();
              }
            }}
            variant="contained"
            disabled={uploading}
            sx={{
              bgcolor: MARANA_COLORS.primary,
              '&:hover': { bgcolor: MARANA_COLORS.primary }
            }}
          >
            {uploading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

