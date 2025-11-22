// frontend/src/pages/owner/menu/ProductForm.jsx
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  Typography,
  CircularProgress
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { MARANA_COLORS } from '../../../theme';
import { uploadImage } from '../../../api/menu';

const ProductForm = forwardRef(function ProductForm({ product, categories, onSave, onCancel, uploading = false }, ref) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [available, setAvailable] = useState(true);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const formRef = useRef(null);

  useImperativeHandle(ref, () => ({
    submit: () => {
      if (formRef.current) {
        formRef.current.requestSubmit();
      }
    }
  }));

  // Helper para convertir Rich Text (Blocks) de Strapi a texto plano
  const blocksToText = (blocks) => {
    if (!blocks) return '';
    if (typeof blocks === 'string') return blocks;
    if (!Array.isArray(blocks)) return '';
    
    const walk = (nodes) => {
      if (!Array.isArray(nodes)) return '';
      return nodes
        .map((n) => {
          if (typeof n?.text === 'string') return n.text;
          if (Array.isArray(n?.children)) return walk(n.children);
          return '';
        })
        .join('');
    };
    return walk(blocks).replace(/\s+/g, ' ').trim();
  };

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setPrice(product.price?.toString() || '');
      // Convertir descripción de blocks a texto plano si es necesario
      const desc = product.description || '';
      const descriptionText = Array.isArray(desc) ? blocksToText(desc) : (typeof desc === 'string' ? desc : '');
      setDescription(descriptionText);
      setCategoriaId(product.categoriaId || '');
      setAvailable(product.available !== false);
      setImagePreview(product.image || null);
    } else {
      // Reset form
      setName('');
      setPrice('');
      setDescription('');
      setCategoriaId('');
      setAvailable(true);
      setImage(null);
      setImagePreview(null);
    }
  }, [product]);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !price) {
      alert('Nombre y precio son requeridos');
      return;
    }

    try {
      let imageId = null;

      // Si hay una nueva imagen, subirla
      if (image) {
        const uploaded = await uploadImage(image);
        imageId = uploaded?.id || null;
      } else if (product?.image && !imagePreview) {
        // Si se eliminó la imagen existente
        imageId = null;
      }

      await onSave({
        name,
        price: parseFloat(price),
        description,
        categoriaId: categoriaId || null,
        available,
        imageId
      });
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error al guardar el producto');
    }
  };

  return (
    <Box component="form" ref={formRef} onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Nombre */}
        <TextField
          label="Nombre del producto"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          fullWidth
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'white',
              borderRadius: 2
            }
          }}
        />

        {/* Precio */}
        <TextField
          label="Precio"
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          fullWidth
          InputProps={{
            startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'white',
              borderRadius: 2
            }
          }}
        />

        {/* Descripción */}
        <TextField
          label="Descripción"
          multiline
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'white',
              borderRadius: 2
            }
          }}
        />

        {/* Categoría */}
        <FormControl fullWidth>
          <InputLabel>Categoría</InputLabel>
          <Select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            label="Categoría"
            sx={{
              bgcolor: 'white',
              borderRadius: 2
            }}
          >
            <MenuItem value="">Sin categoría</MenuItem>
            {categories.map(cat => (
              <MenuItem key={cat.id} value={cat.id}>
                {cat.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Disponibilidad */}
        <FormControlLabel
          control={
            <Switch
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: MARANA_COLORS.primary
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: MARANA_COLORS.primary
                }
              }}
            />
          }
          label="Producto disponible"
        />

        {/* Imagen */}
        <Box>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
            Imagen del producto
          </Typography>
          <Box
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: `2px dashed ${MARANA_COLORS.border}`,
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: MARANA_COLORS.background,
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: MARANA_COLORS.primary,
                bgcolor: `${MARANA_COLORS.primary}08`
              }
            }}
          >
            {imagePreview ? (
              <Box>
                <Box
                  component="img"
                  src={imagePreview}
                  alt="Preview"
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 200,
                    borderRadius: 2,
                    mb: 2
                  }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImage(null);
                    setImagePreview(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  Cambiar imagen
                </Button>
              </Box>
            ) : (
              <Box>
                <CloudUploadIcon sx={{ fontSize: 48, color: MARANA_COLORS.textSecondary, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Haz clic para subir una imagen
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  PNG, JPG hasta 5MB
                </Typography>
              </Box>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
          </Box>
        </Box>

        {/* Botones - se renderizan en DialogActions del padre */}
      </Box>
    </Box>
  );
});

export default ProductForm;
