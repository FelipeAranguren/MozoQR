// src/pages/CargarProducto.jsx
import React, { useEffect, useState, useRef } from 'react';
import {
  Container, TextField, Button, Typography, Box
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { api } from '../api';

export default function CargarProducto() {
  const { slug } = useParams();
  const [restauranteId, setRestauranteId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [imagen, setImagen] = useState(null);
  const [mensaje, setMensaje] = useState('');

  // Drag & drop
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setImagen(e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => {
    inputRef.current.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImagen(e.target.files[0]);
    }
  };

  // Obtener ID del restaurante desde slug
  useEffect(() => {
    const fetchRestaurante = async () => {
      try {
        const res = await api.get(`/restaurantes?filters[slug][$eq]=${slug}`);
        const restaurante = res.data.data[0];
        if (restaurante) {
          setRestauranteId(restaurante.id);
        } else {
          setMensaje(`No se encontró restaurante con slug "${slug}"`);
        }
      } catch (err) {
        console.error('Error al buscar restaurante:', err);
        setMensaje('Error al buscar el restaurante.');
      }
    };

    fetchRestaurante();
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!restauranteId) {
      setMensaje('No se puede crear el producto sin restaurante.');
      return;
    }

    try {
      let imagenId = null;

      if (imagen) {
        const formData = new FormData();
        formData.append('files', imagen);

        const uploadRes = await api.post('/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        imagenId = uploadRes.data[0].id;
      }

      const producto = {
        data: {
          name: nombre,
          price: parseFloat(precio),
          description: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: descripcion }
              ]
            }
          ],
          restaurante: restauranteId,
          ...(imagenId && { image: imagenId })
        }
      };

      await api.post('/productos', producto);
      setMensaje('✅ Producto creado correctamente');
      setNombre('');
      setPrecio('');
      setDescripcion('');
      setImagen(null);
    } catch (err) {
      console.error('Error al crear producto:', err.response?.data || err.message);
      setMensaje('❌ Error al crear el producto');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 5 }}>
      <Typography variant="h4" gutterBottom>
        Cargar Producto - {slug.toUpperCase()}
      </Typography>

      {mensaje && <Typography sx={{ mb: 2 }}>{mensaje}</Typography>}

      <form onSubmit={handleSubmit}>
        <TextField
          label="Nombre del producto"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          fullWidth
          margin="normal"
          required
        />
        <TextField
          label="Precio"
          type="number"
          value={precio}
          onChange={e => setPrecio(e.target.value)}
          fullWidth
          margin="normal"
          required
        />
        <TextField
          label="Descripción"
          multiline
          rows={4}
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          fullWidth
          margin="normal"
          required
        />

        <Box
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={handleClick}
          sx={{
            border: '2px dashed',
            borderColor: dragActive ? 'primary.main' : 'grey.400',
            borderRadius: 2,
            padding: 3,
            textAlign: 'center',
            cursor: 'pointer',
            mb: 2
          }}
        >
          <Typography>
            {imagen ? `📷 ${imagen.name}` : 'Arrastrá una imagen aquí o hacé clic para subir'}
          </Typography>
          <input
            type="file"
            accept="image/*"
            hidden
            ref={inputRef}
            onChange={handleFileChange}
          />
        </Box>

        {imagen && (
          <Box sx={{ mt: 1, mb: 2, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Vista previa:
            </Typography>
            <Box
              component="img"
              src={URL.createObjectURL(imagen)}
              alt="Preview"
              sx={{
                maxWidth: '100%',
                maxHeight: 200,
                borderRadius: 2,
                boxShadow: 2,
                objectFit: 'contain'
              }}
            />
          </Box>
        )}

        <Button
          variant="contained"
          color="primary"
          type="submit"
          fullWidth
          sx={{ mt: 3 }}
          disabled={!restauranteId}
        >
          Crear producto
        </Button>
      </form>
    </Container>
  );
}
