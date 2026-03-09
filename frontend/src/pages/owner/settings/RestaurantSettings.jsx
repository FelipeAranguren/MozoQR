// frontend/src/pages/owner/settings/RestaurantSettings.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Container,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SaveIcon from '@mui/icons-material/Save';
import { MARANA_COLORS } from '../../../theme';
import { fetchRestaurant, updateRestaurant } from '../../../api/restaurant';
import { fetchMercadoPagoMethod, saveMercadoPagoMethod } from '../../../api/paymentMethods';

export default function RestaurantSettings() {
  const { slug } = useParams();
  const fileInputRef = useRef(null);
  const logoObjectUrlRef = useRef(null); // Ref para almacenar la URL del objeto y poder acceder desde cualquier función
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurant, setRestaurant] = useState(null);
  const [name, setName] = useState('');
  const [mpLoading, setMpLoading] = useState(false);
  const [mpSaving, setMpSaving] = useState(false);
  const [mpMetodoId, setMpMetodoId] = useState(null);
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadRestaurant();
  }, [slug]);

  // Limpiar URL de objeto al desmontar
  useEffect(() => {
    return () => {
      if (logoObjectUrlRef.current) {
        URL.revokeObjectURL(logoObjectUrlRef.current);
      }
    };
  }, []);

  const loadRestaurant = async () => {
    setLoading(true);
    try {
      const data = await fetchRestaurant(slug);
      if (data) {
        setRestaurant(data);
        setName(data.name || '');

        // Cargar credenciales de Mercado Pago desde los datos ya populados del restaurante
        setMpLoading(true);
        const initialMpId = data.mp_method_id || null;
        setMpMetodoId(initialMpId);
        setMpPublicKey(data.mp_public_key || '');
        // Por seguridad, nunca mostramos el access token existente; el campo queda vacío para introducir uno nuevo.
        setMpAccessToken('');
        setMpLoading(false);
        
        // Limpiar URL de objeto si existe antes de establecer el nuevo preview
        // (el nuevo preview será una URL del servidor, no un objeto URL)
        if (logoObjectUrlRef.current) {
          URL.revokeObjectURL(logoObjectUrlRef.current);
          logoObjectUrlRef.current = null;
        }
        
        // Si hay un logo, usar la URL del servidor, si no, null
        setLogoPreview(data.logo || null);
        // Limpiar estados de edición
        setLogoFile(null);
        setRemoveLogo(false);
        // Limpiar input de archivo
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      console.error('Error loading restaurant:', error);
      setMessage({ type: 'error', text: 'Error al cargar los datos del restaurante' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'El archivo debe ser una imagen' });
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'La imagen no debe superar los 5MB' });
      return;
    }

    // Limpiar URL de objeto anterior si existe
    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    setLogoFile(file);
    setLogoPreview(objectUrl);
    logoObjectUrlRef.current = objectUrl;
    setRemoveLogo(false); // Si hay nueva imagen, no eliminar
    setMessage({ type: '', text: '' });
  };

  const handleRemoveLogo = () => {
    // Limpiar URL de objeto si existe
    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
      logoObjectUrlRef.current = null;
    }
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'El nombre del restaurante es requerido' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await updateRestaurant(slug, {
        name: name.trim(),
        logoFile: logoFile,
        removeLogo: removeLogo && !logoFile // Solo eliminar si no hay nueva imagen
      });
      
      // Limpiar URL de objeto si existe (para evitar memory leaks)
      if (logoObjectUrlRef.current) {
        URL.revokeObjectURL(logoObjectUrlRef.current);
        logoObjectUrlRef.current = null;
      }
      
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
      setLogoFile(null); // Limpiar el archivo después de guardar
      setRemoveLogo(false);
      
      // Recargar datos del servidor (esto obtendrá el logo actualizado o la ausencia de logo)
      await loadRestaurant();
    } catch (error) {
      console.error('Error saving restaurant:', error);
      setMessage({ type: 'error', text: error.response?.data?.error?.message || 'Error al guardar la configuración' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3, background: MARANA_COLORS.background, minHeight: '100vh' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress sx={{ color: MARANA_COLORS.primary }} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3, background: MARANA_COLORS.background, minHeight: '100vh' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Configuración del Restaurante
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Personaliza los datos de tu restaurante
        </Typography>
      </Box>

      {message.text && (
        <Alert 
          severity={message.type === 'error' ? 'error' : 'success'} 
          sx={{ mb: 3 }}
          onClose={() => setMessage({ type: '', text: '' })}
        >
          {message.text}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Información básica */}
          <Grid item xs={12} md={8}>
            <Card
              sx={{
                border: `1px solid ${MARANA_COLORS.border}`,
                borderRadius: 3,
                boxShadow: '0px 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                  Información Básica
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <TextField
                    label="Nombre del restaurante"
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

                  <TextField
                    label="Slug (URL)"
                    value={restaurant?.slug || ''}
                    disabled
                    fullWidth
                    helperText="El slug no se puede modificar. Se usa en la URL de tu menú."
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: MARANA_COLORS.background,
                        borderRadius: 2
                      }
                    }}
                  />
                </Box>
              </CardContent>
            </Card>

          {/* Credenciales de pago – Mercado Pago */}
          <Card
            sx={{
              border: `1px solid ${MARANA_COLORS.border}`,
              borderRadius: 3,
              boxShadow: '0px 1px 3px rgba(0,0,0,0.05)',
              mt: 3,
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                Credenciales de Pago
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Configurá las credenciales de Mercado Pago para este restaurante. Estas claves se usan para generar pagos
                y nunca se muestran completas.
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Public Key de Mercado Pago"
                  fullWidth
                  value={mpPublicKey}
                  onChange={(e) => setMpPublicKey(e.target.value)}
                  placeholder="Ejemplo: APP_USR-6632523e-xxxx-4b8d-b4c1-0f3cxxxxxxx"
                  helperText="Clave pública de tu aplicación de Mercado Pago (solo lectura en el frontend)."
                  InputProps={{
                    sx: {
                      bgcolor: 'white',
                      borderRadius: 2,
                    },
                  }}
                />

                <TextField
                  label="Access Token de Mercado Pago"
                  fullWidth
                  type="password"
                  value={mpAccessToken}
                  onChange={(e) => setMpAccessToken(e.target.value)}
                  placeholder="Ejemplo: APP_USR-1136052360410590-xxxx-9e9e-xxxxxxxxxxxx"
                  helperText="Por seguridad, nunca mostramos el token guardado. Dejá este campo vacío para mantener el actual; ingresá uno nuevo solo si necesitás reemplazarlo."
                  InputProps={{
                    sx: {
                      bgcolor: 'white',
                      borderRadius: 2,
                      fontFamily: 'monospace',
                    },
                  }}
                />

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={async () => {
                      const restaurantIdentifier = restaurant?.documentId || restaurant?.id;
                      if (!restaurantIdentifier) return;
                      setMpSaving(true);
                      try {
                        await saveMercadoPagoMethod({
                          restaurantDocumentId: restaurant?.documentId,
                          restaurantId: restaurant?.id,
                          metodoDocumentId: mpMetodoId,
                          metodoId: mpMetodoId,
                          mp_public_key: mpPublicKey.trim(),
                          mp_access_token: mpAccessToken.trim() || undefined,
                        });
                        setMessage({ type: 'success', text: 'Credenciales de Mercado Pago guardadas correctamente' });
                        // Volver a cargar el restaurante para refrescar estado (id y public key del método)
                        await loadRestaurant();
                        setMpAccessToken('');
                      } catch (error) {
                        console.error('Error saving Mercado Pago credentials:', error);
                        setMessage({
                          type: 'error',
                          text:
                            error?.response?.data?.error?.message ||
                            'Error al guardar las credenciales de Mercado Pago',
                        });
                      } finally {
                        setMpSaving(false);
                      }
                    }}
                    disabled={mpSaving || mpLoading}
                    startIcon={mpSaving ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : null}
                    sx={{ minWidth: 200 }}
                  >
                    {mpSaving ? 'Guardando credenciales...' : 'Guardar credenciales de pago'}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
          </Grid>

          {/* Logo */}
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                border: `1px solid ${MARANA_COLORS.border}`,
                borderRadius: 3,
                boxShadow: '0px 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                  Logo del Restaurante
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
                    mb: 2,
                    '&:hover': {
                      borderColor: MARANA_COLORS.primary,
                      bgcolor: `${MARANA_COLORS.primary}08`
                    }
                  }}
                >
                  {logoPreview ? (
                    <Box>
                      <Box
                        component="img"
                        src={logoPreview}
                        alt="Logo preview"
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
                          fileInputRef.current?.click();
                        }}
                        sx={{ mr: 1 }}
                      >
                        Cambiar
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveLogo();
                        }}
                      >
                        Eliminar
                      </Button>
                    </Box>
                  ) : (
                    <Box>
                      <CloudUploadIcon sx={{ fontSize: 48, color: MARANA_COLORS.textSecondary, mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        Haz clic para subir un logo
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
                    onChange={handleLogoChange}
                    style={{ display: 'none' }}
                  />
                </Box>

                <Typography variant="caption" color="text.secondary">
                  El logo aparecerá en el menú público y en el dashboard
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Botón de guardar */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                type="submit"
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <SaveIcon />}
                disabled={saving}
                sx={{
                  bgcolor: MARANA_COLORS.primary,
                  '&:hover': { bgcolor: MARANA_COLORS.primary },
                  minWidth: 150
                }}
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Container>
  );
}
